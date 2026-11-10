import { vValidator } from "@hono/valibot-validator";
import { IMPORT_LIMITS, LIMITS, WEBHOOK_EVENT_IDS, WEBHOOK_LIMITS } from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { listAudit, recordAudit } from "../audit";
import { importPosts } from "../importer";
import { type AppEnv, requirePermission } from "../middleware";
import {
  countWebhooks,
  createWebhook,
  deleteWebhook,
  listWebhooks,
  parseWebhookUrl,
  pingWebhook,
  serializeWebhook,
  updateWebhook,
} from "../webhooks";

const MAX_AUDIT_PAGE = 100;
const MAX_ROW_VOTES = IMPORT_LIMITS.votes;

const positiveInt = v.pipe(v.number(), v.integer(), v.minValue(1));
const idParam = v.object({
  id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});
const queryNumber = (min: number, max: number) =>
  v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(min), v.maxValue(max));

const webhookName = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(WEBHOOK_LIMITS.name));
const webhookEvents = v.pipe(
  v.array(v.picklist(WEBHOOK_EVENT_IDS)),
  v.minLength(1),
  v.transform((events) => [...new Set(events)]),
);
const webhookUrl = v.pipe(v.string(), v.trim(), v.maxLength(WEBHOOK_LIMITS.url));

const postRow = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
  body: v.pipe(v.string(), v.maxLength(LIMITS.body * 4)),
  status: v.pipe(v.string(), v.maxLength(80)),
  board: v.pipe(v.string(), v.maxLength(80)),
  authorName: v.pipe(v.string(), v.maxLength(120)),
  authorEmail: v.pipe(v.string(), v.maxLength(200)),
  votes: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_ROW_VOTES)),
  createdAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_102_444_800))),
  tags: v.pipe(v.array(v.pipe(v.string(), v.maxLength(80))), v.maxLength(20)),
});

export const integrations = new Hono<AppEnv>()
  .use(requirePermission("manage_settings"))

  .get("/webhooks", async (c) => {
    return c.json((await listWebhooks()).map(serializeWebhook));
  })

  .post(
    "/webhooks",
    vValidator("json", v.object({ name: webhookName, url: webhookUrl, events: webhookEvents })),
    async (c) => {
      const input = c.req.valid("json");
      const url = parseWebhookUrl(input.url);
      if (!url) return c.json({ error: "Enter a valid http or https URL." }, 400);
      if ((await countWebhooks()) >= WEBHOOK_LIMITS.perWorkspace) {
        return c.json({ error: `You can add up to ${WEBHOOK_LIMITS.perWorkspace} webhooks.` }, 400);
      }
      const created = await createWebhook(input, url);
      if (!created) return c.json({ error: "Could not save that webhook." }, 500);
      await recordAudit(c, "webhook.created", `Added webhook “${input.name}”`);
      return c.json({ ...serializeWebhook(created.row), secret: created.secret }, 201);
    },
  )

  .patch(
    "/webhooks/:id",
    vValidator("param", idParam),
    vValidator(
      "json",
      v.object({
        name: v.optional(webhookName),
        url: v.optional(webhookUrl),
        events: v.optional(webhookEvents),
        enabled: v.optional(v.boolean()),
      }),
    ),
    async (c) => {
      const patch = c.req.valid("json");
      const url = patch.url === undefined ? undefined : parseWebhookUrl(patch.url);
      if (url === null) return c.json({ error: "Enter a valid http or https URL." }, 400);
      const row = await updateWebhook(c.req.valid("param").id, { ...patch, url });
      if (!row) return c.json({ error: "Not found" }, 404);
      await recordAudit(c, "webhook.updated", `Updated webhook “${row.name}”`);
      return c.json(serializeWebhook(row));
    },
  )

  .delete("/webhooks/:id", vValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const webhook = (await listWebhooks()).find((row) => row.id === id);
    if (!webhook || !(await deleteWebhook(id))) return c.json({ error: "Not found" }, 404);
    await recordAudit(c, "webhook.deleted", `Removed webhook “${webhook.name}”`);
    return c.json({ ok: true });
  })

  .post("/webhooks/:id/test", vValidator("param", idParam), async (c) => {
    const result = await pingWebhook(c.req.valid("param").id);
    if (!result) return c.json({ error: "Not found" }, 404);
    return c.json({
      ok: result.error === "",
      status: result.status || null,
      message: result.error,
    });
  })

  .post(
    "/import/posts",
    vValidator(
      "json",
      v.object({
        rows: v.pipe(v.array(postRow), v.minLength(1), v.maxLength(IMPORT_LIMITS.batch)),
      }),
    ),
    async (c) => {
      const { rows } = c.req.valid("json");
      const votes = rows.reduce((sum, row) => sum + row.votes, 0);
      if (votes > IMPORT_LIMITS.votes) {
        return c.json({ error: "That batch has too many votes. Send fewer rows at a time." }, 400);
      }
      return c.json(await importPosts(rows));
    },
  )

  .post("/import/done", vValidator("json", v.object({ count: positiveInt })), async (c) => {
    const { count } = c.req.valid("json");
    await recordAudit(c, "import.posts", `Imported ${count} posts`);
    return c.json({ ok: true });
  })

  .get(
    "/audit",
    vValidator(
      "query",
      v.object({
        before: v.optional(queryNumber(1, Number.MAX_SAFE_INTEGER)),
        limit: v.optional(queryNumber(1, MAX_AUDIT_PAGE), "50"),
      }),
    ),
    async (c) => {
      const { before, limit } = c.req.valid("query");
      return c.json(await listAudit(before ?? null, limit));
    },
  );
