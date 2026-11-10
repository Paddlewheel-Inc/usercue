import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import * as v from "valibot";
import { aiAvailable } from "../ai";
import { db } from "../db";
import {
  type AppEnv,
  randomToken,
  rateLimit,
  requireUser,
  SESSION_TTL,
  setCookieSafe,
  toPublicUser,
} from "../middleware";
import { ownerRoleId, staffRoleId } from "../roles";
import {
  assignmentMode,
  changelogFlags,
  customerTagMode,
  guestsAllowed,
  oauthOnly,
  triageBoardSlugs,
  workspaceAccent,
  workspaceBranding,
  workspaceLogos,
} from "../workspace";

const credentials = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(200)),
});

const setupSchema = v.object({
  ...credentials.entries,
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
});

const userCount = db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
const insertUser = db.query<{ id: number }>(
  "INSERT INTO users (email, name, password_hash, role_id) VALUES (?, ?, ?, ?) RETURNING id",
);
const updateProfile = db.query(
  `UPDATE users SET
     name = ?,
     password_hash = CASE WHEN ? <> '' THEN ? ELSE password_hash END,
     avatar_url = CASE WHEN ? = 1 THEN ? ELSE avatar_url END
   WHERE id = ?`,
);
const updateEmailPreferences = db.query(
  `UPDATE users
   SET email_updates = COALESCE($updates::int, email_updates),
       email_digest = COALESCE($digest::int, email_digest)
   WHERE id = $id`,
);
const insertBoard = db.query(
  "INSERT INTO boards (slug, name) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING",
);
const findUser = db.query<{ id: number; password_hash: string }>(
  "SELECT id, password_hash FROM users WHERE email = ?",
);
const findPassword = db.query<{ password_hash: string }>(
  "SELECT password_hash FROM users WHERE id = ?",
);
const insertSession = db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)");
const deleteSession = db.query("DELETE FROM sessions WHERE id = ?");
const findInvite = db.query<{
  id: number;
  email: string;
  expires_at: number;
  accepted_at: number | null;
}>("SELECT id, email, expires_at, accepted_at FROM invites WHERE token = ?");
const acceptInvite = db.query("UPDATE invites SET accepted_at = ? WHERE id = ?");

async function startSession(c: Parameters<typeof setCookieSafe>[0], userId: number) {
  const id = randomToken();
  await insertSession.run(id, userId, Math.floor(Date.now() / 1000) + SESSION_TTL);
  setCookieSafe(c, "sid", id, SESSION_TTL);
}

const needsSetup = async () => ((await userCount.get())?.n ?? 0) === 0;

export const auth = new Hono<AppEnv>()
  .get("/me", async (c) => {
    const user = c.get("user");
    const logos = await workspaceLogos();
    const branding = await workspaceBranding();
    return c.json({
      user: user ? toPublicUser(user) : null,
      identity: c.get("identity"),
      needsSetup: await needsSetup(),
      allowGuestFeedback: await guestsAllowed(),
      customerTags: (await customerTagMode()).allowed,
      customerTagsRequired: (await customerTagMode()).required,
      changelogEnabled: (await changelogFlags()).enabled,
      assignmentMode: await assignmentMode(),
      aiEnabled: user?.staff ? await aiAvailable() : false,
      triageBoards: user?.staff ? await triageBoardSlugs() : [],
      accent: await workspaceAccent(),
      logoUrl: logos.light,
      logoDarkUrl: logos.dark,
      siteName: branding.name,
      faviconUrl: branding.faviconUrl,
    });
  })

  .patch(
    "/me",
    requireUser,
    vValidator(
      "json",
      v.object({
        name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60))),
        password: v.optional(v.pipe(v.string(), v.minLength(8), v.maxLength(200))),
        currentPassword: v.optional(v.pipe(v.string(), v.maxLength(200))),
        avatarUrl: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        emailUpdates: v.optional(v.boolean()),
        emailDigest: v.optional(v.boolean()),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const body = c.req.valid("json");
      const name = body.name?.trim() || user.name;
      if (body.avatarUrl && !/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(body.avatarUrl)) {
        return c.json({ error: "Upload a JPEG, PNG, or SVG image." }, 400);
      }
      let hash = "";
      if (body.password) {
        if (user.hasPassword) {
          const current = body.currentPassword ?? "";
          const row = await findPassword.get(user.id);
          const matches =
            current.length > 0 &&
            Boolean(row?.password_hash) &&
            (await Bun.password.verify(current, row?.password_hash ?? ""));
          if (!matches) return c.json({ error: "Current password is incorrect." }, 400);
        }
        hash = await Bun.password.hash(body.password);
      }
      await updateProfile.run(
        name,
        hash,
        hash,
        body.avatarUrl === undefined ? 0 : 1,
        body.avatarUrl ?? "",
        user.id,
      );
      if (body.emailUpdates !== undefined || body.emailDigest !== undefined) {
        await updateEmailPreferences.run({
          id: user.id,
          updates: body.emailUpdates === undefined ? null : Number(body.emailUpdates),
          digest: body.emailDigest === undefined ? null : Number(body.emailDigest),
        });
      }
      return c.json({
        ok: true,
        user: toPublicUser({
          ...user,
          emailUpdates: body.emailUpdates ?? user.emailUpdates,
          emailDigest: body.emailDigest ?? user.emailDigest,
          name,
          avatarUrl: body.avatarUrl === undefined ? user.avatarUrl : body.avatarUrl || null,
          hasPassword: Boolean(hash) || user.hasPassword,
        }),
      });
    },
  )

  .post("/setup", rateLimit(10, 60), vValidator("json", setupSchema), async (c) => {
    if (!(await needsSetup())) return c.json({ error: "Already set up" }, 403);

    const { email, name, password } = c.req.valid("json");
    const hash = await Bun.password.hash(password);
    const row = await insertUser.get(email, name, hash, await ownerRoleId());
    if (!row) return c.json({ error: "Could not create user" }, 500);

    await insertBoard.run("feature-requests", "Feature requests");
    await startSession(c, row.id);
    return c.json({ ok: true });
  })

  .post("/login", rateLimit(10, 60), vValidator("json", credentials), async (c) => {
    if (await oauthOnly()) {
      return c.json({ error: "Sign in with a connected account." }, 403);
    }
    const { email, password } = c.req.valid("json");
    const user = await findUser.get(email);

    if (
      !user ||
      !user.password_hash ||
      !(await Bun.password.verify(password, user.password_hash))
    ) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    await startSession(c, user.id);
    return c.json({ ok: true });
  })

  .post("/logout", async (c) => {
    const sid = getCookie(c, "sid");
    if (sid) await deleteSession.run(sid);
    deleteCookie(c, "sid", { path: "/" });
    return c.json({ ok: true });
  })

  .get("/invite/:token", async (c) => {
    const token = c.req.param("token");
    const row = await findInvite.get(token);
    if (!row) return c.json({ error: "This invite is invalid or has expired." }, 404);
    if (row.accepted_at) return c.json({ error: "This invite has already been used." }, 410);
    if (row.expires_at <= Math.floor(Date.now() / 1000)) {
      return c.json({ error: "This invite has expired." }, 410);
    }
    return c.json({ email: row.email });
  })

  .post("/invite/:token", rateLimit(10, 60), vValidator("json", setupSchema), async (c) => {
    const token = c.req.param("token");
    const row = await findInvite.get(token);
    if (!row || row.accepted_at || row.expires_at <= Math.floor(Date.now() / 1000)) {
      return c.json({ error: "This invite is invalid or has expired." }, 404);
    }

    const { email, name, password } = c.req.valid("json");
    if (email !== row.email) return c.json({ error: "Use the invited email address." }, 400);
    if (await findUser.get(email))
      return c.json({ error: "That email already has an account." }, 409);

    const hash = await Bun.password.hash(password);
    const created = await insertUser.get(email, name, hash, await staffRoleId());
    if (!created) return c.json({ error: "Could not create your account." }, 500);
    await acceptInvite.run(Math.floor(Date.now() / 1000), row.id);
    await startSession(c, created.id);
    return c.json({ ok: true });
  });
