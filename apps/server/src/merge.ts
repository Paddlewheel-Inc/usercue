import { db } from "./db";

const copyVotes = db.query(
  `INSERT INTO votes (post_id, voter_id, user_id, created_at)
   SELECT ?::int, voter_id, user_id, created_at FROM votes WHERE post_id = ?
   ON CONFLICT (post_id, voter_id) DO NOTHING`,
);
const copyTags = db.query(
  `INSERT INTO post_tags (post_id, tag_id)
   SELECT ?::int, tag_id FROM post_tags WHERE post_id = ?
   ON CONFLICT DO NOTHING`,
);
const moveComments = db.query("UPDATE comments SET post_id = ? WHERE post_id = ?");
const moveNotes = db.query("UPDATE post_notes SET post_id = ? WHERE post_id = ?");
const moveEntries = db.query("UPDATE changelog_entries SET post_id = ? WHERE post_id = ?");
const moveRedirects = db.query("UPDATE post_redirects SET to_id = ? WHERE to_id = ?");
const addRedirect = db.query(
  `INSERT INTO post_redirects (from_id, to_id) VALUES (?, ?)
   ON CONFLICT (from_id) DO UPDATE SET to_id = EXCLUDED.to_id`,
);
const removePost = db.query("DELETE FROM posts WHERE id = ?");
const recount = db.query(
  `UPDATE posts
   SET vote_count = (SELECT COUNT(*)::int FROM votes WHERE post_id = $id),
       comment_count = (SELECT COUNT(*)::int FROM comments WHERE post_id = $id)
   WHERE id = $id`,
);
const findRedirect = db.query<{ to_id: number }>(
  "SELECT to_id FROM post_redirects WHERE from_id = ?",
);

export function mergePosts(sourceId: number, targetId: number) {
  return db.transaction(async () => {
    await copyVotes.run(targetId, sourceId);
    await copyTags.run(targetId, sourceId);
    await moveComments.run(targetId, sourceId);
    await moveNotes.run(targetId, sourceId);
    await moveEntries.run(targetId, sourceId);
    await moveRedirects.run(targetId, sourceId);
    await addRedirect.run(sourceId, targetId);
    await removePost.run(sourceId);
    await recount.run({ id: targetId });
  });
}

export async function redirectTarget(postId: number): Promise<number | null> {
  return (await findRedirect.get(postId))?.to_id ?? null;
}
