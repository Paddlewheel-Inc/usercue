import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { LIMITS } from "@usercue/shared";
import { Hono } from "hono";
import { env } from "../env";
import { type AppEnv, randomToken, rateLimit } from "../middleware";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export function uploadsDir(): string {
  return join(env.dataDir, "uploads");
}

export const uploads = new Hono<AppEnv>()
  .post("/", rateLimit(10, 60), async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "Choose an image to upload" }, 400);

    const ext = TYPES[file.type];
    if (!ext) return c.json({ error: "Use a JPEG, PNG, GIF, or SVG image" }, 400);
    if (file.size > LIMITS.imageBytes) {
      return c.json({ error: "Image is too large (max 1.5 MB)" }, 400);
    }

    const name = `${randomToken(16)}.${ext}`;
    const dir = uploadsDir();
    mkdirSync(dir, { recursive: true });
    await Bun.write(join(dir, name), file);
    return c.json({ url: `/api/uploads/${name}` }, 201);
  })
  .get("/:name", async (c) => {
    const name = c.req.param("name");
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return c.json({ error: "Not found" }, 404);
    const file = Bun.file(join(uploadsDir(), name));
    if (!(await file.exists())) return c.json({ error: "Not found" }, 404);
    return new Response(file, {
      headers: {
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });
