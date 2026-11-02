import { vValidator } from "@hono/valibot-validator";
import { STATUSES, WORKFLOW_ICONS, type WorkflowStatus } from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "../db";
import { type AppEnv, requirePermission } from "../middleware";
import { listWorkflow } from "../workflow";

const fields = {
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
  icon: v.picklist(WORKFLOW_ICONS),
  color: v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/)),
};
const update = db.query<WorkflowStatus>(
  "UPDATE workflow_statuses SET name = ?, icon = ?, color = ? WHERE id = ? RETURNING id, name, icon, color, category",
);
const insert = db.query<WorkflowStatus>(
  `INSERT INTO workflow_statuses (id, name, icon, color, category, position)
   VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM workflow_statuses))
   RETURNING id, name, icon, color, category`,
);

export const workflow = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listWorkflow.all()))
  .post(
    "/",
    requirePermission("manage_settings"),
    vValidator("json", v.object({ ...fields, category: v.picklist(STATUSES) })),
    async (c) => {
      const { name, icon, color, category } = c.req.valid("json");
      const status = await insert.get(
        `custom_${crypto.randomUUID()}`,
        name,
        icon,
        color.toLowerCase(),
        category,
      );
      if (!status) return c.json({ error: "Could not create status" }, 500);
      return c.json(status, 201);
    },
  )
  .patch(
    "/:id",
    requirePermission("manage_settings"),
    vValidator("json", v.object(fields)),
    async (c) => {
      const { name, icon, color } = c.req.valid("json");
      const status = await update.get(name, icon, color.toLowerCase(), c.req.param("id"));
      if (!status) return c.json({ error: "Status not found" }, 404);
      return c.json(status);
    },
  );
