import { db } from "./db";
import { addNotification } from "./inbox";
import { sendShippedEmail } from "./mail";
import { emailOrigin } from "./origin";
import { findWorkflowStatus } from "./workflow";
import { notifyVotersEnabled } from "./workspace";

const AUDIENCE_LIMIT = 5000;
const EMAIL_LIMIT = 500;
const NOTICE_KIND = "shipped";

interface Voter {
  id: number;
  email: string | null;
  email_updates: number;
}

const claimNotice = db.query<{ post_id: number }>(
  "INSERT INTO post_notices (post_id, kind) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING post_id",
);
const findPost = db.query<{ id: number; title: string; status: string }>(
  "SELECT id, title, status FROM posts WHERE id = ?",
);
const listAudience = db.query<Voter>(
  `SELECT u.id, u.email, u.email_updates
   FROM users u
   WHERE u.suspended = 0
     AND EXISTS (SELECT 1 FROM votes v WHERE v.post_id = ? AND v.user_id = u.id)
   ORDER BY u.id
   LIMIT ?`,
);

export async function announceShipped(postId: number, requestOrigin = ""): Promise<void> {
  if (!(await notifyVotersEnabled())) return;

  const post = await findPost.get(postId);
  if (!post) return;
  const status = await findWorkflowStatus.get(post.status);
  if (status?.category !== "complete") return;
  if (!(await claimNotice.get(postId, NOTICE_KIND))) return;

  const statusName = status.name;
  const path = `/post/${post.id}`;
  const audience = await listAudience.all(postId, AUDIENCE_LIMIT);
  for (const voter of audience) {
    await addNotification({
      userId: voter.id,
      kind: "shipped",
      title: post.title,
      excerpt: statusName,
      path,
    });
  }

  const origin = emailOrigin(requestOrigin);
  if (!origin) return;
  const recipients = audience
    .filter((voter) => voter.email && voter.email_updates === 1)
    .slice(0, EMAIL_LIMIT);
  for (const voter of recipients) {
    await sendShippedEmail({
      to: voter.email ?? "",
      title: post.title,
      statusName,
      url: `${origin}${path}`,
      accountUrl: `${origin}/account`,
    }).catch(() => undefined);
  }
}
