import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { type AppEnv, identify } from "./middleware";
import { auth } from "./routes/auth";
import { boards } from "./routes/boards";
import { changelog } from "./routes/changelog";
import { oauth } from "./routes/oauth";
import { og } from "./routes/og";
import { people } from "./routes/people";
import { posts } from "./routes/posts";
import { settings } from "./routes/settings";
import { tags } from "./routes/tags";
import { uploads } from "./routes/uploads";

const api = new Hono<AppEnv>()
  .use(identify)
  .route("/auth", auth)
  .route("/auth", oauth)
  .route("/boards", boards)
  .route("/posts", posts)
  .route("/changelog", changelog)
  .route("/people", people)
  .route("/og", og)
  .route("/settings", settings)
  .route("/tags", tags)
  .route("/uploads", uploads);

export const app = new Hono()
  .use(secureHeaders())
  .route("/api", api)
  .onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

export type AppType = typeof app;
