import { Hono } from "hono";
import { version } from "../../../package.json";

// Register before session middleware so inspection does not require authentication or a DB query.
export const versionRoutes = new Hono().get("/version", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ version, revision: process.env.USERCUE_REVISION ?? "unknown" });
});
