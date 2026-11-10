import { stripHtml } from "@usercue/shared";
import { db } from "./db";
import { announceShipped } from "./shipping";
import { emitWebhook } from "./webhooks";
import { changelogFlags } from "./workspace";

interface DueEntry {
  id: number;
  title: string;
  body: string;
  post_id: number | null;
  published_at: number;
}

const claimDueEntries = db.query<DueEntry>(
  `UPDATE changelog_entries
   SET announced_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE announced_at IS NULL
     AND published_at IS NOT NULL
     AND published_at <= EXTRACT(EPOCH FROM NOW())::BIGINT
   RETURNING id, title, body, post_id, published_at`,
);

export async function announceChangelog(origin = ""): Promise<void> {
  if (!(await changelogFlags()).enabled) return;
  for (const entry of await claimDueEntries.all()) {
    await emitWebhook("changelog.published", {
      id: entry.id,
      title: entry.title,
      body: stripHtml(entry.body),
      postId: entry.post_id,
      publishedAt: entry.published_at,
      url: origin ? `${origin}/changelog/${entry.id}` : null,
    });
    if (entry.post_id) await announceShipped(entry.post_id, origin);
  }
}
