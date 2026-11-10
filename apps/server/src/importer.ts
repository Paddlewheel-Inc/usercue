import { guessCategory, LIMITS } from "@usercue/shared";
import { db } from "./db";
import { createIntakePost } from "./intake";
import { clip, textToHtml } from "./text";
import { listWorkflow } from "./workflow";

const TAG_NAME_LIMIT = 24;
const BOARD_NAME_LIMIT = 40;
const DEFAULT_AUTHOR = "Imported";

export interface ImportedPost {
  title: string;
  body: string;
  status: string;
  board: string;
  authorName: string;
  authorEmail: string;
  votes: number;
  createdAt: number | null;
  tags: string[];
}

const listBoards = db.query<{ id: number }>("SELECT id FROM boards ORDER BY id LIMIT 1");
const upsertBoard = db.query<{ id: number }>(
  `INSERT INTO boards (slug, name) VALUES (?, ?)
   ON CONFLICT (slug) DO UPDATE SET name = boards.name
   RETURNING id`,
);
const findTag = db.query<{ id: number }>("SELECT id FROM tags WHERE lower(name) = lower(?)");
const insertTag = db.query(
  "INSERT INTO tags (name, color) VALUES (?, 'stone') ON CONFLICT DO NOTHING",
);
const findUser = db.query<{ id: number }>("SELECT id FROM users WHERE lower(email) = ?");
const findDuplicate = db.query<{ id: number }>(
  `SELECT id FROM posts
   WHERE board_id = ? AND lower(title) = lower(?) AND created_at = ?
   LIMIT 1`,
);

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function importPosts(rows: ImportedPost[]) {
  const workflow = await listWorkflow.all();
  const boardIds = new Map<string, number>();
  const tagIds = new Map<string, number>();
  const userIds = new Map<string, number | null>();
  const fallbackBoard = (await listBoards.get())?.id ?? null;

  const resolveStatus = (label: string): string => {
    const text = label.trim().toLowerCase();
    const exact = workflow.find(
      (status) => status.id.toLowerCase() === text || status.name.toLowerCase() === text,
    );
    if (exact) return exact.id;
    const category = guessCategory(label);
    return workflow.find((status) => status.category === category)?.id ?? workflow[0]?.id ?? "open";
  };

  const resolveBoard = async (name: string): Promise<number | null> => {
    const label = clip(name, BOARD_NAME_LIMIT);
    const slug = slugify(label);
    if (!slug) return fallbackBoard;
    const known = boardIds.get(slug);
    if (known !== undefined) return known;
    const board = await upsertBoard.get(slug, label);
    if (board) boardIds.set(slug, board.id);
    return board?.id ?? fallbackBoard;
  };

  const resolveTag = async (name: string): Promise<number | null> => {
    const label = clip(name, TAG_NAME_LIMIT);
    if (!label) return null;
    const key = label.toLowerCase();
    const known = tagIds.get(key);
    if (known !== undefined) return known;
    let tag = await findTag.get(label);
    if (!tag) {
      await insertTag.run(label);
      tag = await findTag.get(label);
    }
    if (tag) tagIds.set(key, tag.id);
    return tag?.id ?? null;
  };

  const resolveUser = async (email: string): Promise<number | null> => {
    const key = email.trim().toLowerCase();
    if (!key) return null;
    if (!userIds.has(key)) userIds.set(key, (await findUser.get(key))?.id ?? null);
    return userIds.get(key) ?? null;
  };

  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const title = clip(row.title, LIMITS.title);
    const boardId = await resolveBoard(row.board);
    if (!title || boardId === null) {
      skipped += 1;
      continue;
    }
    if (row.createdAt !== null && (await findDuplicate.get(boardId, title, row.createdAt))) {
      skipped += 1;
      continue;
    }
    const tags: number[] = [];
    for (const name of row.tags.slice(0, 8)) {
      const id = await resolveTag(name);
      if (id !== null && !tags.includes(id)) tags.push(id);
    }
    await createIntakePost({
      boardId,
      title,
      body: textToHtml(row.body),
      authorName: clip(row.authorName, LIMITS.name) || DEFAULT_AUTHOR,
      authorId: await resolveUser(row.authorEmail),
      status: resolveStatus(row.status),
      createdAt: row.createdAt ?? undefined,
      tagIds: tags,
      importedVotes: row.votes,
    });
    created += 1;
  }
  return { created, skipped };
}
