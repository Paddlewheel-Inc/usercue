import { vValidator } from "@hono/valibot-validator";
import {
  CHANGELOG_LIMITS,
  CHANGELOG_REACTION_IDS,
  type ChangelogReaction,
  changelogSectionChip,
  changelogSectionLabel,
  isEmptyHtml,
  LIMITS,
  sanitizeHtml,
} from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "../db";
import { notifyMentions } from "../mentions";
import { type AppEnv, rateLimit, requireTeam, requireUser } from "../middleware";
import { publicOrigin } from "../oauth";
import { hasPermission, parsePermissions } from "../roles";
import { changelogFlags } from "../workspace";

const idParam = v.object({
  id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

const commentParam = v.object({
  id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
  commentId: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

const postId = v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)));

const contributorIds = v.pipe(
  v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
  v.maxLength(CHANGELOG_LIMITS.contributors),
);

const imageUrl = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(200),
  v.check(
    (value) => !value || /^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(value),
    "Use an uploaded image.",
  ),
);

const entryBody = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.title)),
  body: v.optional(v.pipe(v.string(), v.maxLength(LIMITS.body)), ""),
  postId: v.optional(postId),
  imageUrl: v.optional(imageUrl, ""),
  contributorIds: v.optional(contributorIds, []),
});

const entryPatch = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.title))),
  body: v.optional(v.pipe(v.string(), v.maxLength(LIMITS.body))),
  postId: v.optional(postId),
  imageUrl: v.optional(imageUrl),
  contributorIds: v.optional(contributorIds),
});

const commentBody = v.object({
  body: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.comment)),
});

const reactionBody = v.object({
  reaction: v.picklist(CHANGELOG_REACTION_IDS),
});

interface EntryRow {
  id: number;
  title: string;
  body: string;
  author_id: number | null;
  author_name: string;
  author_avatar: string | null;
  author_role_name: string | null;
  author_role_icon: string | null;
  author_role_perms: string | null;
  comment_count: number;
  post_id: number | null;
  image_url: string;
  linked_title: string | null;
  created_at: number;
  updated_at: number;
}

interface CommentRow {
  id: number;
  entry_id: number;
  author_id: number | null;
  author_name: string;
  body: string;
  is_team: number;
  created_at: number;
  author_avatar: string | null;
  author_role_name: string | null;
  author_role_icon: string | null;
  author_role_perms: string | null;
}

interface ReactionRow {
  entry_id: number;
  reaction: string;
  user_id: number;
}

interface SectionRow {
  id: number;
  entry_id: number;
  label: string;
  body: string;
  position: number;
}

interface ContributorRow {
  entry_id: number;
  user_id: number;
  name: string;
  avatar_url: string | null;
  position: number;
}

interface PersonRow {
  id: number;
  name: string;
  avatar_url: string | null;
}

const ENTRY_SELECT = `
  SELECT e.id, e.title, e.body, e.author_id, e.author_name, e.post_id, e.image_url,
         e.created_at, e.updated_at,
         u.avatar_url AS author_avatar,
         r.name AS author_role_name,
         r.icon_url AS author_role_icon,
         r.permissions AS author_role_perms,
         lp.title AS linked_title,
         (SELECT COUNT(*)::int FROM changelog_comments c WHERE c.entry_id = e.id) AS comment_count
  FROM changelog_entries e
  LEFT JOIN users u ON u.id = e.author_id
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN posts lp ON lp.id = e.post_id
`;

const listEntries = db.query<EntryRow>(`${ENTRY_SELECT} ORDER BY e.created_at DESC, e.id DESC`);
const findEntry = db.query<EntryRow>(`${ENTRY_SELECT} WHERE e.id = ?`);
const insertEntry = db.query<{ id: number }>(
  `INSERT INTO changelog_entries (title, body, author_id, author_name, post_id, image_url)
   VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
);
const updateEntry = db.query(
  `UPDATE changelog_entries
   SET title = ?, body = ?, post_id = ?, image_url = ?,
       updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE id = ?`,
);
const findFeedback = db.query<{ id: number }>("SELECT id FROM posts WHERE id = ?");
const deleteEntry = db.query("DELETE FROM changelog_entries WHERE id = ?");

const listComments = db.query<CommentRow>(
  `SELECT c.id, c.entry_id, c.author_id, c.author_name, c.body, c.is_team, c.created_at,
          u.avatar_url AS author_avatar,
          r.name AS author_role_name,
          r.icon_url AS author_role_icon,
          r.permissions AS author_role_perms
   FROM changelog_comments c
   LEFT JOIN users u ON u.id = c.author_id
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE c.entry_id = ?
   ORDER BY c.created_at, c.id`,
);
const findComment = db.query<CommentRow>(
  `SELECT c.id, c.entry_id, c.author_id, c.author_name, c.body, c.is_team, c.created_at,
          u.avatar_url AS author_avatar,
          r.name AS author_role_name,
          r.icon_url AS author_role_icon,
          r.permissions AS author_role_perms
   FROM changelog_comments c
   LEFT JOIN users u ON u.id = c.author_id
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE c.id = ? AND c.entry_id = ?`,
);
const insertComment = db.query<{ id: number }>(
  `INSERT INTO changelog_comments (entry_id, author_id, author_name, body, is_team)
   VALUES (?, ?, ?, ?, ?) RETURNING id`,
);
const deleteComment = db.query("DELETE FROM changelog_comments WHERE id = ? AND entry_id = ?");

const listReactions = db.query<ReactionRow>(
  "SELECT entry_id, reaction, user_id FROM changelog_reactions",
);
const reactionsFor = db.query<ReactionRow>(
  "SELECT entry_id, reaction, user_id FROM changelog_reactions WHERE entry_id = ?",
);
const removeReaction = db.query<{ entry_id: number }>(
  `DELETE FROM changelog_reactions
   WHERE entry_id = ? AND user_id = ? AND reaction = ?
   RETURNING entry_id`,
);
const addReaction = db.query(
  `INSERT INTO changelog_reactions (entry_id, user_id, reaction)
   VALUES (?, ?, ?)
   ON CONFLICT (entry_id, user_id, reaction) DO NOTHING`,
);

const listAllSections = db.query<SectionRow>(
  "SELECT id, entry_id, label, body, position FROM changelog_sections ORDER BY entry_id, position, id",
);
const sectionsFor = db.query<SectionRow>(
  "SELECT id, entry_id, label, body, position FROM changelog_sections WHERE entry_id = ? ORDER BY position, id",
);
const clearSections = db.query("DELETE FROM changelog_sections WHERE entry_id = ?");
const listAllContributors = db.query<ContributorRow>(
  `SELECT c.entry_id, c.position, u.id AS user_id, u.name, u.avatar_url
   FROM changelog_contributors c
   JOIN users u ON u.id = c.user_id
   ORDER BY c.entry_id, c.position, u.id`,
);
const contributorsFor = db.query<ContributorRow>(
  `SELECT c.entry_id, c.position, u.id AS user_id, u.name, u.avatar_url
   FROM changelog_contributors c
   JOIN users u ON u.id = c.user_id
   WHERE c.entry_id = ?
   ORDER BY c.position, u.id`,
);
const clearContributors = db.query("DELETE FROM changelog_contributors WHERE entry_id = ?");
const insertContributor = db.query(
  "INSERT INTO changelog_contributors (entry_id, user_id, position) VALUES (?, ?, ?)",
);
const findUser = db.query<{ id: number }>("SELECT id FROM users WHERE id = ?");
const listPeople = db.query<PersonRow>(
  "SELECT id, name, avatar_url FROM users WHERE suspended = 0 ORDER BY lower(name), id",
);

function roleBadge(name: string | null, icon: string | null, permissions: string | null) {
  if (!name || !hasPermission(parsePermissions(permissions), "dashboard")) return null;
  return { name, iconUrl: icon || null };
}

function cleanBody(html: string) {
  const clean = sanitizeHtml(html);
  return isEmptyHtml(clean) ? "" : clean;
}

function packReactions(rows: ReactionRow[], userId: number | null, enabled: boolean) {
  if (!enabled) return [];
  const known = new Set<string>(CHANGELOG_REACTION_IDS);
  const counts = new Map<string, { count: number; mine: boolean }>();
  for (const row of rows) {
    if (!known.has(row.reaction)) continue;
    const current = counts.get(row.reaction) ?? { count: 0, mine: false };
    current.count += 1;
    if (userId !== null && row.user_id === userId) current.mine = true;
    counts.set(row.reaction, current);
  }
  return CHANGELOG_REACTION_IDS.flatMap((id) => {
    const row = counts.get(id);
    if (!row) return [];
    return [{ id, count: row.count, mine: row.mine }];
  });
}

function groupByEntry<T extends { entry_id: number }>(rows: T[]) {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const list = map.get(row.entry_id) ?? [];
    list.push(row);
    map.set(row.entry_id, list);
  }
  return map;
}

function serializeContributors(rows: ContributorRow[]) {
  return rows.map((row) => ({
    id: row.user_id,
    name: row.name,
    avatarUrl: row.avatar_url || null,
  }));
}

function legacySectionHtml(sections: SectionRow[]) {
  return sections
    .flatMap((section) => {
      const body = cleanBody(section.body);
      if (!body) return [];
      const label = changelogSectionLabel(section.label);
      const chip = label ? `${changelogSectionChip(label)} ` : `<strong>${section.label}</strong> `;
      return [`<p>${chip}${body}</p>`];
    })
    .join("");
}

function entryBodyHtml(body: string, sections: SectionRow[]) {
  const legacy = legacySectionHtml(sections);
  if (!legacy) return body;
  return body ? `${body}${legacy}` : legacy;
}

function serializeEntry(
  row: EntryRow,
  reactions: { id: ChangelogReaction; count: number; mine: boolean }[],
  commentsOn: boolean,
  sections: SectionRow[],
  contributors: ContributorRow[],
) {
  return {
    id: row.id,
    title: row.title,
    body: entryBodyHtml(row.body, sections),
    authorName: row.author_name,
    authorAvatar: row.author_avatar || null,
    authorRole: roleBadge(row.author_role_name, row.author_role_icon, row.author_role_perms),
    commentCount: commentsOn ? row.comment_count : 0,
    reactions,
    contributors: serializeContributors(contributors),
    linkedPost:
      row.post_id && row.linked_title ? { id: row.post_id, title: row.linked_title } : null,
    imageUrl: row.image_url.trim() || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveContributors(ids: number[]) {
  const unique: number[] = [];
  for (const id of ids) {
    if (!unique.includes(id)) unique.push(id);
  }
  for (const id of unique) {
    if (!(await findUser.get(id))) return undefined;
  }
  return unique;
}

async function writeExtras(entryId: number, contributorIds: number[] | undefined) {
  await clearSections.run(entryId);
  if (contributorIds) {
    await clearContributors.run(entryId);
    for (const [i, userId] of contributorIds.entries()) {
      await insertContributor.run(entryId, userId, i);
    }
  }
}

async function linkedPostId(postId: number | null | undefined) {
  if (postId == null) return null;
  if (!(await findFeedback.get(postId))) return undefined;
  return postId;
}

function serializeComment(row: CommentRow, viewer: { id: number; staff: boolean } | null) {
  const canDelete = Boolean(viewer && (viewer.staff || viewer.id === row.author_id));
  return {
    id: row.id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar || null,
    authorRole: roleBadge(row.author_role_name, row.author_role_icon, row.author_role_perms),
    body: row.body,
    isTeam: row.is_team === 1,
    createdAt: row.created_at,
    canDelete,
  };
}

function rssUrl(origin: string) {
  return `${origin}/api/changelog/rss`;
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cdata(value: string) {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function feedXml(origin: string, entries: EntryRow[], sections: Map<number, SectionRow[]>) {
  const items = entries
    .slice(0, 50)
    .map((entry) => {
      const link = `${origin}/changelog/${entry.id}`;
      const when = new Date(entry.created_at * 1000).toUTCString();
      const html = entryBodyHtml(entry.body, sections.get(entry.id) ?? []) || entry.title;
      return [
        "<item>",
        `<title>${xmlEscape(entry.title)}</title>`,
        `<link>${xmlEscape(link)}</link>`,
        `<guid isPermaLink="true">${xmlEscape(link)}</guid>`,
        `<pubDate>${when}</pubDate>`,
        `<dc:creator>${xmlEscape(entry.author_name)}</dc:creator>`,
        `<description>${cdata(html)}</description>`,
        "</item>",
      ].join("");
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>Changelog</title>
<link>${xmlEscape(`${origin}/changelog`)}</link>
<description>Product updates</description>
<atom:link href="${xmlEscape(rssUrl(origin))}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;
}

async function loadEntry(
  id: number,
  userId: number | null,
  reactionsOn: boolean,
  commentsOn: boolean,
) {
  const row = await findEntry.get(id);
  if (!row) return undefined;
  const reactions = packReactions(await reactionsFor.all(id), userId, reactionsOn);
  return serializeEntry(
    row,
    reactions,
    commentsOn,
    await sectionsFor.all(id),
    await contributorsFor.all(id),
  );
}

export const changelog = new Hono<AppEnv>()
  .get("/rss", async (c) => {
    const flags = await changelogFlags();
    if (!flags.enabled) return c.text("Not found", 404);
    const origin = publicOrigin(c);
    const xml = feedXml(origin, await listEntries.all(), groupByEntry(await listAllSections.all()));
    return c.body(xml, 200, {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    });
  })

  .get("/", async (c) => {
    const flags = await changelogFlags();
    const user = c.get("user");
    const staff = Boolean(user?.staff);
    const origin = publicOrigin(c);
    const meta = {
      enabled: flags.enabled,
      commentsEnabled: flags.comments,
      reactionsEnabled: flags.reactions,
      rssUrl: staff && flags.enabled ? rssUrl(origin) : null,
    };
    if (!flags.enabled && !staff) {
      return c.json({
        enabled: false,
        commentsEnabled: false,
        reactionsEnabled: false,
        rssUrl: null,
        entries: [],
      });
    }

    const rows = await listEntries.all();
    const reactions = flags.reactions ? await listReactions.all() : [];
    const byEntry = groupByEntry(reactions);
    const sections = groupByEntry(await listAllSections.all());
    const contributors = groupByEntry(await listAllContributors.all());
    return c.json({
      ...meta,
      entries: rows.map((row) =>
        serializeEntry(
          row,
          packReactions(byEntry.get(row.id) ?? [], user?.id ?? null, flags.reactions),
          flags.comments,
          sections.get(row.id) ?? [],
          contributors.get(row.id) ?? [],
        ),
      ),
    });
  })

  .get("/people", requireTeam, async (c) => {
    const people = await listPeople.all();
    return c.json({
      people: people.map((person) => ({
        id: person.id,
        name: person.name,
        avatarUrl: person.avatar_url || null,
      })),
    });
  })

  .post("/", requireTeam, rateLimit(20, 60), vValidator("json", entryBody), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { title, body, postId, imageUrl: banner, contributorIds: credits } = c.req.valid("json");
    const linked = await linkedPostId(postId);
    if (linked === undefined) return c.json({ error: "That suggestion was not found." }, 400);
    const people = await resolveContributors(credits);
    if (!people) return c.json({ error: "One of those people is no longer here." }, 400);
    const created = await db.transaction(async () => {
      const row = await insertEntry.get(title, cleanBody(body), user.id, user.name, linked, banner);
      if (!row) return undefined;
      await writeExtras(row.id, people);
      return row;
    });
    if (!created) return c.json({ error: "Could not publish that update." }, 500);
    const flags = await changelogFlags();
    const entry = await loadEntry(created.id, user.id, flags.reactions, flags.comments);
    if (!entry) return c.json({ error: "Could not publish that update." }, 500);
    return c.json(entry, 201);
  })

  .get("/:id", vValidator("param", idParam), async (c) => {
    const flags = await changelogFlags();
    const user = c.get("user");
    const staff = Boolean(user?.staff);
    if (!flags.enabled && !staff) return c.json({ error: "Not found" }, 404);
    const { id } = c.req.valid("param");
    const entry = await loadEntry(id, user?.id ?? null, flags.reactions, flags.comments);
    if (!entry) return c.json({ error: "Not found" }, 404);
    const comments = flags.comments
      ? (await listComments.all(id)).map((row) =>
          serializeComment(row, user ? { id: user.id, staff } : null),
        )
      : [];
    return c.json({
      enabled: flags.enabled,
      commentsEnabled: flags.comments,
      reactionsEnabled: flags.reactions,
      rssUrl: staff && flags.enabled ? rssUrl(publicOrigin(c)) : null,
      ...entry,
      comments,
    });
  })

  .patch(
    "/:id",
    requireTeam,
    vValidator("param", idParam),
    vValidator("json", entryPatch),
    async (c) => {
      const { id } = c.req.valid("param");
      const current = await findEntry.get(id);
      if (!current) return c.json({ error: "Not found" }, 404);
      const patch = c.req.valid("json");
      if (
        patch.title === undefined &&
        patch.body === undefined &&
        patch.postId === undefined &&
        patch.imageUrl === undefined &&
        patch.contributorIds === undefined
      ) {
        return c.json({ error: "Nothing to update." }, 400);
      }
      const linked =
        patch.postId === undefined ? current.post_id : await linkedPostId(patch.postId);
      if (linked === undefined) return c.json({ error: "That suggestion was not found." }, 400);
      const people =
        patch.contributorIds === undefined
          ? undefined
          : await resolveContributors(patch.contributorIds);
      if (patch.contributorIds !== undefined && !people) {
        return c.json({ error: "One of those people is no longer here." }, 400);
      }
      const title = patch.title ?? current.title;
      const banner = patch.imageUrl === undefined ? current.image_url : patch.imageUrl;
      const legacy = await sectionsFor.all(id);
      const body =
        patch.body === undefined ? entryBodyHtml(current.body, legacy) : cleanBody(patch.body);
      await db.transaction(async () => {
        await updateEntry.run(title, body, linked, banner, id);
        await writeExtras(id, people);
      });
      const flags = await changelogFlags();
      const entry = await loadEntry(id, c.get("user")?.id ?? null, flags.reactions, flags.comments);
      if (!entry) return c.json({ error: "Not found" }, 404);
      return c.json(entry);
    },
  )

  .delete("/:id", requireTeam, vValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    if (!(await findEntry.get(id))) return c.json({ error: "Not found" }, 404);
    await deleteEntry.run(id);
    return c.json({ ok: true });
  })

  .post(
    "/:id/comments",
    requireUser,
    rateLimit(20, 60),
    vValidator("param", idParam),
    vValidator("json", commentBody),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      if (user.suspended) return c.json({ error: "Your account has been suspended." }, 403);
      const flags = await changelogFlags();
      if (!flags.enabled && !user.staff) return c.json({ error: "Not found" }, 404);
      if (!flags.comments) return c.json({ error: "Comments are turned off." }, 403);
      const { id } = c.req.valid("param");
      if (!(await findEntry.get(id))) return c.json({ error: "Not found" }, 404);
      const clean = cleanBody(c.req.valid("json").body);
      if (!clean) return c.json({ error: "Comment cannot be empty" }, 400);
      const created = await insertComment.get(id, user.id, user.name, clean, user.staff ? 1 : 0);
      if (!created) return c.json({ error: "Could not post that comment." }, 500);
      const row = await findComment.get(created.id, id);
      if (!row) return c.json({ error: "Could not post that comment." }, 500);
      const entry = await findEntry.get(id);
      if (entry) {
        void notifyMentions({
          html: clean,
          origin: publicOrigin(c),
          path: `/changelog/${id}#comments`,
          title: entry.title,
          authorName: user.name,
          authorId: user.id,
        });
      }
      return c.json(serializeComment(row, { id: user.id, staff: user.staff }), 201);
    },
  )

  .delete("/:id/comments/:commentId", requireUser, vValidator("param", commentParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.suspended) return c.json({ error: "Your account has been suspended." }, 403);
    const flags = await changelogFlags();
    if (!flags.enabled && !user.staff) return c.json({ error: "Not found" }, 404);
    if (!flags.comments) return c.json({ error: "Comments are turned off." }, 403);
    const { id, commentId } = c.req.valid("param");
    const row = await findComment.get(commentId, id);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (!user.staff && row.author_id !== user.id) return c.json({ error: "Forbidden" }, 403);
    await deleteComment.run(commentId, id);
    return c.json({ ok: true });
  })

  .post(
    "/:id/reactions",
    requireUser,
    rateLimit(60, 60),
    vValidator("param", idParam),
    vValidator("json", reactionBody),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      if (user.suspended) return c.json({ error: "Your account has been suspended." }, 403);
      const flags = await changelogFlags();
      if (!flags.enabled && !user.staff) return c.json({ error: "Not found" }, 404);
      if (!flags.reactions) return c.json({ error: "Reactions are turned off." }, 403);
      const { id } = c.req.valid("param");
      if (!(await findEntry.get(id))) return c.json({ error: "Not found" }, 404);
      const { reaction } = c.req.valid("json");
      const removed = await removeReaction.get(id, user.id, reaction);
      if (!removed) await addReaction.run(id, user.id, reaction);
      return c.json({
        reactions: packReactions(await reactionsFor.all(id), user.id, true),
      });
    },
  );
