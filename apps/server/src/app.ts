import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { type AppEnv, identify, requireApiKey } from "./middleware";
import { auth } from "./routes/auth";
import { boards } from "./routes/boards";
import { changelog } from "./routes/changelog";
import { notifications } from "./routes/notifications";
import { oauth, oauthProviders } from "./routes/oauth";
import { og } from "./routes/og";
import { people } from "./routes/people";
import { posts } from "./routes/posts";
import { settings } from "./routes/settings";
import { tags } from "./routes/tags";
import { uploads } from "./routes/uploads";
import { workflow } from "./routes/workflow";

const publicApi = new Hono<AppEnv>()
  .use("*", requireApiKey)
  .route("/workflow", workflow)
  .route("/boards", boards)
  .route("/posts", posts)
  .route("/tags", tags)
  .route("/settings", settings)
  .route("/changelog", changelog)
  .route("/auth", oauthProviders);

const api = new Hono<AppEnv>()
  .use(identify)
  .route("/v1", publicApi)
  .route("/auth", auth)
  .route("/auth", oauth)
  .route("/workflow", workflow)
  .route("/boards", boards)
  .route("/posts", posts)
  .route("/changelog", changelog)
  .route("/notifications", notifications)
  .route("/people", people)
  .route("/og", og)
  .route("/settings", settings)
  .route("/tags", tags)
  .route("/uploads", uploads);

export const app = new Hono()
  .use(secureHeaders())
  .route("/api", api)
  .onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

export type AppType = typeof app;
