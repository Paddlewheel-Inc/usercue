import { db } from "./db";
import { type DigestSection, emailEnabled, sendDigestEmail } from "./mail";
import { jobOrigin } from "./origin";
import { hasPermission, parsePermissions } from "./roles";
import { getWorkspace } from "./workspace";

const DAY_SECONDS = 24 * 60 * 60;
const ITEMS_PER_SECTION = 5;
const MAX_RECIPIENTS = 500;

interface PostLine {
  id: number;
  title: string;
  votes: number;
}

interface Recipient {
  email: string;
  permissions: string | null;
}

const claimDigest = db.query<{ digest_last_sent_at: number }>(
  `UPDATE workspace
   SET digest_last_sent_at = $now
   WHERE id = 1 AND digest_enabled = 1 AND digest_last_sent_at <= $cutoff
   RETURNING digest_last_sent_at`,
);
const newPosts = db.query<PostLine>(
  `SELECT id, title, vote_count AS votes
   FROM posts
   WHERE created_at >= ?
   ORDER BY vote_count DESC, id DESC
   LIMIT ${ITEMS_PER_SECTION}`,
);
const trendingPosts = db.query<PostLine>(
  `SELECT p.id, p.title, COUNT(*)::int AS votes
   FROM votes v
   JOIN posts p ON p.id = v.post_id
   WHERE v.created_at >= ? AND p.created_at < ?
   GROUP BY p.id
   ORDER BY votes DESC, p.id DESC
   LIMIT ${ITEMS_PER_SECTION}`,
);
const shippedPosts = db.query<PostLine>(
  `SELECT p.id, p.title, p.vote_count AS votes
   FROM posts p
   WHERE EXISTS (
     SELECT 1
     FROM status_changes sc
     JOIN workflow_statuses s ON s.id = sc.status
     WHERE sc.post_id = p.id AND s.category = 'complete' AND sc.created_at >= ?
   )
   ORDER BY p.vote_count DESC, p.id DESC
   LIMIT ${ITEMS_PER_SECTION}`,
);
const listRecipients = db.query<Recipient>(
  `SELECT u.email, r.permissions
   FROM users u
   JOIN roles r ON r.id = u.role_id
   WHERE u.suspended = 0 AND u.email_digest = 1 AND u.email IS NOT NULL AND u.email <> ''
   ORDER BY u.id`,
);

function isDue(now: Date, day: number, hour: number): boolean {
  const weekday = ((now.getUTCDay() + 6) % 7) + 1;
  return weekday === day && now.getUTCHours() >= hour;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function section(
  heading: string,
  origin: string,
  rows: PostLine[],
  note: (row: PostLine) => string,
): DigestSection {
  return {
    heading,
    items: rows.map((row) => ({
      title: row.title,
      url: `${origin}/post/${row.id}`,
      note: note(row),
    })),
  };
}

export async function runDigest(now = new Date()): Promise<void> {
  const workspace = await getWorkspace();
  if (!workspace.digest_enabled || !isDue(now, workspace.digest_day, workspace.digest_hour)) return;

  const origin = jobOrigin();
  if (!origin || !(await emailEnabled())) return;

  const seconds = Math.floor(now.getTime() / 1000);
  const claimed = await claimDigest.get({ now: seconds, cutoff: seconds - 6 * DAY_SECONDS });
  if (!claimed) return;

  const since = workspace.digest_last_sent_at || seconds - 7 * DAY_SECONDS;
  const sections = [
    section("New suggestions", origin, await newPosts.all(since), (row) =>
      plural(row.votes, "vote", "votes"),
    ),
    section(
      "Gaining votes",
      origin,
      await trendingPosts.all(since, since),
      (row) => `${plural(row.votes, "new vote", "new votes")} this week`,
    ),
    section("Shipped", origin, await shippedPosts.all(since), (row) =>
      plural(row.votes, "vote", "votes"),
    ),
  ].filter((entry) => entry.items.length > 0);
  if (sections.length === 0) return;

  const recipients = (await listRecipients.all())
    .filter((row) => hasPermission(parsePermissions(row.permissions), "dashboard"))
    .slice(0, MAX_RECIPIENTS);
  for (const recipient of recipients) {
    await sendDigestEmail({
      to: recipient.email,
      siteName: workspace.site_name,
      url: `${origin}/admin`,
      accountUrl: `${origin}/account`,
      sections,
    }).catch(() => undefined);
  }
}
