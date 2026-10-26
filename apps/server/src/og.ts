import { Resvg } from "@resvg/resvg-js";
import { ACCENTS, isHexColor, STATUS_LABELS, type Status, stripHtml } from "@usercue/shared";
import satori from "satori";
import { db } from "./db";
import type { Branding } from "./workspace";

const DESCRIPTION_LIMIT = 200;
const DEFAULT_ACCENT = "#ff2b87";

type Style = Record<string, string | number>;

interface El {
  type: string;
  props: { style: Style; children?: El | El[] | string };
}

function el(type: string, style: Style, children?: El | El[] | string): El {
  return { type, props: children === undefined ? { style } : { style, children } };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function excerpt(source: string, fallback: string): string {
  const text = stripHtml(source).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > DESCRIPTION_LIMIT
    ? `${text.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : text;
}

export function accentHex(value: string): string {
  if (isHexColor(value)) return value.toLowerCase();
  return ACCENTS.find((item) => item.id === value)?.hex ?? DEFAULT_ACCENT;
}

export interface OgPost {
  id: number;
  title: string;
  body: string;
  status: Status;
  author_name: string;
  board_name: string;
  created_at: number;
}

export interface OgEntry {
  id: number;
  title: string;
  body: string;
  image_url: string;
  created_at: number;
  updated_at: number;
}

export const ogPost = db.query<OgPost>(
  `SELECT p.id, p.title, p.body, p.status, p.author_name, b.name AS board_name, p.created_at
   FROM posts p JOIN boards b ON b.id = p.board_id WHERE p.id = ?`,
);

export const ogEntry = db.query<OgEntry>(
  "SELECT id, title, body, image_url, created_at, updated_at FROM changelog_entries WHERE id = ?",
);

interface Meta {
  site: string;
  type: "website" | "article";
  title: string;
  description: string;
  url: string;
  image: string;
  favicon: string;
  publishedTime?: number;
}

function absolute(origin: string, url: string): string {
  return url.startsWith("/") ? `${origin}${url}` : url;
}

export function metaTags(meta: Meta): string {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    `<link rel="icon" href="${escapeHtml(meta.favicon)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(meta.site)}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`,
  ];
  if (meta.publishedTime) {
    const iso = new Date(meta.publishedTime * 1000).toISOString();
    tags.push(`<meta property="article:published_time" content="${iso}" />`);
  }
  return tags.join("\n    ");
}

export function siteMeta(origin: string, path: string, branding: Branding): Meta {
  return {
    site: branding.name,
    type: "website",
    title: branding.name,
    description: branding.description,
    url: `${origin}${path}`,
    image: absolute(origin, branding.shareImageUrl),
    favicon: branding.faviconUrl,
  };
}

export function postMeta(origin: string, post: OgPost, branding: Branding): Meta {
  return {
    site: branding.name,
    type: "article",
    favicon: branding.faviconUrl,
    title: `${post.title} · ${branding.name}`,
    description: excerpt(post.body, `${STATUS_LABELS[post.status]} · ${post.board_name}`),
    url: `${origin}/post/${post.id}`,
    image: `${origin}/api/og/post/${post.id}.png`,
    publishedTime: post.created_at,
  };
}

export function entryMeta(origin: string, entry: OgEntry, branding: Branding): Meta {
  const custom = entry.image_url.trim();
  return {
    site: branding.name,
    type: "article",
    favicon: branding.faviconUrl,
    title: `${entry.title} · ${branding.name}`,
    description: excerpt(entry.body, `${branding.name} changelog`),
    url: `${origin}/changelog/${entry.id}`,
    image: custom ? absolute(origin, custom) : `${origin}/api/og/changelog/${entry.id}.png`,
    publishedTime: entry.created_at,
  };
}

export function injectMeta(base: string, tags: string): string {
  const cleaned = base
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta[^>]+(?:property|name)="(?:og:|twitter:|description)[^"]*"[^>]*>\s*/gi, "")
    .replace(/<link[^>]+rel="(?:canonical|icon)"[^>]*>\s*/gi, "");
  if (cleaned.includes("</head>")) {
    return cleaned.replace("</head>", `  ${tags}\n  </head>`);
  }
  return `${tags}\n${cleaned}`;
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" };

let fontsPromise: Promise<Font[]> | null = null;

function loadFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all([
    Bun.file(new URL("../assets/Geist-Regular.ttf", import.meta.url)).arrayBuffer(),
    Bun.file(new URL("../assets/Geist-SemiBold.ttf", import.meta.url)).arrayBuffer(),
    Bun.file(new URL("../assets/NotoColorEmoji-Regular.ttf", import.meta.url)).arrayBuffer(),
  ]).then(([regular, semibold, emoji]) => [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Emoji", data: emoji, weight: 400 as const, style: "normal" as const },
  ]);
  return fontsPromise;
}

function card(options: {
  site: string;
  accent: string;
  chip: string;
  meta: string;
  title: string;
  body: string;
  author?: string;
}): El {
  const accent = accentHex(options.accent);
  const text = (value: string, style: Style): El => el("div", style, value);
  return el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: 1200,
      height: 630,
      boxSizing: "border-box",
      backgroundColor: "#141210",
      color: "#f5f3f0",
      fontFamily: "Geist",
      padding: 64,
    },
    [
      el("div", { display: "flex", alignItems: "center", gap: 16 }, [
        el(
          "div",
          {
            display: "flex",
            alignItems: "center",
            backgroundColor: accent,
            color: "#ffffff",
            padding: "8px 20px",
            borderRadius: 999,
            fontSize: 26,
            fontWeight: 600,
          },
          options.chip,
        ),
        text(options.meta, { display: "flex", fontSize: 26, color: "#a8a29e" }),
      ]),
      text(options.title, {
        display: "flex",
        marginTop: 40,
        fontSize: 66,
        fontWeight: 600,
        lineHeight: 1.15,
        maxHeight: 240,
        overflow: "hidden",
      }),
      text(options.body, {
        display: "flex",
        marginTop: 26,
        fontSize: 30,
        fontWeight: 400,
        color: "#b8b2ac",
        lineHeight: 1.45,
        maxHeight: 140,
        overflow: "hidden",
      }),
      el("div", { display: "flex", flexGrow: 1 }),
      el("div", { display: "flex", alignItems: "center", justifyContent: "space-between" }, [
        text(options.author ?? "", { display: "flex", fontSize: 28, color: "#a8a29e" }),
        el("div", { display: "flex", alignItems: "center", gap: 14 }, [
          el("div", {
            display: "flex",
            width: 36,
            height: 36,
            borderRadius: 9,
            backgroundColor: accent,
          }),
          text(options.site, { display: "flex", fontSize: 32, fontWeight: 600 }),
        ]),
      ]),
    ],
  );
}

async function rasterize(markup: El): Promise<Uint8Array> {
  const svg = await satori(markup as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: await loadFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
  return new Uint8Array(png);
}

function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = (h * 33) ^ value.charCodeAt(i);
  return ((h >>> 0) + value.length).toString(36);
}

const cache = new Map<string, Uint8Array>();

function cached(key: string, make: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return make().then((buffer) => {
    cache.set(key, buffer);
    if (cache.size > 200) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return buffer;
  });
}

export function renderPostCard(post: OgPost, accent: string, site: string): Promise<Uint8Array> {
  const key = `post:${post.id}:${post.status}:${post.title.length}:${hash(post.body)}:${accent}:${hash(site)}`;
  return cached(key, () =>
    rasterize(
      card({
        site,
        accent,
        chip: STATUS_LABELS[post.status],
        meta: post.board_name,
        title: post.title,
        body: excerpt(post.body, ""),
        author: `by ${post.author_name}`,
      }),
    ),
  );
}

export function renderEntryCard(entry: OgEntry, accent: string, site: string): Promise<Uint8Array> {
  const key = `entry:${entry.id}:${entry.updated_at}:${entry.title.length}:${accent}:${hash(site)}`;
  return cached(key, () =>
    rasterize(
      card({
        site,
        accent,
        chip: "Changelog",
        meta: site,
        title: entry.title,
        body: excerpt(entry.body, ""),
      }),
    ),
  );
}

function hueFor(name: string): number {
  return [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
}

export function renderInitialsAvatar(name: string): Promise<Uint8Array> {
  const label = name.trim() || "?";
  const letter = label.charAt(0).toUpperCase();
  const hue = hueFor(label);
  const key = `avatar:${letter}:${hue}`;
  return cached(key, async () => {
    const svg = await satori(
      el(
        "div",
        {
          display: "flex",
          width: 128,
          height: 128,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `hsl(${hue}, 45%, 48%)`,
          color: "#ffffff",
          fontSize: 64,
          fontWeight: 600,
          fontFamily: "Geist",
        },
        letter,
      ) as unknown as Parameters<typeof satori>[0],
      { width: 128, height: 128, fonts: await loadFonts() },
    );
    return new Uint8Array(new Resvg(svg).render().asPng());
  });
}
