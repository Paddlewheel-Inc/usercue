import { randomUUID } from "node:crypto";
import { stripHtml, WEBHOOK_EVENT_IDS, WEBHOOK_LIMITS, type WebhookEvent } from "@usercue/shared";
import { db } from "./db";
import { randomToken } from "./middleware";
import { decryptSecret, encryptSecret } from "./secret";
import { signWebhook } from "./signatures";

const ATTEMPT_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 1500;

export interface WebhookRow {
  id: number;
  name: string;
  url_cipher: string;
  url_preview: string;
  secret_cipher: string;
  events: string;
  enabled: number;
  last_status: number | null;
  last_error: string;
  last_delivery_at: number | null;
  created_at: number;
}

export interface WebhookInput {
  name: string;
  url: string;
  events: WebhookEvent[];
}

const listAll = db.query<WebhookRow>("SELECT * FROM webhooks ORDER BY id");
const findOne = db.query<WebhookRow>("SELECT * FROM webhooks WHERE id = ?");
const countAll = db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM webhooks");
const insertOne = db.query<WebhookRow>(
  `INSERT INTO webhooks (name, url_cipher, url_preview, secret_cipher, events)
   VALUES (?, ?, ?, ?, ?)
   RETURNING *`,
);
const updateOne = db.query<WebhookRow>(
  `UPDATE webhooks
   SET name = ?, url_cipher = ?, url_preview = ?, events = ?, enabled = ?
   WHERE id = ?
   RETURNING *`,
);
const removeOne = db.query("DELETE FROM webhooks WHERE id = ?");
const recordResult = db.query(
  `UPDATE webhooks
   SET last_status = ?, last_error = ?, last_delivery_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE id = ?`,
);

export function parseWebhookUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    const web = url.protocol === "https:" || url.protocol === "http:";
    return web && !url.username && !url.password && value.length <= WEBHOOK_LIMITS.url ? url : null;
  } catch {
    return null;
  }
}

function urlPreview(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname.length > 1 ? "/…" : ""}`;
}

function parseEvents(raw: string): WebhookEvent[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return WEBHOOK_EVENT_IDS.filter((id) => parsed.includes(id));
  } catch {
    return [];
  }
}

export function serializeWebhook(row: WebhookRow) {
  return {
    id: row.id,
    name: row.name,
    urlPreview: row.url_preview,
    events: parseEvents(row.events),
    enabled: row.enabled === 1,
    lastStatus: row.last_status,
    lastError: row.last_error || null,
    lastDeliveryAt: row.last_delivery_at,
    createdAt: row.created_at,
  };
}

export async function listWebhooks() {
  return listAll.all();
}

export async function countWebhooks() {
  return (await countAll.get())?.n ?? 0;
}

export async function createWebhook(input: WebhookInput, url: URL) {
  const secret = `whsec_${randomToken(24)}`;
  const row = await insertOne.get(
    input.name,
    encryptSecret(url.href),
    urlPreview(url),
    encryptSecret(secret),
    JSON.stringify(input.events),
  );
  return row ? { row, secret } : null;
}

export async function updateWebhook(
  id: number,
  patch: { name?: string; url?: URL; events?: WebhookEvent[]; enabled?: boolean },
) {
  const current = await findOne.get(id);
  if (!current) return null;
  return updateOne.get(
    patch.name ?? current.name,
    patch.url ? encryptSecret(patch.url.href) : current.url_cipher,
    patch.url ? urlPreview(patch.url) : current.url_preview,
    JSON.stringify(patch.events ?? parseEvents(current.events)),
    patch.enabled === undefined ? current.enabled : patch.enabled ? 1 : 0,
    id,
  );
}

export async function deleteWebhook(id: number) {
  const existing = await findOne.get(id);
  if (!existing) return false;
  await removeOne.run(id);
  return true;
}

async function attempt(url: string, headers: Record<string, string>, body: string) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    return { status: response.status, error: response.ok ? "" : `HTTP ${response.status}` };
  } catch (cause) {
    return { status: 0, error: cause instanceof Error ? cause.message : "Request failed" };
  }
}

async function deliver(row: WebhookRow, event: string, data: unknown) {
  const body = JSON.stringify({
    id: randomUUID(),
    event,
    createdAt: new Date().toISOString(),
    data,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "UserCue-Webhooks",
    "X-UserCue-Event": event,
    "X-UserCue-Timestamp": timestamp,
    "X-UserCue-Signature": `sha256=${signWebhook(decryptSecret(row.secret_cipher), timestamp, body)}`,
  };
  const url = decryptSecret(row.url_cipher);
  let result = await attempt(url, headers, body);
  if (result.status === 0 || result.status >= 500) {
    await Bun.sleep(RETRY_DELAY_MS);
    result = await attempt(url, headers, body);
  }
  await recordResult.run(result.status || null, result.error.slice(0, 200), row.id);
  return result;
}

export async function emitWebhook(event: WebhookEvent, data: unknown) {
  const targets = (await listAll.all()).filter(
    (row) => row.enabled === 1 && parseEvents(row.events).includes(event),
  );
  await Promise.allSettled(targets.map((row) => deliver(row, event, data)));
}

export async function pingWebhook(id: number) {
  const row = await findOne.get(id);
  if (!row) return null;
  return deliver(row, "ping", { message: "UserCue webhook test" });
}

export interface PostSummary {
  id: number;
  title: string;
  body: string;
  status: string;
  board: string;
  boardName: string;
  authorName: string;
  voteCount: number;
  commentCount: number;
  createdAt: number;
}

export function webhookPost(origin: string, post: PostSummary) {
  return {
    id: post.id,
    title: post.title,
    body: stripHtml(post.body),
    status: post.status,
    board: post.board,
    boardName: post.boardName,
    authorName: post.authorName,
    voteCount: post.voteCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    url: `${origin}/post/${post.id}`,
  };
}
