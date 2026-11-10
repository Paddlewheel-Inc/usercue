import { relative } from "node:path";
import type { Context } from "hono";
import { serveStatic } from "hono/bun";
import { app } from "./app";
import { initDb } from "./db";
import { env } from "./env";
import { startJobs } from "./jobs";
import { redirectTarget } from "./merge";
import { publicOrigin } from "./oauth";
import { entryMeta, injectMeta, metaTags, ogEntry, ogPost, postMeta, siteMeta } from "./og";
import { initRoles } from "./roles";
import { changelogFlags, workspaceBranding } from "./workspace";

await initDb();
await initRoles();
startJobs();

app.use("/uploads/*", serveStatic({ root: env.dataDir }));

if (env.production) {
  const root = relative(process.cwd(), `${import.meta.dir}/../../web/dist`);
  const indexPath = `${import.meta.dir}/../../web/dist/index.html`;
  let baseHtml: string | null = null;
  const shell = async () => {
    baseHtml ??= await Bun.file(indexPath).text();
    return baseHtml;
  };

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  const page = async (c: Context) => {
    const tags = metaTags(siteMeta(publicOrigin(c), c.req.path, await workspaceBranding()));
    return c.html(injectMeta(await shell(), tags), 200, { "Cache-Control": "no-cache" });
  };

  app.get("/", page);

  app.get("/post/:id", async (c) => {
    const base = await shell();
    const id = Number(c.req.param("id"));
    const post = Number.isInteger(id) ? await ogPost.get(id) : null;
    if (!post) {
      const target = Number.isInteger(id) ? await redirectTarget(id) : null;
      return target ? c.redirect(`/post/${target}`, 301) : page(c);
    }
    const tags = metaTags(postMeta(publicOrigin(c), post, await workspaceBranding()));
    return c.html(injectMeta(base, tags), 200, { "Cache-Control": "public, max-age=60" });
  });

  app.get("/changelog/:id", async (c) => {
    const base = await shell();
    const id = Number(c.req.param("id"));
    const entry = Number.isInteger(id) ? await ogEntry.get(id) : null;
    if (!entry || !(await changelogFlags()).enabled) return page(c);
    const tags = metaTags(entryMeta(publicOrigin(c), entry, await workspaceBranding()));
    return c.html(injectMeta(base, tags), 200, { "Cache-Control": "public, max-age=60" });
  });

  for (const path of ["/sw.js", "/registerSW.js", "/index.html"]) {
    app.use(path, async (c, next) => {
      await next();
      c.header("Cache-Control", "no-cache");
    });
  }

  app.use("*", serveStatic({ root, precompressed: true }));
  app.get("*", page);
}

if (env.production) {
  console.log(`usercue listening on http://localhost:${env.port}`);
} else {
  console.log(`usercue app  http://localhost:5173`);
  console.log(`usercue api  http://localhost:${env.port}`);
}

export default {
  port: env.port,
  fetch: app.fetch,
};
