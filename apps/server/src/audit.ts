import type { Context } from "hono";
import { db } from "./db";
import type { AppEnv } from "./middleware";

const RETENTION_SECONDS = 400 * 24 * 60 * 60;
const SUMMARY_LIMIT = 300;

interface AuditRow {
  id: number;
  actor_name: string;
  action: string;
  summary: string;
  created_at: number;
}

const insertEntry = db.query(
  "INSERT INTO audit_log (actor_id, actor_name, action, summary) VALUES (?, ?, ?, ?)",
);
const listEntries = db.query<AuditRow>(
  `SELECT id, actor_name, action, summary, created_at
   FROM audit_log
   WHERE ($before::int IS NULL OR id < $before::int)
   ORDER BY id DESC
   LIMIT $limit::int`,
);
const pruneEntries = db.query("DELETE FROM audit_log WHERE created_at < ?");

export async function recordAudit(c: Context<AppEnv>, action: string, summary: string) {
  const user = c.get("user");
  try {
    await insertEntry.run(
      user?.id ?? null,
      user?.name ?? "System",
      action,
      summary.slice(0, SUMMARY_LIMIT),
    );
  } catch (error) {
    console.error("Could not write the audit log:", error);
  }
}

export async function listAudit(before: number | null, limit: number) {
  const rows = await listEntries.all({ before, limit: limit + 1 });
  const page = rows.slice(0, limit);
  return {
    entries: page.map((row) => ({
      id: row.id,
      action: row.action,
      summary: row.summary,
      actorName: row.actor_name,
      createdAt: row.created_at,
    })),
    nextBefore: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function pruneAudit() {
  await pruneEntries.run(Math.floor(Date.now() / 1000) - RETENTION_SECONDS);
}
