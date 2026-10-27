import { Hono } from "hono";
import { db } from "../db";
import { type AppEnv, rateLimit } from "../middleware";

interface PersonRow {
  id: number;
  name: string;
  avatar_url: string | null;
}

interface RoleRow {
  id: number;
  name: string;
  icon_url: string | null;
}

const listPeople = db.query<PersonRow>(
  `SELECT id, name, avatar_url
   FROM users
   WHERE suspended = 0
     AND ($q::text IS NULL OR lower(name) LIKE $q ESCAPE '\\')
   ORDER BY lower(name), id
   LIMIT 20`,
);

const listRoles = db.query<RoleRow>(
  `SELECT id, name, icon_url
   FROM roles
   WHERE ($q::text IS NULL OR lower(name) LIKE $q ESCAPE '\\')
   ORDER BY position, id
   LIMIT 10`,
);

const escapeLike = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

export const people = new Hono<AppEnv>().get("/", rateLimit(60, 60), async (c) => {
  const q = c.req.query("q")?.trim().slice(0, 60) ?? "";
  const params = { q: q ? escapeLike(q.toLowerCase()) : null };
  const viewer = c.get("user");
  const canPingRoles = Boolean(viewer?.staff && !viewer.suspended);
  const [rows, roleRows] = await Promise.all([
    listPeople.all(params),
    canPingRoles ? listRoles.all(params) : Promise.resolve([] as RoleRow[]),
  ]);
  return c.json({
    people: rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url || null,
    })),
    roles: roleRows.map((row) => ({
      id: row.id,
      name: row.name,
      iconUrl: row.icon_url || null,
    })),
  });
});
