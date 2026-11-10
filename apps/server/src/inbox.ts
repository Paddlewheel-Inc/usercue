import { db } from "./db";

const KEEP_PER_USER = 100;

export interface NewNotification {
  userId: number;
  kind: "mention" | "role" | "shipped";
  actorName?: string;
  actorAvatar?: string;
  roleName?: string;
  title: string;
  excerpt?: string;
  path: string;
}

const insertNotification = db.query(
  `INSERT INTO notifications (user_id, kind, actor_name, actor_avatar, role_name, title, excerpt, path)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const pruneNotifications = db.query(
  `DELETE FROM notifications
   WHERE user_id = ?
     AND id NOT IN (
       SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
     )`,
);

export async function addNotification(notification: NewNotification) {
  await insertNotification.run(
    notification.userId,
    notification.kind,
    notification.actorName ?? "",
    notification.actorAvatar ?? "",
    notification.roleName ?? "",
    notification.title,
    notification.excerpt ?? "",
    notification.path,
  );
  await pruneNotifications.run(notification.userId, notification.userId, KEEP_PER_USER);
}
