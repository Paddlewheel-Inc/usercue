import { vValidator } from "@hono/valibot-validator";
import { isEmptyHtml, LIMITS, SORTS, STATUSES, type Status, sanitizeHtml } from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { type CommentRow, db, type PostRow } from "../db";
import { notifyMentions } from "../mentions";
import { type AppEnv, rateLimit, requirePermission } from "../middleware";
import { notifyComment, notifyNewPost, notifyStatusChange } from "../notify";
import { publicOrigin } from "../oauth";
import { hasPermission, parsePermissions } from "../roles";
import {
  assignmentMode,
  customerTagMode,
  guestsAllowed,
  listAssignableStaff,
  pickNextAssignee,
} from "../workspace";

const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const numberParam = (min: number, max: number) =>
  v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(min), v.maxValue(max));

const listQuery = v.object({
  board: v.optional(v.string()),
  status: v.optional(v.picklist(STATUSES)),
  sort: v.optional(v.picklist(SORTS), "top"),
  q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(100))),
  limit: v.optional(numberParam(1, 100), "50"),
  offset: v.optional(numberParam(0, 100_000), "0"),
});

const createPost = v.object({
  board: v.string(),
  title: text(LIMITS.title),
  body: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(LIMITS.body)), ""),
  name: v.optional(text(LIMITS.name)),
  tagIds: v.optional(v.array(v.pipe(v.number(), v.integer(), v.minValue(1)))),
});

const updatePost = v.object({
  board: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  status: v.optional(v.picklist(STATUSES)),
  title: v.optional(text(LIMITS.title)),
  body: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(LIMITS.body))),
  assigneeId: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  tagIds: v.optional(v.array(v.pipe(v.number(), v.integer(), v.minValue(1)))),
});

const createComment = v.object({
  body: text(LIMITS.comment),
  name: v.optional(text(LIMITS.name)),
  parentId: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
});

const idParam = v.object({ id: numberParam(1, Number.MAX_SAFE_INTEGER) });
const commentParam = v.object({
  id: numberParam(1, Number.MAX_SAFE_INTEGER),
  commentId: numberParam(1, Number.MAX_SAFE_INTEGER),
});

const POST_COLUMNS = `
  p.id, p.title, p.body, p.status,
  p.author_name, p.vote_count, p.comment_count, p.created_at,
  p.assignee_id,
  b.slug AS board, b.name AS board_name,
  author.avatar_url AS author_avatar,
  author_role.name AS author_role_name,
  author_role.icon_url AS author_role_icon,
  author_role.permissions AS author_role_perms,
  assignee.name AS assignee_name,
  assignee.avatar_url AS assignee_avatar,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
    FROM post_tags pt
    JOIN tags t ON t.id = pt.tag_id
    WHERE pt.post_id = p.id
  ), '[]'::jsonb) AS tags,
  CASE WHEN EXISTS (SELECT 1 FROM votes WHERE post_id = p.id AND voter_id = $voter) THEN 1 ELSE 0 END AS voted`;

type PostListRow = PostRow & {
  board: string;
  board_name: string;
  author_avatar: string | null;
  author_role_name: string | null;
  author_role_icon: string | null;
  author_role_perms: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  tags: unknown;
  voted: 0 | 1 | boolean;
};

const POST_FROM = `posts p JOIN boards b ON b.id = p.board_id LEFT JOIN users author ON author.id = p.author_id LEFT JOIN roles author_role ON author_role.id = author.role_id LEFT JOIN users assignee ON assignee.id = p.assignee_id`;

const listPosts = db.query<PostListRow>(`
  SELECT ${POST_COLUMNS}
  FROM ${POST_FROM}
  WHERE ($board::text IS NULL OR b.slug = $board)
    AND ($status::text IS NULL OR p.status = $status)
    AND ($q::text IS NULL OR p.title LIKE $q ESCAPE '\\' OR p.body LIKE $q ESCAPE '\\')
  ORDER BY CASE WHEN $sort::text = 'top' THEN p.vote_count END DESC, p.created_at DESC, p.id DESC
  LIMIT $limit::int OFFSET $offset::int`);

const getPost = db.query<PostListRow>(`
  SELECT ${POST_COLUMNS}
  FROM ${POST_FROM}
  WHERE p.id = $id`);

const statusCounts = db.query<{ status: Status; count: number }>(`
  SELECT p.status, COUNT(*)::int AS count
  FROM posts p JOIN boards b ON b.id = p.board_id
  WHERE ($board::text IS NULL OR b.slug = $board)
  GROUP BY p.status`);

type CommentListRow = CommentRow & {
  author_avatar: string | null;
  author_role_name: string | null;
  author_role_icon: string | null;
  author_role_perms: string | null;
};

const listComments = db.query<CommentListRow>(
  `SELECT c.id, c.post_id, c.parent_id, c.author_name, c.author_id, c.body, c.is_team, c.created_at,
          u.avatar_url AS author_avatar,
          r.name AS author_role_name,
          r.icon_url AS author_role_icon,
          r.permissions AS author_role_perms
   FROM comments c
   LEFT JOIN users u ON u.id = c.author_id
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE c.post_id = ?
   ORDER BY c.created_at, c.id`,
);
const findComment = db.query<{
  id: number;
  post_id: number;
  parent_id: number | null;
}>("SELECT id, post_id, parent_id FROM comments WHERE id = ?");

const boardBySlug = db.query<{ id: number }>("SELECT id FROM boards WHERE slug = ?");
const postExists = db.query<{ id: number }>("SELECT id FROM posts WHERE id = ?");

const insertPost = db.query<{ id: number }>(
  "INSERT INTO posts (board_id, title, body, author_name, author_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
);
const insertVote = db.query(
  "INSERT INTO votes (post_id, voter_id, user_id) VALUES (?, ?, ?) ON CONFLICT (post_id, voter_id) DO NOTHING",
);
const listVoters = db.query<{ name: string | null; avatar_url: string | null }>(
  `SELECT COALESCE(u.name, i.name) AS name, u.avatar_url
   FROM votes v
   LEFT JOIN users u ON u.id = v.user_id
   LEFT JOIN identities i ON i.visitor_id = v.voter_id
   WHERE v.post_id = ?
   ORDER BY v.created_at DESC, v.voter_id`,
);
const deleteVote = db.query<{ post_id: number }>(
  "DELETE FROM votes WHERE post_id = ? AND voter_id = ? RETURNING post_id",
);
const bumpVotes = db.query("UPDATE posts SET vote_count = vote_count + ? WHERE id = ?");
const readVotes = db.query<{ vote_count: number }>("SELECT vote_count FROM posts WHERE id = ?");
const insertComment = db.query<CommentListRow>(
  `INSERT INTO comments (post_id, parent_id, author_name, body, is_team, author_id)
   VALUES (?, ?, ?, ?, ?, ?)
   RETURNING id, post_id, parent_id, author_name, author_id, body, is_team, created_at,
     CAST(NULL AS TEXT) AS author_avatar,
     CAST(NULL AS TEXT) AS author_role_name,
     CAST(NULL AS TEXT) AS author_role_icon,
     CAST(NULL AS TEXT) AS author_role_perms`,
);
const bumpComments = db.query("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?");
const deleteComment = db.query("DELETE FROM comments WHERE id = ? AND post_id = ?");
const recountComments = db.query(
  "UPDATE posts SET comment_count = (SELECT COUNT(*)::int FROM comments WHERE post_id = ?) WHERE id = ?",
);
const removePost = db.query("DELETE FROM posts WHERE id = ?");
const hasVote = db.query<{ n: number }>(
  "SELECT COUNT(*)::int AS n FROM votes WHERE post_id = ? AND voter_id = ?",
);

const toggleVote = (postId: number, voterId: string, userId: number | null) =>
  db.transaction(async () => {
    const removed = await deleteVote.get(postId, voterId);
    if (removed) await bumpVotes.run(-1, postId);
    else {
      await insertVote.run(postId, voterId, userId);
      await bumpVotes.run(1, postId);
    }
    return { voteCount: (await readVotes.get(postId))?.vote_count ?? 0 };
  });

const addComment = (
  postId: number,
  parentId: number | null,
  author: string,
  body: string,
  isTeam: boolean,
  authorId: number | null,
  avatarUrl: string | null,
  roleName: string | null,
  roleIcon: string | null,
) =>
  db.transaction(async () => {
    const comment = await insertComment.get(
      postId,
      parentId,
      author,
      body,
      isTeam ? 1 : 0,
      authorId,
    );
    await bumpComments.run(postId);
    return comment
      ? {
          ...comment,
          author_avatar: avatarUrl,
          author_role_name: roleName,
          author_role_icon: roleIcon,
          author_role_perms: isTeam ? '["dashboard"]' : null,
        }
      : comment;
  });

const removeComment = (postId: number, commentId: number) =>
  db.transaction(async () => {
    await deleteComment.run(commentId, postId);
    await recountComments.run(postId, postId);
  });

function roleBadge(name: string | null, icon: string | null, permissions: string | null) {
  if (!name || !hasPermission(parsePermissions(permissions), "dashboard")) return null;
  return { name, iconUrl: icon || null };
}

const serialize = (row: PostListRow) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  status: row.status,
  authorName: row.author_name,
  authorAvatar: row.author_avatar || null,
  authorRole: roleBadge(row.author_role_name, row.author_role_icon, row.author_role_perms),
  voteCount: row.vote_count,
  commentCount: row.comment_count,
  createdAt: row.created_at,
  board: row.board,
  boardName: row.board_name,
  voted: row.voted === 1 || row.voted === true,
  tags: readTags(row.tags),
  assignee: row.assignee_id
    ? {
        id: row.assignee_id,
        name: row.assignee_name ?? "Staff",
        avatarUrl: row.assignee_avatar || null,
      }
    : null,
});

const serializeComment = (row: CommentListRow) => ({
  id: row.id,
  parentId: row.parent_id,
  authorName: row.author_name,
  authorAvatar: row.author_avatar || null,
  authorRole: roleBadge(row.author_role_name, row.author_role_icon, row.author_role_perms),
  body: row.body,
  isTeam: row.is_team === 1,
  createdAt: row.created_at,
});

function readTags(value: unknown): { id: number; name: string; color: string }[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; name?: unknown; color?: unknown };
    const id =
      typeof row.id === "number"
        ? row.id
        : typeof row.id === "bigint"
          ? Number(row.id)
          : typeof row.id === "string" && /^\d+$/.test(row.id)
            ? Number(row.id)
            : null;
    if (id === null || typeof row.name !== "string" || typeof row.color !== "string") return [];
    return [{ id, name: row.name, color: row.color }];
  });
}

interface StatusChangeRow {
  id: number;
  status: Status;
  actor_name: string;
  actor_avatar: string | null;
  created_at: number;
}

const listStatusChanges = db.query<StatusChangeRow>(
  `SELECT s.id, s.status, s.actor_name, s.created_at, u.avatar_url AS actor_avatar
   FROM status_changes s
   LEFT JOIN users u ON u.id = s.actor_id
   WHERE s.post_id = ?
   ORDER BY s.created_at, s.id`,
);
const insertStatusChange = db.query(
  "INSERT INTO status_changes (post_id, status, actor_id, actor_name) VALUES (?, ?, ?, ?)",
);
const findPostStatus = db.query<{ status: Status }>("SELECT status FROM posts WHERE id = ?");
const findPostMeta = db.query<{
  id: number;
  title: string;
  body: string;
  author_name: string;
  author_avatar: string | null;
  status: Status;
  board_name: string;
  vote_count: number;
}>(
  `SELECT p.id, p.title, p.body, p.author_name, p.status, p.vote_count, b.name AS board_name,
          COALESCE(u.avatar_url, '') AS author_avatar
   FROM posts p
   JOIN boards b ON b.id = p.board_id
   LEFT JOIN users u ON u.id = p.author_id
   WHERE p.id = ?`,
);

const serializeChange = (row: StatusChangeRow) => ({
  id: row.id,
  status: row.status,
  actorName: row.actor_name,
  actorAvatar: row.actor_avatar || null,
  createdAt: row.created_at,
});

const setAssignee = db.query("UPDATE posts SET assignee_id = ? WHERE id = ?");
const setBoard = db.query("UPDATE posts SET board_id = ? WHERE id = ?");
const listTagIds = db.query<{ id: number }>("SELECT id FROM tags");
const clearPostTags = db.query("DELETE FROM post_tags WHERE post_id = ?");
const insertPostTag = db.query("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)");

function replaceTags(postId: number, tagIds: number[]) {
  return db.transaction(async () => {
    await clearPostTags.run(postId);
    for (const tagId of tagIds) await insertPostTag.run(postId, tagId);
  });
}

const escapeLike = (s: string) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;

async function applyUpdate(
  id: number,
  patch: Pick<v.InferOutput<typeof updatePost>, "status" | "title" | "body">,
) {
  const sets: string[] = [];
  const values: Record<string, string | number> = { id };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${key} = $${key}`);
    values[key] = value;
  }
  if (sets.length) await db.query(`UPDATE posts SET ${sets.join(", ")} WHERE id = $id`).run(values);
}

export const posts = new Hono<AppEnv>()
  .get("/", vValidator("query", listQuery), async (c) => {
    const { board, status, sort, q, limit, offset } = c.req.valid("query");
    const rows = await listPosts.all({
      voter: c.get("visitorId"),
      board: board ?? null,
      status: status ?? null,
      q: q ? escapeLike(q) : null,
      sort,
      limit,
      offset,
    });
    return c.json(rows.map(serialize));
  })

  .get("/counts", async (c) => {
    const rows = await statusCounts.all({
      board: c.req.query("board") ?? null,
    });
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
    for (const row of rows) counts[row.status] = row.count;
    return c.json(counts);
  })

  .post("/", rateLimit(10, 60), vValidator("json", createPost), async (c) => {
    const { board, title, body, name, tagIds: rawTagIds } = c.req.valid("json");
    const team = c.get("user");
    const identity = c.get("identity");
    if (team?.suspended) return c.json({ error: "Your account has been suspended." }, 403);
    if (!team && !identity && !(await guestsAllowed())) {
      return c.json({ error: "Sign in to share feedback" }, 403);
    }
    const author = team?.name ?? identity?.name ?? name;
    if (!author) return c.json({ error: "Name is required" }, 400);

    const tags = await customerTagMode();
    const tagIds = tags.allowed ? [...new Set(rawTagIds ?? [])] : [];
    if (tagIds.length > 8) return c.json({ error: "A suggestion can have up to 8 tags." }, 400);
    if (tags.required && tagIds.length === 0) return c.json({ error: "Choose a tag." }, 400);
    if (tagIds.length) {
      const known = new Set((await listTagIds.all()).map((tag) => tag.id));
      if (tagIds.some((tagId) => !known.has(tagId))) {
        return c.json({ error: "Unknown tag." }, 400);
      }
    }

    const boardRow = await boardBySlug.get(board);
    if (!boardRow) return c.json({ error: "Board not found" }, 404);

    const created = await insertPost.get(
      boardRow.id,
      title,
      sanitizeHtml(body ?? ""),
      author,
      team?.id ?? null,
    );
    if (!created) return c.json({ error: "Could not create post" }, 500);
    if (tagIds.length) await replaceTags(created.id, tagIds);

    await toggleVote(created.id, c.get("visitorId"), team?.id ?? null);
    await insertStatusChange.run(created.id, "open", team?.id ?? null, author);

    const post = await getPost.get({
      id: created.id,
      voter: c.get("visitorId"),
    });
    if (!post) return c.json({ error: "Could not create post" }, 500);
    void notifyNewPost(publicOrigin(c), serialize(post));
    return c.json(serialize(post), 201);
  })

  .get("/:id", vValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const post = await getPost.get({ id, voter: c.get("visitorId") });
    if (!post) return c.json({ error: "Not found" }, 404);

    const comments = (await listComments.all(id)).map(serializeComment);
    const history = (await listStatusChanges.all(id)).map(serializeChange);
    return c.json({ ...serialize(post), comments, history });
  })

  .post("/:id/vote", rateLimit(60, 60), vValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    if (!(await postExists.get(id))) return c.json({ error: "Not found" }, 404);

    const { voteCount } = await toggleVote(id, c.get("visitorId"), c.get("user")?.id ?? null);
    const voted = await hasVote.get(id, c.get("visitorId"));
    return c.json({ voteCount, voted: (voted?.n ?? 0) > 0 });
  })

  .get("/:id/voters", rateLimit(120, 60), vValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    if (!(await postExists.get(id))) return c.json({ error: "Not found" }, 404);
    const rows = await listVoters.all(id);
    const named = rows.filter((row) => row.name);
    return c.json({
      total: rows.length,
      anonymous: rows.length - named.length,
      people: named.slice(0, 12).map((row) => ({
        name: row.name ?? "",
        avatarUrl: row.avatar_url || null,
      })),
    });
  })

  .post(
    "/:id/comments",
    rateLimit(20, 60),
    vValidator("param", idParam),
    vValidator("json", createComment),
    async (c) => {
      const { id } = c.req.valid("param");
      const { body, name, parentId } = c.req.valid("json");
      if (!(await postExists.get(id))) return c.json({ error: "Not found" }, 404);

      let replyTo: number | null = null;
      if (parentId) {
        const parent = await findComment.get(parentId);
        if (!parent || parent.post_id !== id) {
          return c.json({ error: "That comment is not on this suggestion." }, 400);
        }
        replyTo = parent.id;
      }

      const team = c.get("user");
      const identity = c.get("identity");
      if (team?.suspended) return c.json({ error: "Your account has been suspended." }, 403);
      if (!team && !identity && !(await guestsAllowed())) {
        return c.json({ error: "Sign in to comment" }, 403);
      }
      const author = team?.name ?? identity?.name ?? name;
      if (!author) return c.json({ error: "Name is required" }, 400);
      const clean = sanitizeHtml(body);
      if (isEmptyHtml(clean)) return c.json({ error: "Comment cannot be empty" }, 400);

      const row = await addComment(
        id,
        replyTo,
        author,
        clean,
        Boolean(team?.staff),
        team?.id ?? null,
        team?.avatarUrl ?? null,
        team?.staff ? (team.roleName ?? null) : null,
        team?.staff ? team.roleIcon : null,
      );
      if (!row) return c.json({ error: "Could not create comment" }, 500);
      const origin = publicOrigin(c);
      const meta = await findPostMeta.get(id);
      if (meta) {
        void notifyComment(
          origin,
          {
            id,
            title: meta.title,
            body: meta.body,
            authorName: meta.author_name,
            authorAvatar: meta.author_avatar || null,
            boardName: meta.board_name,
            status: meta.status,
            voteCount: meta.vote_count,
          },
          serializeComment(row),
        );
        void notifyMentions({
          html: clean,
          origin,
          path: `/post/${id}`,
          commentId: row.id,
          title: meta.title,
          authorName: author,
          authorId: team?.id ?? null,
          authorStaff: Boolean(team?.staff),
        });
      }
      return c.json(serializeComment(row), 201);
    },
  )

  .delete("/:id/comments/:commentId", vValidator("param", commentParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.suspended) return c.json({ error: "Your account has been suspended." }, 403);
    if (!user.staff) return c.json({ error: "Forbidden" }, 403);
    const { id, commentId } = c.req.valid("param");
    const row = await findComment.get(commentId);
    if (!row || row.post_id !== id) return c.json({ error: "Not found" }, 404);
    await removeComment(id, commentId);
    return c.json({ ok: true });
  })

  .patch(
    "/:id",
    requirePermission("manage_posts"),
    vValidator("param", idParam),
    vValidator("json", updatePost),
    async (c) => {
      const { id } = c.req.valid("param");
      if (!(await postExists.get(id))) return c.json({ error: "Not found" }, 404);

      const patch = c.req.valid("json");
      const mode = await assignmentMode();
      if (patch.assigneeId !== undefined && mode === "off") {
        return c.json(
          {
            error:
              mode === "off"
                ? "Assignment is turned off."
                : "Assignment is automatic when a suggestion becomes Planned.",
          },
          400,
        );
      }
      if (patch.assigneeId) {
        const staff = await listAssignableStaff();
        if (!staff.some((person) => person.id === patch.assigneeId)) {
          return c.json({ error: "That person can’t be assigned." }, 400);
        }
      }

      let boardId: number | null = null;
      if (patch.board !== undefined) {
        const target = await boardBySlug.get(patch.board);
        if (!target) return c.json({ error: "Board not found" }, 404);
        boardId = target.id;
      }

      const previous = await findPostStatus.get(id);
      if (boardId !== null) await setBoard.run(boardId, id);
      await applyUpdate(id, {
        status: patch.status,
        title: patch.title,
        body: patch.body === undefined ? undefined : sanitizeHtml(patch.body),
      });
      if (patch.status && previous && patch.status !== previous.status) {
        const actor = c.get("user");
        await insertStatusChange.run(id, patch.status, actor?.id ?? null, actor?.name ?? "Team");
        if (
          mode === "auto" &&
          patch.status === "planned" &&
          (patch.assigneeId === undefined || null)
        ) {
          const next = await pickNextAssignee();
          if (next) await setAssignee.run(next.id, id);
        }
      }
      if (mode !== "off" && patch.assigneeId !== undefined) {
        await setAssignee.run(patch.assigneeId, id);
      }
      if (patch.tagIds !== undefined) {
        const tagIds = [...new Set(patch.tagIds)];
        if (tagIds.length > 8) return c.json({ error: "A suggestion can have up to 8 tags." }, 400);
        const known = new Set((await listTagIds.all()).map((tag) => tag.id));
        if (tagIds.some((tagId) => !known.has(tagId))) {
          return c.json({ error: "Unknown tag." }, 400);
        }
        await replaceTags(id, tagIds);
      }
      const post = await getPost.get({ id, voter: c.get("visitorId") });
      if (!post) return c.json({ error: "Not found" }, 404);
      if (patch.status && previous && patch.status !== previous.status) {
        void notifyStatusChange(publicOrigin(c), serialize(post), c.get("user")?.name ?? "Team");
      }
      return c.json(serialize(post));
    },
  )

  .delete("/:id", requirePermission("manage_posts"), vValidator("param", idParam), async (c) => {
    await removePost.run(c.req.valid("param").id);
    return c.json({ ok: true });
  });
