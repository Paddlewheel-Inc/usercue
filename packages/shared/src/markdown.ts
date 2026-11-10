import { type ChangelogSection, changelogSectionChip, changelogSectionLabel } from "./changelog";
import { isPostHref, sanitizeHtml } from "./html";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkHref(value: string) {
  if (isPostHref(value)) return value;
  if (/^(?:https?:\/\/|mailto:)\S+$/i.test(value)) return value;
  if (/^[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?$/.test(value)) return `https://${value}`;
  return null;
}

function imageSrc(value: string) {
  return /^(?:https?:\/\/\S+|\/(?:api\/)?uploads\/[\w.-]+)$/i.test(value) ? value : null;
}

function wrapped(delimiter: string, char: string) {
  return `${delimiter}([^${char}\\s](?:[^${char}]*[^${char}\\s])?)${delimiter}`;
}

export interface InlineRule {
  source: string;
  render: (match: RegExpMatchArray) => string | null;
}

export const INLINE_RULES: InlineRule[] = [
  {
    source: String.raw`!\[([^\]]*)\]\(([^)\s]+)\)`,
    render: (m) => {
      const src = imageSrc(m[2] ?? "");
      return src ? `<img src="${src}" alt="${m[1] ?? ""}">` : null;
    },
  },
  {
    source: String.raw`(?<!!)\[([^\]]+)\]\(([^)\s]+)\)`,
    render: (m) => {
      const href = linkHref(m[2] ?? "");
      return href ? `<a href="${href}">${m[1]}</a>` : null;
    },
  },
  { source: wrapped(String.raw`\*\*`, "*"), render: (m) => `<b>${m[1]}</b>` },
  { source: wrapped("__", "_"), render: (m) => `<u>${m[1]}</u>` },
  { source: wrapped("==", "="), render: (m) => `<mark>${m[1]}</mark>` },
  {
    source: String.raw`(?<![\w*])${wrapped(String.raw`\*`, "*")}(?!\*)`,
    render: (m) => `<i>${m[1]}</i>`,
  },
  { source: String.raw`(?<!\w)${wrapped("_", "_")}(?!\w)`, render: (m) => `<i>${m[1]}</i>` },
];

const PASTED = INLINE_RULES.map((rule) => ({ ...rule, pattern: new RegExp(rule.source, "g") }));

export const MARKDOWN_HINT = new RegExp(
  [
    String.raw`^\s*(?:[-*+]|\d+[.)])\s`,
    String.raw`^#{1,3}\s`,
    ...INLINE_RULES.map((rule) => rule.source),
  ].join("|"),
  "m",
);

export function inlineMarkdown(text: string): string {
  const held: string[] = [];
  let out = escapeHtml(text);
  for (const rule of PASTED) {
    out = out.replace(rule.pattern, (...args) => {
      const html = rule.render(args.slice(0, -2) as RegExpMatchArray);
      if (!html) return args[0];
      held.push(html);
      return `\uE000${held.length - 1}\uE001`;
    });
  }
  return out.replace(/\uE000(\d+)\uE001/g, (_, i) => held[Number(i)] ?? "");
}

export interface MarkdownOptions {
  headings?: boolean;
  sections?: boolean;
}

const LIST_ITEM = /^\s*(?:([-*+])|\d+[.)])\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const SECTION_HEADING = /^(#{1,3})\s+([A-Za-z]+):?\s*$/;
const SECTION_TAG = /^\[([A-Za-z]+)\]\s*(.*)$/;

function sectionHtml(label: ChangelogSection, text: string) {
  return `<div>${changelogSectionChip(label)} ${inlineMarkdown(text)}</div>`;
}

export function markdownToHtml(text: string, options: MarkdownOptions = {}): string {
  const { headings = false, sections = false } = options;
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let section: ChangelogSection | null = null;
  let afterSection = false;

  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const line of lines) {
    if (afterSection && !line.trim()) continue;
    afterSection = false;
    const named = sections ? SECTION_HEADING.exec(line) : null;
    const heading = named ? changelogSectionLabel(named[2] ?? "") : null;
    if (heading) {
      closeList();
      section = heading;
      afterSection = true;
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const content = item[2] ?? "";
      const tagged = sections ? SECTION_TAG.exec(content) : null;
      const label = tagged ? changelogSectionLabel(tagged[1] ?? "") : null;
      if (section || label) {
        closeList();
        out.push(
          sectionHtml(
            label ?? (section as ChangelogSection),
            label ? (tagged?.[2] ?? "") : content,
          ),
        );
        continue;
      }
      const kind = item[1] ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inlineMarkdown(content)}</li>`);
      continue;
    }
    closeList();

    const title = headings ? HEADING.exec(line) : null;
    if (title) {
      const tag = title[1]?.length === 3 ? "h3" : "h2";
      if (tag === "h2") section = null;
      afterSection = sections;
      out.push(`<${tag}>${inlineMarkdown(title[2] ?? "")}</${tag}>`);
      continue;
    }

    const tagged = sections ? SECTION_TAG.exec(line) : null;
    const label = tagged ? changelogSectionLabel(tagged[1] ?? "") : null;
    if (label) {
      out.push(sectionHtml(label, tagged?.[2] ?? ""));
    } else if (lines.length === 1) {
      out.push(inlineMarkdown(line));
    } else if (line.trim()) {
      out.push(`<div>${inlineMarkdown(line)}</div>`);
    } else {
      out.push("<div><br></div>");
      afterSection = sections;
    }
  }
  closeList();
  return sanitizeHtml(out.join(""));
}
