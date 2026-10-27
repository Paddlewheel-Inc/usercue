const VOID = new Set(["br", "img"]);
const SKIP = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "svg"]);
const ALLOWED = new Set([
  "p",
  "br",
  "div",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "mark",
  "a",
  "img",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
]);

const SECTION_LABELS = ["New", "Changed", "Fixed", "Removed"] as const;

export const IMAGE_WIDTH = { min: 48, max: 2000 };

const ATTR = /([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmptyHtml(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  if (/data-section\s*=/i.test(html)) return false;
  if (/data-mention(?:-role)?\s*=/i.test(html)) return false;
  return stripHtml(html).length === 0;
}

function escapeLabel(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mentionChip(id: number, name: string): string {
  const label = name.trim().slice(0, 60) || "someone";
  return `<span data-mention="${id}" contenteditable="false">@${escapeLabel(label)}</span>`;
}

export function roleMentionChip(id: number, name: string): string {
  const label = name.trim().slice(0, 60) || "role";
  return `<span data-mention-role="${id}" contenteditable="false">@${escapeLabel(label)}</span>`;
}

function parseIds(html: string, attribute: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  const pattern = new RegExp(`<span\\b[^>]*\\b${attribute}="(\\d+)"[^>]*>`, "gi");
  for (const match of html.matchAll(pattern)) {
    const id = Number(match[1]);
    if (!Number.isInteger(id) || id < 1 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function parseMentionIds(html: string): number[] {
  return parseIds(html, "data-mention");
}

export function parseRoleMentionIds(html: string): number[] {
  return parseIds(html, "data-mention-role");
}

export function isPostHref(value: string): boolean {
  return /^\/(?:p|post)\/\d+$/.test(value.trim());
}

function safeHref(value: string): string | null {
  const v = value.trim();
  if (isPostHref(v)) return v;
  try {
    const url = new URL(v);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

function safeSrc(value: string): string | null {
  const v = value.trim();
  if (/^\/(?:api\/)?uploads\/[A-Za-z0-9._-]+$/.test(v)) return v;
  try {
    const url = new URL(v);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function highlightSpan(attrs: string): boolean {
  return /background(?:-color)?\s*:/i.test(attrs);
}

function sectionLabel(attrs: string): (typeof SECTION_LABELS)[number] | null {
  for (const match of rawAttrs(attrs)) {
    if (match.name !== "data-section") continue;
    const found = SECTION_LABELS.find(
      (label) => label.toLowerCase() === match.value.trim().toLowerCase(),
    );
    return found ?? null;
  }
  return null;
}

function mentionId(attrs: string, attribute = "data-mention"): number | null {
  for (const match of rawAttrs(attrs)) {
    if (match.name !== attribute) continue;
    const id = Number(match.value.trim());
    if (Number.isInteger(id) && id >= 1) return id;
  }
  return null;
}

function rawAttrs(raw: string) {
  const out: { name: string; value: string }[] = [];
  ATTR.lastIndex = 0;
  for (const match of raw.matchAll(ATTR)) {
    const name = (match[1] ?? "").toLowerCase();
    if (!name) continue;
    out.push({ name, value: match[2] ?? match[3] ?? match[4] ?? "" });
  }
  return out;
}

function attrsFor(tag: string, raw: string): string {
  if (tag !== "a" && tag !== "img") return "";
  let out = "";
  for (const { name, value } of rawAttrs(raw)) {
    if (tag === "a" && name === "href") {
      const href = safeHref(value);
      if (href && isPostHref(href)) out += ` href="${href}"`;
      else if (href) out += ` href="${href}" target="_blank" rel="nofollow noopener noreferrer"`;
    }
    if (tag === "img" && name === "src") {
      const src = safeSrc(value);
      if (src) out += ` src="${src}"`;
    }
    if (tag === "img" && name === "alt") {
      out += ` alt="${value.replace(/"/g, "&quot;").slice(0, 200)}"`;
    }
    if (tag === "img" && name === "width" && /^\d{1,4}$/.test(value.trim())) {
      const width = Number(value);
      if (width >= IMAGE_WIDTH.min && width <= IMAGE_WIDTH.max) out += ` width="${width}"`;
    }
  }
  return out;
}

function hasSrc(raw: string): boolean {
  ATTR.lastIndex = 0;
  for (const match of raw.matchAll(ATTR)) {
    if (
      (match[1] ?? "").toLowerCase() === "src" &&
      safeSrc(match[2] ?? match[3] ?? match[4] ?? "")
    ) {
      return true;
    }
  }
  return false;
}

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let out = "";
  let i = 0;
  const stack: string[] = [];

  while (i < input.length) {
    if (input.charAt(i) !== "<") {
      const next = input.indexOf("<", i);
      out += next === -1 ? input.slice(i) : input.slice(i, next);
      i = next === -1 ? input.length : next;
      continue;
    }
    if (input.startsWith("<!--", i)) {
      const end = input.indexOf("-->", i + 4);
      i = end === -1 ? input.length : end + 3;
      continue;
    }
    const close = input.indexOf(">", i + 1);
    if (close === -1) break;
    const raw = input.slice(i + 1, close);
    i = close + 1;

    const closing = raw.startsWith("/");
    const body = raw.replace(/^\//, "").replace(/\/$/, "").trim();
    const match = /^([a-zA-Z][a-zA-Z0-9]*)/.exec(body);
    const tagName = match?.[1];
    if (!tagName) continue;
    const name = tagName.toLowerCase();
    const attrStr = body.slice(match[0].length);

    if (SKIP.has(name)) {
      if (!closing) {
        const endTag = `</${name}>`;
        const end = input.toLowerCase().indexOf(endTag, i);
        i = end === -1 ? input.length : end + endTag.length;
      }
      continue;
    }

    if (closing) {
      const idx = stack.lastIndexOf(name === "span" ? "mark" : name);
      if (idx === -1) continue;
      while (stack.length > idx) out += `</${stack.pop()}>`;
      continue;
    }

    let tag = name;
    if (name === "span") {
      const section = sectionLabel(attrStr);
      if (section) {
        const endTag = "</span>";
        const end = input.toLowerCase().indexOf(endTag, i);
        i = end === -1 ? input.length : end + endTag.length;
        out += `<span data-section="${section}" contenteditable="false">${section}</span>`;
        continue;
      }
      const ping = mentionId(attrStr);
      if (ping) {
        const endTag = "</span>";
        const end = input.toLowerCase().indexOf(endTag, i);
        const inner = end === -1 ? "" : input.slice(i, end);
        i = end === -1 ? input.length : end + endTag.length;
        const label = stripHtml(inner).replace(/^@+/, "").trim().slice(0, 60);
        out += mentionChip(ping, label || "someone");
        continue;
      }
      const rolePing = mentionId(attrStr, "data-mention-role");
      if (rolePing) {
        const endTag = "</span>";
        const end = input.toLowerCase().indexOf(endTag, i);
        const inner = end === -1 ? "" : input.slice(i, end);
        i = end === -1 ? input.length : end + endTag.length;
        const label = stripHtml(inner).replace(/^@+/, "").trim().slice(0, 60);
        out += roleMentionChip(rolePing, label || "role");
        continue;
      }
      if (!highlightSpan(attrStr)) continue;
      tag = "mark";
    } else if (!ALLOWED.has(name)) {
      continue;
    }

    if (tag === "img" && !hasSrc(attrStr)) continue;

    const attrs = attrsFor(tag, attrStr);
    if (tag === "img" && !attrs.includes("src=")) continue;
    if (tag === "a" && !attrs.includes("href=")) continue;

    if (VOID.has(tag)) {
      out += `<${tag}${attrs}>`;
      continue;
    }
    stack.push(tag);
    out += `<${tag}${attrs}>`;
  }

  while (stack.length) out += `</${stack.pop()}>`;
  return out.trim();
}
