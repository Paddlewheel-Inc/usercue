export interface Table {
  headers: string[];
  rows: Record<string, string>[];
}

export const IMPORT_LIMITS = { batch: 200, rows: 20_000, votes: 100_000 } as const;

export const POST_IMPORT_FIELDS = {
  title: ["title", "post title", "name", "feature", "feature name", "idea", "subject", "summary"],
  body: [
    "details",
    "description",
    "body",
    "content",
    "text",
    "post details",
    "feature description",
  ],
  status: ["status", "state"],
  board: ["board", "board name", "category", "project", "product"],
  authorName: [
    "author",
    "author name",
    "user",
    "user name",
    "created by",
    "creator",
    "submitted by",
    "customer",
  ],
  authorEmail: [
    "author email",
    "email",
    "user email",
    "creator email",
    "customer email",
    "submitter email",
  ],
  votes: ["votes", "vote count", "votes count", "number of votes", "upvotes", "likes", "score"],
  createdAt: [
    "created",
    "created at",
    "created date",
    "date created",
    "creation date",
    "date",
    "submitted",
    "posted at",
  ],
  tags: ["tags", "tag", "labels"],
} as const;
export type PostImportField = keyof typeof POST_IMPORT_FIELDS;

export type Mapping<F extends string> = Record<F, string | null>;

const DELIMITERS = [",", ";", "\t"] as const;

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best: string = ",";
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value.trim() !== ""));
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value);
}

function flatten(record: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        out[`${key} ${inner}`] = scalar(innerValue);
      }
    } else out[key] = scalar(value);
  }
  return out;
}

function tableFromRecords(records: Record<string, unknown>[]): Table {
  const rows = records.map(flatten);
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { headers, rows };
}

export function readTable(text: string): Table {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    const list = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed as Record<string, unknown>).find(Array.isArray);
    if (!Array.isArray(list)) return { headers: [], rows: [] };
    return tableFromRecords(
      list.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
      ),
    );
  }
  const [head, ...body] = parseCsv(text);
  if (!head) return { headers: [], rows: [] };
  const headers = head.map((name, i) => name.trim() || `Column ${i + 1}`);
  const rows = body.map((line) =>
    Object.fromEntries(headers.map((name, i) => [name, (line[i] ?? "").trim()])),
  );
  return { headers, rows };
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function guessMapping<F extends string>(
  headers: string[],
  fields: Record<F, readonly string[]>,
): Mapping<F> {
  const taken = new Set<string>();
  const normalized = headers.map((header) => [header, normalizeHeader(header)] as const);
  const mapping = {} as Mapping<F>;
  for (const field of Object.keys(fields) as F[]) {
    let found: string | null = null;
    for (const alias of fields[field]) {
      const match = normalized.find(([header, name]) => name === alias && !taken.has(header));
      if (match) {
        found = match[0];
        break;
      }
    }
    if (found) taken.add(found);
    mapping[field] = found;
  }
  return mapping;
}

export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.,-]/g, "");
  const decimalComma = !cleaned.includes(".") && /,\d{1,2}$/.test(cleaned);
  const amount = Number(decimalComma ? cleaned.replace(",", ".") : cleaned.replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

export function parseTimestamp(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.floor(numeric >= 1e12 ? numeric / 1000 : numeric);
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

export function splitList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

const CATEGORY_HINTS = [
  [
    "closed",
    ["closed", "declin", "reject", "won t", "wont", "not planned", "duplicate", "archiv", "cancel"],
  ],
  [
    "complete",
    ["complete", "done", "shipped", "released", "launched", "delivered", "resolved", "live"],
  ],
  ["in_progress", ["progress", "started", "building", "developing", "underway", "doing", "wip"]],
  ["planned", ["plan", "roadmap", "approved", "scheduled", "backlog", "accepted", "next"]],
] as const;

export type StatusCategory = "open" | "planned" | "in_progress" | "complete" | "closed";

export function guessCategory(text: string): StatusCategory {
  const value = normalizeHeader(text);
  for (const [category, hints] of CATEGORY_HINTS) {
    if (hints.some((hint) => value.includes(hint))) return category;
  }
  return "open";
}
