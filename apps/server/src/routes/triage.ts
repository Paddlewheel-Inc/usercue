import { vValidator } from "@hono/valibot-validator";
import { priorityScore } from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { recordAudit } from "../audit";
import { db } from "../db";
import { mergePosts } from "../merge";
import { type AppEnv, rateLimit, requirePermission, requireTeam } from "../middleware";
import { publicOrigin } from "../oauth";
import { hasPermission } from "../roles";
import { similarPosts } from "../similar";
import { voteBudget } from "../voting";
import { emitWebhook } from "../webhooks";
import { triageEnabledFor } from "../workspace";

const NOTE_LIMIT = 2000;

interface NoteRow {
  id: number;
  author_id: number | null;
  author_name: string;
  body: string;
  created_at: number;
}

const idParam = v.object({
  id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});
const noteParam = v.object({
  id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
  noteId: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});
const similarQuery = v.object({
  q: v.pipe(v.string(), v.trim(), v.maxLength(300)),
});
const mergeBody = v.object({
  targetId: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
const noteBody = v.object({
  body: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(NOTE_LIMIT)),
});

const findPost = db.query<{
  id: number;
  title: string;
  vote_count: number;
  impact: number | null;
  effort: number | null;
}>("SELECT id, title, vote_count, impact, effort FROM posts WHERE id = ?");
const listNotes = db.query<NoteRow>(
  `SELECT id, author_id, author_name, body, created_at
   FROM post_notes
   WHERE post_id = ?
   ORDER BY created_at, id`,
);
const insertNote = db.query<NoteRow>(
  `INSERT INTO post_notes (post_id, author_id, author_name, body)
   VALUES (?, ?, ?, ?)
   RETURNING id, author_id, author_name, body, created_at`,
);
const findNote = db.query<NoteRow>(
  `SELECT id, author_id, author_name, body, created_at
   FROM post_notes
   WHERE id = ? AND post_id = ?`,
);
const deleteNote = db.query("DELETE FROM post_notes WHERE id = ?");

function serializeNote(row: NoteRow, viewer: { id: number; canManage: boolean }) {
  return {
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    canDelete: viewer.canManage || row.author_id === viewer.id,
  };
}

export const triage = new Hono<AppEnv>()
  .get("/similar", rateLimit(30, 60), vValidator("query", similarQuery), async (c) => {
    return c.json({ posts: await similarPosts(c.req.valid("query").q) });
  })

  .get("/budget", async (c) => {
    return c.json(await voteBudget(c.get("visitorId"), c.get("user")?.id ?? null));
  })

  .get("/:id/triage", requireTeam, vValidator("param", idParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id } = c.req.valid("param");
    const post = await findPost.get(id);
    if (!post || !(await triageEnabledFor(id))) return c.json({ error: "Not found" }, 404);
    const canManage = hasPermission(user.permissions, "manage_posts");
    return c.json({
      impact: post.impact,
      effort: post.effort,
      score: priorityScore(post.vote_count, post.impact, post.effort),
      notes: (await listNotes.all(id)).map((row) => serializeNote(row, { id: user.id, canManage })),
    });
  })

  .post(
    "/:id/notes",
    requireTeam,
    rateLimit(30, 60),
    vValidator("param", idParam),
    vValidator("json", noteBody),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const { id } = c.req.valid("param");
      if (!(await findPost.get(id)) || !(await triageEnabledFor(id))) {
        return c.json({ error: "Not found" }, 404);
      }
      const row = await insertNote.get(id, user.id, user.name, c.req.valid("json").body);
      if (!row) return c.json({ error: "Could not save that note." }, 500);
      const canManage = hasPermission(user.permissions, "manage_posts");
      return c.json(serializeNote(row, { id: user.id, canManage }), 201);
    },
  )

  .delete("/:id/notes/:noteId", requireTeam, vValidator("param", noteParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id, noteId } = c.req.valid("param");
    const note = await findNote.get(noteId, id);
    if (!note) return c.json({ error: "Not found" }, 404);
    const canManage = hasPermission(user.permissions, "manage_posts");
    if (!canManage && note.author_id !== user.id) return c.json({ error: "Forbidden" }, 403);
    await deleteNote.run(noteId);
    return c.json({ ok: true });
  })

  .post(
    "/:id/merge",
    requirePermission("manage_posts"),
    vValidator("param", idParam),
    vValidator("json", mergeBody),
    async (c) => {
      const { id } = c.req.valid("param");
      const { targetId } = c.req.valid("json");
      if (id === targetId) return c.json({ error: "Pick a different post to merge into." }, 400);
      const source = await findPost.get(id);
      if (!source) return c.json({ error: "Not found" }, 404);
      const target = await findPost.get(targetId);
      if (!target) return c.json({ error: "The post to merge into was not found." }, 404);

      await mergePosts(id, targetId);
      await recordAudit(c, "post.merged", `Merged “${source.title}” into “${target.title}”`);
      const origin = publicOrigin(c);
      void emitWebhook("post.merged", {
        sourceId: source.id,
        sourceTitle: source.title,
        targetId: target.id,
        targetTitle: target.title,
        url: `${origin}/post/${target.id}`,
      });
      return c.json({ targetId });
    },
  );
