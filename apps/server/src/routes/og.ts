import { Hono } from "hono";
import type { AppEnv } from "../middleware";
import { ogEntry, ogPost, renderEntryCard, renderInitialsAvatar, renderPostCard } from "../og";
import { changelogFlags, workspaceAccent, workspaceBranding } from "../workspace";

function idFromFile(file: string): number | null {
  const match = /^(\d+)\.png$/.exec(file);
  return match ? Number(match[1]) : null;
}

const headers = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=300",
};

export const og = new Hono<AppEnv>()
  .get("/avatar.png", async (c) => {
    const raw = (c.req.query("name") ?? "?").normalize("NFKC");
    const name =
      raw
        .replace(/[^\p{L}\p{N} ._'-]/gu, "")
        .trim()
        .slice(0, 80) || "?";
    const png = await renderInitialsAvatar(name);
    return new Response(Buffer.from(png), {
      status: 200,
      headers: { ...headers, "Cache-Control": "public, max-age=86400" },
    });
  })

  .get("/post/:file", async (c) => {
    const id = idFromFile(c.req.param("file"));
    if (!id) return c.notFound();
    const post = await ogPost.get(id);
    if (!post) return c.notFound();
    const png = await renderPostCard(
      post,
      await workspaceAccent(),
      (await workspaceBranding()).name,
    );
    return new Response(png as unknown as BodyInit, { status: 200, headers });
  })

  .get("/changelog/:file", async (c) => {
    const id = idFromFile(c.req.param("file"));
    if (!id) return c.notFound();
    if (!(await changelogFlags()).enabled) return c.notFound();
    const entry = await ogEntry.get(id);
    if (!entry) return c.notFound();
    const png = await renderEntryCard(
      entry,
      await workspaceAccent(),
      (await workspaceBranding()).name,
    );
    return new Response(png as unknown as BodyInit, { status: 200, headers });
  });
