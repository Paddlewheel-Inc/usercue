import { expect, test } from "bun:test";
import { version } from "../../../package.json";
import { versionRoutes } from "./version";

test("version inspection is available without a database or session and is never cached", async () => {
  const response = await versionRoutes.request("/version");
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    version,
    revision: process.env.USERCUE_REVISION ?? "unknown",
  });
});
