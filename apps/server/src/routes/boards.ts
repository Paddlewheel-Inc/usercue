import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { type BoardRow, db } from "../db";
import { type AppEnv, requirePermission } from "../middleware";

const listBoards = db.query<BoardRow>("SELECT id, slug, name FROM boards ORDER BY id");
const insertBoard = db.query<BoardRow>(
  "INSERT INTO boards (slug, name) VALUES (?, ?) RETURNING id, slug, name",
);
const renameBoard = db.query<BoardRow>(
  "UPDATE boards SET name = ? WHERE slug = ? RETURNING id, slug, name",
);
const deleteBoard = db.query<{ id: number }>("DELETE FROM boards WHERE slug = ? RETURNING id");

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const boards = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listBoards.all()))

  .post(
    "/",
    requirePermission("manage_boards"),
    vValidator(
      "json",
      v.object({ name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)) }),
    ),
    async (c) => {
      const { name } = c.req.valid("json");
      const slug = slugify(name);
      if (!slug) return c.json({ error: "Invalid name" }, 400);

      try {
        const board = await insertBoard.get(slug, name);
        if (!board) return c.json({ error: "Could not create board" }, 500);
        return c.json(board, 201);
      } catch {
        return c.json({ error: "A board with that name already exists" }, 409);
      }
    },
  )

  .patch(
    "/:slug",
    requirePermission("manage_boards"),
    vValidator("param", v.object({ slug: v.string() })),
    vValidator(
      "json",
      v.object({ name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)) }),
    ),
    async (c) => {
      const { slug } = c.req.valid("param");
      const { name } = c.req.valid("json");
      const board = await renameBoard.get(name, slug);
      if (!board) return c.json({ error: "Board not found" }, 404);
      return c.json(board);
    },
  )

  .delete(
    "/:slug",
    requirePermission("manage_boards"),
    vValidator("param", v.object({ slug: v.string() })),
    async (c) => {
      const { slug } = c.req.valid("param");
      const board = await deleteBoard.get(slug);
      if (!board) return c.json({ error: "Board not found" }, 404);
      return c.json({ ok: true });
    },
  );
