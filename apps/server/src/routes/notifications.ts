import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "../db";
import { type AppEnv, rateLimit, requireUser } from "../middleware";

interface NotificationRow {
  id: number;
  kind: string;
  actor_name: string;
  actor_avatar: string;
  role_name: string;
  title: string;
  excerpt: string;
  path: string;
  read_at: number | null;
  created_at: number;
}

const listNotifications = db.query<NotificationRow>(
  `SELECT id, kind, actor_name, actor_avatar, role_name, title, excerpt, path, read_at, created_at
   FROM notifications
   WHERE user_id = ?
   ORDER BY created_at DESC, id DESC
   LIMIT 30`,
);
const countUnread = db.query<{ n: number }>(
  "SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
);
const markOne = db.query(
  `UPDATE notifications
   SET read_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE id = ? AND user_id = ? AND read_at IS NULL`,
);
const markAll = db.query(
  `UPDATE notifications
   SET read_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE user_id = ? AND read_at IS NULL`,
);

const idParam = v.object({
  id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

export const notifications = new Hono<AppEnv>()
  .use(requireUser)

  .get("/", rateLimit(120, 60), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rows = await listNotifications.all(user.id);
    const unread = (await countUnread.get(user.id))?.n ?? 0;
    return c.json({
      unread,
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind === "role" ? ("role" as const) : ("mention" as const),
        actorName: row.actor_name,
        actorAvatar: row.actor_avatar || null,
        roleName: row.role_name || null,
        title: row.title,
        excerpt: row.excerpt,
        path: row.path,
        read: row.read_at !== null,
        createdAt: row.created_at,
      })),
    });
  })

  .post("/read", rateLimit(60, 60), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    await markAll.run(user.id);
    return c.json({ ok: true });
  })

  .post("/:id/read", rateLimit(120, 60), vValidator("param", idParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    await markOne.run(c.req.valid("param").id, user.id);
    return c.json({ ok: true });
  });
