import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { LIMITS } from "@usercue/shared";
import { Hono } from "hono";
import { db } from "../db";
import { env } from "../env";
import { type AppEnv, randomToken, rateLimit } from "../middleware";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const VIDEO_EXT = new Set(["mp4", "webm", "mov"]);
const VIDEO_FILE = /^[A-Za-z0-9_-]{16,}\.(mp4|webm|mov)$/;
const VIDEO_PER_HOUR = 8;
const ORPHAN_VIDEO_MS = 60 * 60 * 1000;

const videoHits = new Map<string, { count: number; resetAt: number }>();

const videoReferenced = db.query<{ ok: number }>(
  `SELECT 1 AS ok WHERE EXISTS (SELECT 1 FROM posts WHERE body LIKE ? ESCAPE '!')
    OR EXISTS (SELECT 1 FROM comments WHERE body LIKE ? ESCAPE '!')
    OR EXISTS (SELECT 1 FROM post_notes WHERE body LIKE ? ESCAPE '!')
    OR EXISTS (SELECT 1 FROM changelog_entries WHERE body LIKE ? ESCAPE '!')
    OR EXISTS (SELECT 1 FROM changelog_comments WHERE body LIKE ? ESCAPE '!')`,
);

export function uploadsDir(): string {
  return join(env.dataDir, "uploads");
}

function extension(file: File): string | null {
  const fromType = TYPES[file.type];
  if (fromType) return fromType;
  if (file.type !== "" && file.type !== "application/octet-stream") return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXT.has(ext) ? ext : null;
}

export function videoHeaderMatches(ext: string, header: Uint8Array): boolean {
  if (ext === "webm") {
    return (
      header.length >= 4 &&
      header[0] === 0x1a &&
      header[1] === 0x45 &&
      header[2] === 0xdf &&
      header[3] === 0xa3
    );
  }
  if (ext !== "mp4" && ext !== "mov") return false;
  if (header.length < 12) return false;
  const box = String.fromCharCode(header[4] ?? 0, header[5] ?? 0, header[6] ?? 0, header[7] ?? 0);
  if (box !== "ftyp") return false;
  const brand = String.fromCharCode(
    header[8] ?? 0,
    header[9] ?? 0,
    header[10] ?? 0,
    header[11] ?? 0,
  );
  return /^[\x20-\x7e]{4}$/.test(brand);
}

function allowVideo(visitorId: string): boolean {
  const now = Date.now();
  const entry = videoHits.get(visitorId);
  if (!entry || entry.resetAt <= now) {
    videoHits.set(visitorId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= VIDEO_PER_HOUR;
}

function likeName(name: string): string {
  return `%${name.replaceAll("!", "!!").replaceAll("%", "!%").replaceAll("_", "!_")}%`;
}

async function sweepOrphanVideos(dir: string) {
  const now = Date.now();
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!VIDEO_FILE.test(name)) continue;
    const path = join(dir, name);
    let mtime = 0;
    try {
      mtime = statSync(path).mtimeMs;
    } catch {
      continue;
    }
    if (now - mtime < ORPHAN_VIDEO_MS) continue;
    const pattern = likeName(name);
    const used = await videoReferenced.get(pattern, pattern, pattern, pattern, pattern);
    if (used) continue;
    try {
      unlinkSync(path);
    } catch {}
  }
}

function fileResponse(file: Bun.BunFile, type: string, range: string | undefined) {
  const size = file.size;
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (!range) {
    headers["Content-Length"] = String(size);
    return new Response(file, { headers });
  }
  if (!match || (match[1] === "" && match[2] === "")) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const suffix = match[1] === "";
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffix ? size - 1 : match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const last = Math.min(end, size - 1);
  headers["Content-Range"] = `bytes ${start}-${last}/${size}`;
  headers["Content-Length"] = String(last - start + 1);
  return new Response(file.slice(start, last + 1), { status: 206, headers });
}

export const uploads = new Hono<AppEnv>()
  .post("/", rateLimit(10, 60), async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "Choose a file to upload" }, 400);

    const ext = extension(file);
    if (!ext) {
      return c.json(
        { error: "Use a JPEG, PNG, GIF, or SVG image, or an MP4, WebM, or MOV video" },
        400,
      );
    }
    const video = VIDEO_EXT.has(ext);
    const max = video ? LIMITS.videoBytes : LIMITS.imageBytes;
    if (file.size > max) {
      return c.json(
        { error: video ? "Video is too large (max 32 MB)" : "Image is too large (max 1.5 MB)" },
        400,
      );
    }
    if (video) {
      const user = c.get("user");
      if (user?.suspended) return c.json({ error: "Your account has been suspended." }, 403);
      if (!user && !c.get("identity")) return c.json({ error: "Sign in to upload a video" }, 401);
      const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
      if (!videoHeaderMatches(ext, header)) {
        return c.json({ error: "That file is not a valid MP4, WebM, or MOV video" }, 400);
      }
      if (!allowVideo(c.get("visitorId"))) {
        return c.json({ error: "Too many videos. Try again later." }, 429);
      }
    }

    const name = `${randomToken(16)}.${ext}`;
    const dir = uploadsDir();
    mkdirSync(dir, { recursive: true });
    await Bun.write(join(dir, name), file);
    if (video) {
      try {
        await sweepOrphanVideos(dir);
      } catch (err) {
        console.error(err);
      }
    }
    return c.json({ url: `/api/uploads/${name}` }, 201);
  })
  .get("/:name", async (c) => {
    const name = c.req.param("name");
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return c.json({ error: "Not found" }, 404);
    const file = Bun.file(join(uploadsDir(), name));
    if (!(await file.exists())) return c.json({ error: "Not found" }, 404);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return fileResponse(file, CONTENT_TYPES[ext] ?? file.type, c.req.header("range"));
  });
