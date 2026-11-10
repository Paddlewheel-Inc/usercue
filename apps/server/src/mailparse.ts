import { LIMITS } from "@usercue/shared";
import { clip } from "./text";

const FALLBACK_TITLE = "Email feedback";

const NAMED_ADDRESS = /^\s*"?([^"<]*?)"?\s*<([^<>\s,;]+@[^<>\s,;]+)>\s*$/;
const BARE_ADDRESS = /^\s*([^<>\s,;]+@[^<>\s,;]+)\s*$/;

export function parseSender(raw: string): { name: string; email: string } | null {
  const named = NAMED_ADDRESS.exec(raw);
  const email = (named?.[2] ?? BARE_ADDRESS.exec(raw)?.[1])?.toLowerCase();
  if (!email) return null;
  return { name: named?.[1]?.trim() || email.split("@")[0] || email, email };
}

export function cleanSubject(subject: string): string {
  const stripped = subject.replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, "").trim();
  return clip(stripped || FALLBACK_TITLE, LIMITS.title);
}

export function cleanBody(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
