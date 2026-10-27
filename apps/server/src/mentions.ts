import { LIMITS, parseMentionIds, parseRoleMentionIds, stripHtml } from "@usercue/shared";
import { db } from "./db";
import { env } from "./env";
import { sendMentionEmail } from "./mail";

const findUser = db.query<{ id: number; email: string | null }>(
  "SELECT id, email FROM users WHERE id = ? AND suspended = 0",
);
const findRole = db.query<{ id: number; name: string }>("SELECT id, name FROM roles WHERE id = ?");
const listRoleMembers = db.query<{ id: number; email: string | null }>(
  "SELECT id, email FROM users WHERE role_id = ? AND suspended = 0 ORDER BY id LIMIT 200",
);
const findAvatar = db.query<{ avatar_url: string | null }>(
  "SELECT avatar_url FROM users WHERE id = ?",
);
const insertNotification = db.query(
  `INSERT INTO notifications (user_id, kind, actor_name, actor_avatar, role_name, title, excerpt, path)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const pruneNotifications = db.query(
  `DELETE FROM notifications
   WHERE user_id = ?
     AND id NOT IN (
       SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100
     )`,
);

const WINDOW_MS = 60_000;
const MAX_EMAILS_PER_COMMENT = 25;

function createLimiter(max: number) {
  const recent = new Map<number, number[]>();
  return (userId: number): boolean => {
    const now = Date.now();
    const prior = (recent.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
    if (prior.length >= max) {
      recent.set(userId, prior);
      return false;
    }
    prior.push(now);
    recent.set(userId, prior);
    if (recent.size > 2_000) {
      for (const [id, times] of recent) {
        const live = times.filter((at) => now - at < WINDOW_MS);
        if (live.length) recent.set(id, live);
        else recent.delete(id);
      }
    }
    return true;
  };
}

const allowEmail = createLimiter(3);
const allowNotification = createLimiter(30);

function mailOrigin(fallback: string): string | null {
  const pinned = env.publicUrl.trim().replace(/\/$/, "");
  if (pinned) return pinned;
  if (env.production) return null;
  return fallback.replace(/\/$/, "") || null;
}

interface Recipient {
  email: string | null;
  roleName: string;
}

interface MentionOptions {
  html: string;
  origin: string;
  path: string;
  commentId: number;
  title: string;
  authorName: string;
  authorId: number | null;
  authorStaff: boolean;
}

export async function notifyMentions(options: MentionOptions): Promise<void> {
  try {
    await deliver(options);
  } catch (err) {
    console.error("mention delivery failed", err instanceof Error ? err.message : err);
  }
}

async function deliver(options: MentionOptions): Promise<void> {
  if (!options.path.startsWith("/")) return;

  const userIds = parseMentionIds(options.html)
    .filter((id) => id !== options.authorId)
    .slice(0, LIMITS.mentions);
  const roleIds = options.authorStaff
    ? parseRoleMentionIds(options.html).slice(0, LIMITS.roleMentions)
    : [];
  if (!userIds.length && !roleIds.length) return;

  const recipients = new Map<number, Recipient>();
  for (const id of userIds) {
    const person = await findUser.get(id);
    if (person) recipients.set(person.id, { email: person.email, roleName: "" });
  }
  for (const roleId of roleIds) {
    const role = await findRole.get(roleId);
    if (!role) continue;
    for (const member of await listRoleMembers.all(roleId)) {
      if (member.id === options.authorId || recipients.has(member.id)) continue;
      recipients.set(member.id, { email: member.email, roleName: role.name });
    }
  }
  if (!recipients.size) return;

  const target = `${options.path}#comment-${options.commentId}`;
  const excerpt = stripHtml(options.html).slice(0, 140);
  const avatar =
    options.authorId === null ? "" : ((await findAvatar.get(options.authorId))?.avatar_url ?? "");

  for (const [userId, recipient] of recipients) {
    if (!allowNotification(userId)) continue;
    await insertNotification.run(
      userId,
      recipient.roleName ? "role" : "mention",
      options.authorName,
      avatar,
      recipient.roleName,
      options.title,
      excerpt,
      target,
    );
    await pruneNotifications.run(userId, userId);
  }

  const origin = mailOrigin(options.origin);
  if (!origin) return;
  const url = `${origin}${target}`;
  let sent = 0;
  for (const [userId, recipient] of recipients) {
    if (sent >= MAX_EMAILS_PER_COMMENT) break;
    if (!recipient.email || !allowEmail(userId)) continue;
    sent += 1;
    await sendMentionEmail({
      to: recipient.email,
      authorName: options.authorName,
      title: options.title,
      url,
    });
  }
}
