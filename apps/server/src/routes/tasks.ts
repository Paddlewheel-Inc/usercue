import { vValidator } from "@hono/valibot-validator";
import {
  HEALTH_VALUES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskActivityKind,
  type TaskStatus,
  todayDateOnly,
  WORK_LIMITS,
} from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "../db";
import { type AppEnv, rateLimit, requireTeam, type SessionUser } from "../middleware";
import { hasPermission } from "../roles";
import type { LinkedPostRow } from "../work";
import {
  dateValue,
  idNumber,
  idParam,
  isAssignableStaff,
  MEMBERS_JSON,
  notifyUsers,
  optionalDate,
  optionalId,
  parseMembers,
  postExists,
  serializeLinkedPost,
  serializeTask,
  TASK_ORDER,
  TASK_SELECT,
  type TaskRow,
} from "../work";
import { listAssignableStaff } from "../workspace";

interface ActivityRow {
  id: number;
  author_id: number | null;
  author_name: string;
  author_avatar: string | null;
  kind: string;
  body: string;
  value: string;
  health: string;
  created_at: number;
}

interface MemberRow {
  id: number;
}

interface RelatedTaskRow {
  id: number;
  title: string;
  status: string;
  members: string;
}

const listTasks = db.query<TaskRow>(
  `${TASK_SELECT}
   WHERE ($person::int IS NULL
          OR t.manager_id = $person::int
          OR EXISTS (SELECT 1 FROM task_members tm WHERE tm.task_id = t.id AND tm.user_id = $person::int))
     AND ($unowned::int = 0
          OR (t.manager_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM task_members tm WHERE tm.task_id = t.id)))
     AND ($status::text IS NULL OR t.status = $status::text)
     AND ($open::int = 0 OR t.status IN ('todo', 'in_progress', 'blocked'))
   ${TASK_ORDER}
   LIMIT 200`,
);
const findTask = db.query<TaskRow>(`${TASK_SELECT} WHERE t.id = ?`);
const insertTask = db.query<{ id: number }>(
  `INSERT INTO tasks
     (title, description, status, priority, manager_id,
      creator_id, creator_name, due_date, completed_at)
   VALUES ($title, $description, $status, $priority, $manager,
           $creator, $creatorName, $due,
           CASE WHEN $status::text = 'done' THEN EXTRACT(EPOCH FROM NOW())::BIGINT END)
   RETURNING id`,
);
const updateTask = db.query(
  `UPDATE tasks
   SET title = $title, description = $description,
       status = $status, priority = $priority, manager_id = $manager,
       due_date = $due,
       blocked_reason = CASE WHEN $status::text = 'blocked' THEN $reason ELSE '' END,
       health = CASE WHEN $status::text IN ('done', 'cancelled') THEN '' ELSE $health END,
       completed_at = CASE
         WHEN $status::text = 'done' THEN COALESCE(completed_at, EXTRACT(EPOCH FROM NOW())::BIGINT)
         ELSE NULL
       END,
       updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE id = $id`,
);
const deleteTask = db.query("DELETE FROM tasks WHERE id = ?");
const touchTask = db.query(
  "UPDATE tasks SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = ?",
);
const listActivity = db.query<ActivityRow>(
  `SELECT a.id, a.author_id, a.author_name, u.avatar_url AS author_avatar,
          a.kind, a.body, a.value, a.health, a.created_at
   FROM task_activity a
   LEFT JOIN users u ON u.id = a.author_id
   WHERE a.task_id = ?
   ORDER BY a.created_at, a.id`,
);
const findActivity = db.query<ActivityRow>(
  `SELECT a.id, a.author_id, a.author_name, u.avatar_url AS author_avatar,
          a.kind, a.body, a.value, a.health, a.created_at
   FROM task_activity a
   LEFT JOIN users u ON u.id = a.author_id
   WHERE a.id = ? AND a.task_id = ?`,
);
const insertActivity = db.query<{ id: number }>(
  `INSERT INTO task_activity (task_id, author_id, author_name, kind, body, value, health)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   RETURNING id`,
);
const deleteActivity = db.query("DELETE FROM task_activity WHERE id = ?");
const listBlockedBy = db.query<RelatedTaskRow>(
  `SELECT b.id, b.title, b.status, ${MEMBERS_JSON("b")} AS members
   FROM task_blockers tb
   JOIN tasks b ON b.id = tb.blocker_id
   WHERE tb.task_id = ?
   ORDER BY tb.created_at, b.id`,
);
const listBlocking = db.query<RelatedTaskRow>(
  `SELECT b.id, b.title, b.status, ${MEMBERS_JSON("b")} AS members
   FROM task_blockers tb
   JOIN tasks b ON b.id = tb.task_id
   WHERE tb.blocker_id = ?
   ORDER BY tb.created_at, b.id`,
);
const addBlocker = db.query<{ task_id: number }>(
  `INSERT INTO task_blockers (task_id, blocker_id) VALUES (?, ?)
   ON CONFLICT DO NOTHING
   RETURNING task_id`,
);
const removeBlocker = db.query<{ task_id: number }>(
  "DELETE FROM task_blockers WHERE task_id = ? AND blocker_id = ? RETURNING task_id",
);
const clearBlockers = db.query("DELETE FROM task_blockers WHERE task_id = ?");
const dependsOn = db.query<{ n: number }>(
  `WITH RECURSIVE chain(id) AS (
     SELECT blocker_id FROM task_blockers WHERE task_id = $start
     UNION
     SELECT tb.blocker_id FROM task_blockers tb JOIN chain c ON tb.task_id = c.id
   )
   SELECT 1 AS n FROM chain WHERE id = $target LIMIT 1`,
);
const listDependents = db.query<{ id: number; title: string; manager_id: number | null }>(
  `SELECT t.id, t.title, t.manager_id
   FROM task_blockers tb
   JOIN tasks t ON t.id = tb.task_id
   WHERE tb.blocker_id = ? AND t.status = 'blocked'`,
);
const markBlocked = db.query(
  `UPDATE tasks
   SET status = 'blocked', updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE id = ?`,
);
const listMembers = db.query<MemberRow>(
  `SELECT user_id AS id FROM task_members WHERE task_id = ? ORDER BY created_at, user_id`,
);
const addMember = db.query<{ user_id: number }>(
  `INSERT INTO task_members (task_id, user_id) VALUES (?, ?)
   ON CONFLICT DO NOTHING
   RETURNING user_id`,
);
const removeMember = db.query<{ user_id: number }>(
  "DELETE FROM task_members WHERE task_id = ? AND user_id = ? RETURNING user_id",
);
const findUserName = db.query<{ name: string }>("SELECT name FROM users WHERE id = ?");
const listTaskPosts = db.query<LinkedPostRow>(
  `SELECT p.id, p.title, p.status, p.vote_count, b.name AS board_name
   FROM task_posts tp
   JOIN posts p ON p.id = tp.post_id
   JOIN boards b ON b.id = p.board_id
   WHERE tp.task_id = ?
   ORDER BY tp.created_at DESC`,
);
const linkTaskPost = db.query(
  "INSERT INTO task_posts (task_id, post_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
);
const unlinkTaskPost = db.query("DELETE FROM task_posts WHERE task_id = ? AND post_id = ?");

const title = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(WORK_LIMITS.taskTitle));
const description = v.pipe(v.string(), v.trim(), v.maxLength(WORK_LIMITS.taskDescription));

const listQuery = v.object({
  person: v.optional(v.pipe(v.string(), v.regex(/^(me|none|\d+)$/))),
  status: v.optional(v.picklist([...TASK_STATUSES, "open"])),
});
const createBody = v.object({
  title,
  description: v.optional(description, ""),
  managerId: optionalId,
  memberIds: v.optional(v.pipe(v.array(idNumber), v.maxLength(50)), []),
  status: v.optional(v.picklist(TASK_STATUSES), "todo"),
  priority: v.optional(v.picklist(TASK_PRIORITIES), "none"),
  dueDate: v.optional(dateValue, ""),
});
const patchBody = v.object({
  title: v.optional(title),
  description: v.optional(description),
  managerId: optionalId,
  status: v.optional(v.picklist(TASK_STATUSES)),
  priority: v.optional(v.picklist(TASK_PRIORITIES)),
  dueDate: optionalDate,
  health: v.optional(v.picklist(["", ...HEALTH_VALUES])),
  blockedReason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(WORK_LIMITS.blockedReason))),
});
const activityBody = v.object({
  body: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(WORK_LIMITS.taskActivity)),
  status: v.optional(v.picklist(TASK_STATUSES)),
  health: v.optional(v.picklist(["", ...HEALTH_VALUES])),
});
const taskParam = v.object({ id: idParam });
const activityParam = v.object({ id: idParam, activityId: idParam });
const blockerParam = v.object({ id: idParam, blockerId: idParam });
const postParam = v.object({ id: idParam, postId: idParam });
const memberParam = v.object({ id: idParam, userId: idParam });

const serializeRelated = (row: RelatedTaskRow) => ({
  id: row.id,
  title: row.title,
  status: row.status as TaskStatus,
  members: parseMembers(row.members),
});

const serializeActivity = (row: ActivityRow, viewer: { id: number; canManage: boolean }) => ({
  id: row.id,
  kind: row.kind as TaskActivityKind,
  body: row.body,
  value: row.value,
  health: row.health || null,
  authorName: row.author_name,
  authorAvatar: row.author_avatar || null,
  createdAt: row.created_at,
  canDelete: row.kind === "comment" && (viewer.canManage || row.author_id === viewer.id),
});

const taskPath = (id: number) => `/admin/tasks/${id}`;

async function notifyDependents(taskId: number, user: SessionUser) {
  for (const dependent of await listDependents.all(taskId)) {
    const team = (await listMembers.all(dependent.id)).map((member) => member.id);
    await notifyUsers([dependent.manager_id, ...team], user, {
      kind: "task",
      action: "finished a blocker for",
      title: dependent.title,
      path: taskPath(dependent.id),
    });
  }
}

export const tasks = new Hono<AppEnv>()
  .use(requireTeam)

  .get("/staff", async (c) => c.json(await listAssignableStaff()))

  .get("/", vValidator("query", listQuery), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { person, status } = c.req.valid("query");
    const rows = await listTasks.all({
      person: person === "me" ? user.id : person && person !== "none" ? Number(person) : null,
      unowned: person === "none" ? 1 : 0,
      status: status && status !== "open" ? status : null,
      open: status === "open" ? 1 : 0,
    });
    const today = todayDateOnly();
    return c.json(rows.map((row) => serializeTask(row, today)));
  })

  .get("/:id", vValidator("param", taskParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id } = c.req.valid("param");
    const row = await findTask.get(id);
    if (!row) return c.json({ error: "Task not found" }, 404);
    const canManage = hasPermission(user.permissions, "manage_tasks");
    return c.json({
      ...serializeTask(row, todayDateOnly()),
      canDelete: canManage || row.creator_id === user.id,
      blockedBy: (await listBlockedBy.all(id)).map(serializeRelated),
      blocking: (await listBlocking.all(id)).map(serializeRelated),
      posts: (await listTaskPosts.all(id)).map(serializeLinkedPost),
      activity: (await listActivity.all(id)).map((item) =>
        serializeActivity(item, { id: user.id, canManage }),
      ),
    });
  })

  .post("/", rateLimit(60, 60), vValidator("json", createBody), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const input = c.req.valid("json");
    for (const memberId of input.memberIds) {
      if (!(await isAssignableStaff(memberId))) {
        return c.json({ error: "Pick staff members to add to this task." }, 400);
      }
    }
    if (input.managerId && !(await isAssignableStaff(input.managerId))) {
      return c.json({ error: "Pick a staff member to manage this." }, 400);
    }
    const created = await insertTask.get({
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      manager: input.managerId ?? null,
      creator: user.id,
      creatorName: user.name,
      due: input.dueDate,
    });
    if (!created) return c.json({ error: "Could not create the task" }, 500);
    for (const memberId of new Set(input.memberIds)) await addMember.run(created.id, memberId);
    const row = await findTask.get(created.id);
    if (!row) return c.json({ error: "Could not create the task" }, 500);
    await notifyUsers(input.memberIds, user, {
      kind: "task",
      action: "added you to",
      title: input.title,
      path: taskPath(created.id),
    });
    await notifyUsers([input.managerId ?? null], user, {
      kind: "task",
      action: "made you the manager of",
      title: input.title,
      path: taskPath(created.id),
    });
    return c.json(serializeTask(row, todayDateOnly()), 201);
  })

  .patch(
    "/:id",
    rateLimit(120, 60),
    vValidator("param", taskParam),
    vValidator("json", patchBody),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const current = await findTask.get(id);
      if (!current) return c.json({ error: "Task not found" }, 404);

      if (patch.managerId && !(await isAssignableStaff(patch.managerId))) {
        return c.json({ error: "Pick a staff member to manage this." }, 400);
      }

      const next = {
        title: patch.title ?? current.title,
        description: patch.description ?? current.description,
        managerId: patch.managerId === undefined ? current.manager_id : patch.managerId,
        status: patch.status ?? current.status,
        priority: patch.priority ?? current.priority,
        health: patch.health ?? current.health,
        dueDate: patch.dueDate ?? current.due_date,
        blockedReason: patch.blockedReason ?? current.blocked_reason,
      };
      const managerChanged = next.managerId !== current.manager_id;
      const statusChanged = next.status !== current.status;

      await db.transaction(async () => {
        await updateTask.run({
          id,
          reason: next.blockedReason,
          title: next.title,
          description: next.description,
          status: next.status,
          priority: next.priority,
          health: next.health,
          manager: next.managerId,
          due: next.dueDate,
        });
        if (statusChanged) {
          await insertActivity.run(id, user.id, user.name, "status", "", next.status, "");
          if (current.status === "blocked") await clearBlockers.run(id);
        }
      });

      if (managerChanged) {
        await notifyUsers([next.managerId], user, {
          kind: "task",
          action: "made you the manager of",
          title: next.title,
          path: taskPath(id),
        });
      }
      if (statusChanged && next.status === "done") await notifyDependents(id, user);
      const row = await findTask.get(id);
      if (!row) return c.json({ error: "Task not found" }, 404);
      return c.json(serializeTask(row, todayDateOnly()));
    },
  )

  .delete("/:id", vValidator("param", taskParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id } = c.req.valid("param");
    const row = await findTask.get(id);
    if (!row) return c.json({ error: "Task not found" }, 404);
    if (!hasPermission(user.permissions, "manage_tasks") && row.creator_id !== user.id) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await deleteTask.run(id);
    return c.json({ ok: true });
  })

  .post(
    "/:id/activity",
    rateLimit(60, 60),
    vValidator("param", taskParam),
    vValidator("json", activityBody),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const { body } = input;
      const task = await findTask.get(id);
      if (!task) return c.json({ error: "Task not found" }, 404);

      let statusChanged = false;
      const created = await db.transaction(async () => {
        const row = await insertActivity.get(id, user.id, user.name, "comment", body, "", "");
        const status = input.status ?? task.status;
        statusChanged = status !== task.status;
        if (statusChanged || input.health !== undefined) {
          await updateTask.run({
            id,
            reason: task.blocked_reason,
            title: task.title,
            description: task.description,
            status,
            priority: task.priority,
            health: input.health ?? task.health,
            manager: task.manager_id,
            due: task.due_date,
          });
        } else {
          await touchTask.run(id);
        }
        if (statusChanged) {
          await insertActivity.run(id, user.id, user.name, "status", "", status, "");
          if (task.status === "blocked") await clearBlockers.run(id);
        }
        return row;
      });
      if (!created) return c.json({ error: "Could not post that comment" }, 500);

      const team = (await listMembers.all(id)).map((member) => member.id);
      await notifyUsers([task.manager_id, task.creator_id, ...team], user, {
        kind: "task",
        action: "commented on",
        title: task.title,
        path: taskPath(id),
      });
      if (statusChanged && input.status === "done") await notifyDependents(id, user);
      const row = await findActivity.get(created.id, id);
      if (!row) return c.json({ error: "Could not post that comment" }, 500);
      const canManage = hasPermission(user.permissions, "manage_tasks");
      return c.json(serializeActivity(row, { id: user.id, canManage }), 201);
    },
  )

  .put(
    "/:id/blockers/:blockerId",
    rateLimit(60, 60),
    vValidator("param", blockerParam),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const { id, blockerId } = c.req.valid("param");
      if (id === blockerId) return c.json({ error: "A task can't block itself." }, 400);
      const task = await findTask.get(id);
      const blocker = await findTask.get(blockerId);
      if (!task || !blocker) return c.json({ error: "Task not found" }, 404);
      if (await dependsOn.get({ start: blockerId, target: id })) {
        return c.json({ error: "That would make the two tasks wait on each other." }, 400);
      }
      await db.transaction(async () => {
        const added = await addBlocker.get(id, blockerId);
        if (!added) return;
        await insertActivity.run(id, user.id, user.name, "blocker", blocker.title, "add", "");
        if (task.status === "todo" || task.status === "in_progress") {
          await markBlocked.run(id);
          await insertActivity.run(id, user.id, user.name, "status", "", "blocked", "");
        } else {
          await touchTask.run(id);
        }
      });
      return c.json({ ok: true });
    },
  )

  .delete("/:id/blockers/:blockerId", vValidator("param", blockerParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id, blockerId } = c.req.valid("param");
    const blocker = await findTask.get(blockerId);
    await db.transaction(async () => {
      const removed = await removeBlocker.get(id, blockerId);
      if (!removed) return;
      await insertActivity.run(
        id,
        user.id,
        user.name,
        "blocker",
        blocker?.title ?? "",
        "remove",
        "",
      );
      await touchTask.run(id);
    });
    return c.json({ ok: true });
  })

  .put("/:id/posts/:postId", vValidator("param", postParam), async (c) => {
    const { id, postId } = c.req.valid("param");
    if (!(await findTask.get(id))) return c.json({ error: "Task not found" }, 404);
    if (!(await postExists(postId))) return c.json({ error: "Request not found" }, 404);
    await linkTaskPost.run(id, postId);
    await touchTask.run(id);
    return c.json({ ok: true });
  })

  .delete("/:id/posts/:postId", vValidator("param", postParam), async (c) => {
    const { id, postId } = c.req.valid("param");
    await unlinkTaskPost.run(id, postId);
    await touchTask.run(id);
    return c.json({ ok: true });
  })

  .put("/:id/members/:userId", rateLimit(60, 60), vValidator("param", memberParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id, userId } = c.req.valid("param");
    const task = await findTask.get(id);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (!(await isAssignableStaff(userId))) {
      return c.json({ error: "Pick a staff member to add to this task." }, 400);
    }
    const added = await addMember.get(id, userId);
    if (added) {
      const person = await findUserName.get(userId);
      await insertActivity.run(id, user.id, user.name, "member", person?.name ?? "", "add", "");
      await touchTask.run(id);
      await notifyUsers([userId], user, {
        kind: "task",
        action: "added you to",
        title: task.title,
        path: taskPath(id),
      });
    }
    return c.json({ ok: true });
  })

  .delete("/:id/members/:userId", vValidator("param", memberParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id, userId } = c.req.valid("param");
    const removed = await removeMember.get(id, userId);
    if (removed) {
      const person = await findUserName.get(userId);
      await insertActivity.run(id, user.id, user.name, "member", person?.name ?? "", "remove", "");
      await touchTask.run(id);
    }
    return c.json({ ok: true });
  })

  .delete("/:id/activity/:activityId", vValidator("param", activityParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id, activityId } = c.req.valid("param");
    const row = await findActivity.get(activityId, id);
    if (!row || row.kind !== "comment") return c.json({ error: "Not found" }, 404);
    const canManage = hasPermission(user.permissions, "manage_tasks");
    if (!canManage && row.author_id !== user.id) return c.json({ error: "Forbidden" }, 403);
    await deleteActivity.run(activityId);
    return c.json({ ok: true });
  });
