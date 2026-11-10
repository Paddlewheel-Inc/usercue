import { db } from "./db";

export interface IntakePost {
  boardId: number;
  title: string;
  body: string;
  authorName: string;
  authorId: number | null;
  status?: string;
  createdAt?: number;
  tagIds?: number[];
  voterId?: string;
  importedVotes?: number;
}

const insertPost = db.query<{ id: number }>(
  `INSERT INTO posts (board_id, title, body, status, author_name, author_id, created_at)
   VALUES ($board, $title, $body, $status, $author, $authorId,
           COALESCE($createdAt::bigint, EXTRACT(EPOCH FROM NOW())::BIGINT))
   RETURNING id`,
);
const insertStatusChange = db.query(
  `INSERT INTO status_changes (post_id, status, actor_id, actor_name, created_at)
   VALUES ($post, $status, $actorId, $actor,
           COALESCE($createdAt::bigint, EXTRACT(EPOCH FROM NOW())::BIGINT))`,
);
const insertTag = db.query(
  "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
);
const insertVote = db.query(
  `INSERT INTO votes (post_id, voter_id, user_id) VALUES (?, ?, ?)
   ON CONFLICT (post_id, voter_id) DO NOTHING`,
);
const insertImportedVotes = db.query(
  `INSERT INTO votes (post_id, voter_id)
   SELECT $post::int, 'import:' || $post::int || ':' || n FROM generate_series(1, $count::int) AS n`,
);
const syncVotes = db.query(
  "UPDATE posts SET vote_count = (SELECT COUNT(*)::int FROM votes WHERE post_id = ?) WHERE id = ?",
);

export function createIntakePost(post: IntakePost): Promise<number> {
  return db.transaction(async () => {
    const status = post.status ?? "open";
    const created = await insertPost.get({
      board: post.boardId,
      title: post.title,
      body: post.body,
      status,
      author: post.authorName,
      authorId: post.authorId,
      createdAt: post.createdAt ?? null,
    });
    if (!created) throw new Error("Could not create the post");
    const id = created.id;
    await insertStatusChange.run({
      post: id,
      status,
      actorId: post.authorId,
      actor: post.authorName,
      createdAt: post.createdAt ?? null,
    });
    for (const tagId of post.tagIds ?? []) await insertTag.run(id, tagId);
    if (post.voterId) await insertVote.run(id, post.voterId, post.authorId);
    if (post.importedVotes) {
      await insertImportedVotes.run({ post: id, count: post.importedVotes });
    }
    await syncVotes.run(id, id);
    return id;
  });
}
