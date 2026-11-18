import { isDateOnly, isOpenTask, type TaskPriority, type TaskStatus } from "@usercue/shared";
import * as v from "valibot";
import { db } from "./db";
import { addNotification } from "./inbox";
import type { SessionUser } from "./middleware";
import { clip } from "./text";

export const idNumber = v.pipe(v.number(), v.integer(), v.minValue(1));
export const idParam = v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1));
export const optionalId = v.optional(v.nullable(idNumber));
export const dateValue = v.union([
  v.literal(""),
  v.pipe(v.string(), v.check(isDateOnly, "Use a valid date")),
]);
export const optionalDate = v.optional(dateValue);

export interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  health: string;
  blocked_reason: string;
  open_blockers: number;
  manager_id: number | null;
  creator_id: number | null;
  creator_name: string;
  due_date: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  members: string;
  manager_name: string | null;
  manager_avatar: string | null;
}

interface PersonJson {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export const MEMBERS_JSON = (alias: string) => `(
  SELECT COALESCE(
    json_agg(
      json_build_object('id', mu.id, 'name', mu.name, 'avatarUrl', mu.avatar_url)
      ORDER BY tm.created_at, mu.id
    ),
    '[]'::json
  )::text
  FROM task_members tm
  JOIN users mu ON mu.id = tm.user_id
  WHERE tm.task_id = ${alias}.id
)`;

export function parseMembers(value: string): PersonJson[] {
  const people = JSON.parse(value || "[]") as PersonJson[];
  return people.map((person) => ({ ...person, avatarUrl: person.avatarUrl || null }));
}

export const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.status, t.priority, t.health,
         t.blocked_reason, t.manager_id, t.creator_id, t.creator_name, t.due_date,
         t.created_at, t.updated_at, t.completed_at,
         (SELECT COUNT(*) FROM task_blockers tb
          JOIN tasks b ON b.id = tb.blocker_id
          WHERE tb.task_id = t.id AND b.status NOT IN ('done', 'cancelled'))::int AS open_blockers,
         ${MEMBERS_JSON("t")} AS members,
         mg.name AS manager_name, mg.avatar_url AS manager_avatar
  FROM tasks t
  LEFT JOIN users mg ON mg.id = t.manager_id`;

export const TASK_ORDER = `
  ORDER BY CASE WHEN t.status IN ('done', 'cancelled') THEN 1 ELSE 0 END,
           CASE WHEN t.due_date = '' THEN 1 ELSE 0 END,
           t.due_date,
           CASE t.priority
             WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
           END,
           t.id DESC`;

export function serializeTask(row: TaskRow, today: string) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    health: row.health || null,
    blockedReason: row.blocked_reason,
    openBlockers: row.open_blockers,
    dueDate: row.due_date || null,
    overdue: Boolean(row.due_date) && row.due_date < today && isOpenTask(row.status),
    members: parseMembers(row.members),
    manager: row.manager_id
      ? {
          id: row.manager_id,
          name: row.manager_name ?? "Staff",
          avatarUrl: row.manager_avatar || null,
        }
      : null,
    creatorName: row.creator_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

const findStaff = db.query<{ id: number }>(
  `SELECT u.id
   FROM users u
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE u.id = ? AND u.suspended = 0 AND r.permissions LIKE '%"dashboard"%'`,
);
const findPost = db.query<{ id: number; title: string }>(
  "SELECT id, title FROM posts WHERE id = ?",
);

export async function isAssignableStaff(id: number) {
  return Boolean(await findStaff.get(id));
}

export const postExists = async (id: number) => Boolean(await findPost.get(id));

export async function notifyUsers(
  recipients: (number | null)[],
  actor: SessionUser,
  notice: { kind: "task"; action: string; title: string; path: string },
) {
  const targets = [...new Set(recipients)].filter(
    (id): id is number => id !== null && id !== actor.id,
  );
  for (const userId of targets) {
    await addNotification({
      userId,
      kind: notice.kind,
      actorName: actor.name,
      actorAvatar: actor.avatarUrl ?? "",
      title: clip(notice.title, 140),
      excerpt: notice.action,
      path: notice.path,
    });
  }
}

export interface LinkedPostRow {
  id: number;
  title: string;
  status: string;
  vote_count: number;
  board_name: string;
}

export const serializeLinkedPost = (post: LinkedPostRow) => ({
  id: post.id,
  title: post.title,
  status: post.status,
  votes: post.vote_count,
  boardName: post.board_name,
});
