import { LIMITS, parseMentionIds } from "@usercue/shared";
import { db } from "./db";
import { env } from "./env";
import { sendMentionEmail } from "./mail";

const findMentionable = db.query<{ id: number; email: string | null }>(
  `SELECT id, email FROM users
   WHERE id = ? AND suspended = 0 AND email IS NOT NULL AND email <> ''`,
);

const WINDOW_MS = 60_000;
const MAX_PER_RECIPIENT = 3;
const recentByUser = new Map<number, number[]>();

function allowMentionEmail(userId: number): boolean {
  const now = Date.now();
  const prior = (recentByUser.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (prior.length >= MAX_PER_RECIPIENT) {
    recentByUser.set(userId, prior);
    return false;
  }
  prior.push(now);
  recentByUser.set(userId, prior);
  if (recentByUser.size > 2_000) {
    for (const [id, times] of recentByUser) {
      const live = times.filter((at) => now - at < WINDOW_MS);
      if (live.length) recentByUser.set(id, live);
      else recentByUser.delete(id);
    }
  }
  return true;
}

function mailOrigin(fallback: string): string | null {
  const pinned = env.publicUrl.trim().replace(/\/$/, "");
  if (pinned) return pinned;
  if (env.production) return null;
  return fallback.replace(/\/$/, "") || null;
}

export async function notifyMentions(options: {
  html: string;
  origin: string;
  path: string;
  title: string;
  authorName: string;
  authorId: number | null;
}): Promise<void> {
  const origin = mailOrigin(options.origin);
  if (!origin) return;
  if (!options.path.startsWith("/")) return;

  const ids = parseMentionIds(options.html)
    .filter((id) => id !== options.authorId)
    .slice(0, LIMITS.mentions);
  if (!ids.length) return;

  const url = `${origin}${options.path}`;
  await Promise.all(
    ids.map(async (id) => {
      if (!allowMentionEmail(id)) return;
      const person = await findMentionable.get(id);
      if (!person?.email) return;
      await sendMentionEmail({
        to: person.email,
        authorName: options.authorName,
        title: options.title,
        url,
      });
    }),
  );
}
