import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { AiError, draftChangelog, suggestTags, summarizeThread } from "../ai";
import { db } from "../db";
import { type AppEnv, rateLimit, requireTeam } from "../middleware";

const MAX_DRAFT_POSTS = 10;

interface PostRow {
  id: number;
  title: string;
  body: string;
  board_name: string;
  vote_count: number;
}

const findPost = db.query<PostRow>(
  `SELECT p.id, p.title, p.body, p.vote_count, b.name AS board_name
   FROM posts p
   JOIN boards b ON b.id = p.board_id
   WHERE p.id = ?`,
);
const listComments = db.query<{ author_name: string; body: string; is_team: number }>(
  "SELECT author_name, body, is_team FROM comments WHERE post_id = ? ORDER BY created_at, id",
);
const listTags = db.query<{ id: number; name: string }>("SELECT id, name FROM tags ORDER BY name");

const postBody = v.object({ postId: v.pipe(v.number(), v.integer(), v.minValue(1)) });
const draftBody = v.object({
  postIds: v.pipe(
    v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
    v.minLength(1),
    v.maxLength(MAX_DRAFT_POSTS),
  ),
});

function toThreadPost(row: PostRow) {
  return {
    title: row.title,
    body: row.body,
    boardName: row.board_name,
    voteCount: row.vote_count,
  };
}

export const ai = new Hono<AppEnv>()
  .use(requireTeam)
  .use(rateLimit(20, 60))

  .post("/summary", vValidator("json", postBody), async (c) => {
    const post = await findPost.get(c.req.valid("json").postId);
    if (!post) return c.json({ error: "Not found" }, 404);
    try {
      const comments = (await listComments.all(post.id)).map((row) => ({
        authorName: row.author_name,
        body: row.body,
        isTeam: row.is_team === 1,
      }));
      return c.json({ summary: await summarizeThread(toThreadPost(post), comments) });
    } catch (error) {
      if (error instanceof AiError) return c.json({ error: error.message }, error.status);
      throw error;
    }
  })

  .post("/tags", vValidator("json", postBody), async (c) => {
    const post = await findPost.get(c.req.valid("json").postId);
    if (!post) return c.json({ error: "Not found" }, 404);
    try {
      return c.json({ tagIds: await suggestTags(toThreadPost(post), await listTags.all()) });
    } catch (error) {
      if (error instanceof AiError) return c.json({ error: error.message }, error.status);
      throw error;
    }
  })

  .post("/changelog", vValidator("json", draftBody), async (c) => {
    const rows = (
      await Promise.all([...new Set(c.req.valid("json").postIds)].map((id) => findPost.get(id)))
    ).filter((row): row is PostRow => row !== undefined);
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    try {
      return c.json(await draftChangelog(rows.map(toThreadPost)));
    } catch (error) {
      if (error instanceof AiError) return c.json({ error: error.message }, error.status);
      throw error;
    }
  });
