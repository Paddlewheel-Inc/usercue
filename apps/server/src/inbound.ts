import { LIMITS, stripHtml } from "@usercue/shared";
import { db } from "./db";
import { createIntakePost } from "./intake";
import { resendCredentials } from "./mail";
import { cleanBody, cleanSubject, parseSender } from "./mailparse";
import { notifyNewPost } from "./notify";
import { jobOrigin } from "./origin";
import { decryptSecret, hashSecret } from "./secret";
import { clip, textToHtml } from "./text";
import { emitWebhook, webhookPost } from "./webhooks";
import { getWorkspace } from "./workspace";

const SENDER_WINDOW_MS = 60 * 60 * 1000;
const SENDER_MAX = 10;

export class InboundError extends Error {}

interface ReceivedEmail {
  from?: string;
  to?: string[];
  subject?: string;
  text?: string | null;
  html?: string | null;
}

const claimEmail = db.query<{ email_id: string }>(
  "INSERT INTO inbound_emails (email_id) VALUES (?) ON CONFLICT DO NOTHING RETURNING email_id",
);
const releaseEmail = db.query("DELETE FROM inbound_emails WHERE email_id = ?");
const findUser = db.query<{ id: number; name: string; suspended: number }>(
  "SELECT id, name, suspended FROM users WHERE lower(email) = ?",
);
const findBoardBySlug = db.query<{ id: number; name: string }>(
  "SELECT id, name FROM boards WHERE slug = ?",
);
const firstBoard = db.query<{ id: number; name: string }>(
  "SELECT id, name FROM boards ORDER BY id LIMIT 1",
);

const recentBySender = new Map<string, number[]>();

export async function inboundSecret(): Promise<string | null> {
  const workspace = await getWorkspace();
  if (!workspace.inbound_enabled || !workspace.inbound_secret_cipher) return null;
  try {
    return decryptSecret(workspace.inbound_secret_cipher);
  } catch {
    return null;
  }
}

function boardSlugCandidates(recipients: string[]): string[] {
  return recipients.flatMap((recipient) => {
    const local = (parseSender(recipient)?.email ?? recipient).split("@")[0] ?? "";
    const [base, tag] = local.toLowerCase().split("+");
    return [tag, base].filter((slug): slug is string => Boolean(slug));
  });
}

async function resolveBoard(recipients: string[]) {
  for (const slug of boardSlugCandidates(recipients)) {
    const board = await findBoardBySlug.get(slug);
    if (board) return board;
  }
  return firstBoard.get();
}

function allowSender(email: string): boolean {
  const now = Date.now();
  const recent = (recentBySender.get(email) ?? []).filter((at) => now - at < SENDER_WINDOW_MS);
  if (recent.length >= SENDER_MAX) return false;
  recent.push(now);
  recentBySender.set(email, recent);
  if (recentBySender.size > 5000) {
    for (const [sender, times] of recentBySender) {
      if (times.every((at) => now - at >= SENDER_WINDOW_MS)) recentBySender.delete(sender);
    }
  }
  return true;
}

async function fetchEmail(emailId: string): Promise<ReceivedEmail> {
  const credentials = await resendCredentials();
  if (!credentials) throw new InboundError("Resend is not configured.");
  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      headers: { Authorization: `Bearer ${credentials.key}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new InboundError(`Resend returned ${response.status}.`);
  return (await response.json()) as ReceivedEmail;
}

export async function processInbound(emailId: string): Promise<void> {
  if (!(await claimEmail.get(emailId))) return;
  try {
    await ingest(await fetchEmail(emailId));
  } catch (error) {
    await releaseEmail.run(emailId);
    throw error;
  }
}

async function ingest(email: ReceivedEmail): Promise<void> {
  const sender = parseSender(email.from ?? "");
  if (!sender || !allowSender(sender.email)) return;
  const board = await resolveBoard(email.to ?? []);
  if (!board) return;

  const user = await findUser.get(sender.email);
  if (user?.suspended === 1) return;
  const text = email.text?.trim() ? email.text : stripHtml(email.html ?? "");
  const body = cleanBody(text);
  const title = cleanSubject(email.subject ?? "");
  const authorName = clip(user?.name ?? sender.name, LIMITS.name);

  const id = await createIntakePost({
    boardId: board.id,
    title,
    body: textToHtml(body),
    authorName,
    authorId: user?.id ?? null,
    voterId: `email:${hashSecret(sender.email).slice(0, 32)}`,
  });

  const origin = jobOrigin();
  if (!origin) return;
  const post = {
    id,
    title,
    body: textToHtml(body),
    status: "open",
    board: "",
    boardName: board.name,
    authorName,
    voteCount: 1,
    commentCount: 0,
    createdAt: Math.floor(Date.now() / 1000),
  };
  void notifyNewPost(origin, post);
  void emitWebhook("post.created", webhookPost(origin, post));
}
