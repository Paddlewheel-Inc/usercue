import { LIMITS, sanitizeHtml } from "@usercue/shared";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`);
  return sanitizeHtml(paragraphs.join("").slice(0, LIMITS.body));
}

export function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}
