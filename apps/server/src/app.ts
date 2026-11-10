import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { EMBED_SCRIPT } from "./embed";
import { type AppEnv, identify, requireApiKey, toPublicUser } from "./middleware";
import { ai } from "./routes/ai";
import { auth } from "./routes/auth";
import { boards } from "./routes/boards";
import { changelog } from "./routes/changelog";
import { inbound } from "./routes/inbound";
import { integrations } from "./routes/integrations";
import { notifications } from "./routes/notifications";
import { oauth, oauthProviders } from "./routes/oauth";
import { og } from "./routes/og";
import { people } from "./routes/people";
import { posts } from "./routes/posts";
import { settings } from "./routes/settings";
import { tags } from "./routes/tags";
import { triage } from "./routes/triage";
import { uploads } from "./routes/uploads";
import { views } from "./routes/views";
import { workflow } from "./routes/workflow";
import { versionRoutes } from "./version";

const publicApi = new Hono<AppEnv>()
  .use("*", requireApiKey)
  .route("/workflow", workflow)
  .route("/boards", boards)
  .route("/posts", triage)
  .route("/posts", posts)
  .route("/tags", tags)
  .route("/settings", settings)
  .route("/integrations", integrations)
  .route("/changelog", changelog)
  .route("/auth", oauthProviders)
  .get("/me", (c) => {
    const user = c.get("user");
    return user ? c.json(toPublicUser(user)) : c.json({ error: "Unauthorized" }, 401);
  });

const api = new Hono<AppEnv>()
  .use(identify)
  .route("/v1", publicApi)
  .route("/auth", auth)
  .route("/auth", oauth)
  .route("/workflow", workflow)
  .route("/boards", boards)
  .route("/posts", triage)
  .route("/posts", posts)
  .route("/changelog", changelog)
  .route("/notifications", notifications)
  .route("/people", people)
  .route("/og", og)
  .route("/settings", settings)
  .route("/tags", tags)
  .route("/uploads", uploads)
  .route("/views", views)
  .route("/ai", ai)
  .route("/integrations", integrations);

const isEmbedPath = (path: string) => path === "/embed" || path.startsWith("/embed/");

export const app = new Hono()
  .use((c, next) =>
    secureHeaders({ xFrameOptions: isEmbedPath(c.req.path) ? false : "SAMEORIGIN" })(c, next),
  )
  .get("/api/embed.js", (c) =>
    c.body(EMBED_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    }),
  )
  .route("/api/inbound", inbound)
  .route("/api", versionRoutes)
  .route("/api", api)
  .onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

export type AppType = typeof app;
