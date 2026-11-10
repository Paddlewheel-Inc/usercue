import { env } from "./env";

export function emailOrigin(requestOrigin = ""): string | null {
  const pinned = env.publicUrl.trim().replace(/\/$/, "");
  if (pinned) return pinned;
  if (env.production) return null;
  return requestOrigin.replace(/\/$/, "") || null;
}

export function jobOrigin(): string {
  return env.publicUrl.trim().replace(/\/$/, "");
}
