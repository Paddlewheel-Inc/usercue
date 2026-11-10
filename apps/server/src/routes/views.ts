import { vValidator } from "@hono/valibot-validator";
import { normalizeViewQuery, SAVED_VIEW_LIMITS } from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "../db";
import { type AppEnv, rateLimit, requireTeam } from "../middleware";

interface ViewRow {
  id: number;
  name: string;
  query: string;
}

const listViews = db.query<ViewRow>(
  "SELECT id, name, query FROM saved_views WHERE user_id = ? ORDER BY created_at, id",
);
const countViews = db.query<{ n: number }>(
  "SELECT COUNT(*)::int AS n FROM saved_views WHERE user_id = ?",
);
const insertView = db.query<ViewRow>(
  "INSERT INTO saved_views (user_id, name, query) VALUES (?, ?, ?) RETURNING id, name, query",
);
const deleteView = db.query<{ id: number }>(
  "DELETE FROM saved_views WHERE id = ? AND user_id = ? RETURNING id",
);

const idParam = v.object({
  id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});
const viewBody = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(SAVED_VIEW_LIMITS.name)),
  query: v.pipe(v.string(), v.maxLength(1000)),
});

const serialize = (row: ViewRow) => ({ id: row.id, name: row.name, query: row.query });

export const views = new Hono<AppEnv>()
  .use(requireTeam)

  .get("/", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return c.json((await listViews.all(user.id)).map(serialize));
  })

  .post("/", rateLimit(30, 60), vValidator("json", viewBody), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { name, query } = c.req.valid("json");
    if (((await countViews.get(user.id))?.n ?? 0) >= SAVED_VIEW_LIMITS.perUser) {
      return c.json({ error: `You can save up to ${SAVED_VIEW_LIMITS.perUser} views.` }, 400);
    }
    const clean = normalizeViewQuery(query);
    if (!clean) return c.json({ error: "Choose at least one filter first." }, 400);
    const row = await insertView.get(user.id, name, clean);
    if (!row) return c.json({ error: "Could not save that view." }, 500);
    return c.json(serialize(row), 201);
  })

  .delete("/:id", vValidator("param", idParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const deleted = await deleteView.get(c.req.valid("param").id, user.id);
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
