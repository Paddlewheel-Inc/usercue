import { vValidator } from "@hono/valibot-validator";
import {
  ACCENT_IDS,
  ASSIGNMENT_MODES,
  isHexColor,
  PERMISSION_META,
  PERMISSIONS,
  type Permission,
  SITE_LIMITS,
} from "@usercue/shared";
import { Hono } from "hono";
import * as v from "valibot";
import { db } from "../db";
import { env } from "../env";
import { resendConfigured, resendCredentials, resendEnabled, sendInviteEmail } from "../mail";
import { type AppEnv, randomToken, requirePermission, requireTeam } from "../middleware";
import { discordConfigured, isDiscordWebhook, isTeamsWebhook, teamsConfigured } from "../notify";
import { publicOrigin } from "../oauth";
import {
  countOwners,
  countWithPermission,
  encodePermissions,
  isOwnerRole,
  memberRoleId,
  parsePermissions,
  staffRoleId,
} from "../roles";
import { smtpConfigured } from "../smtp";
import {
  getWorkspace,
  parseAccent,
  parseAssignmentMode,
  saveBranding,
  saveWorkspace,
} from "../workspace";

const INVITE_TTL = 60 * 60 * 24 * 7;
const countEnabledProviders = db.query<{ n: number }>(
  "SELECT COUNT(*)::int AS n FROM oauth_providers WHERE enabled = 1",
);
const countTags = db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM tags");

interface StaffRow {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: number;
  role_id: number | null;
  role_name: string | null;
  permissions: string | null;
}

interface InviteRow {
  id: number;
  token: string;
  email: string;
  created_at: number;
  expires_at: number;
  accepted_at: number | null;
  email_sent: number;
}

interface UserListRow {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: number;
  suspended: number;
  role_id: number | null;
  role_name: string | null;
  permissions: string | null;
}

interface RoleRow {
  id: number;
  name: string;
  locked: number;
  permissions: string;
  icon_url: string;
}

const listPeople = db.query<StaffRow>(
  `SELECT u.id, u.email, u.name, u.avatar_url, u.created_at, u.role_id, r.name AS role_name, r.permissions
   FROM users u
   LEFT JOIN roles r ON r.id = u.role_id
   ORDER BY u.created_at, u.id`,
);
const listUsers = db.query<UserListRow>(
  `SELECT u.id, u.email, u.name, u.avatar_url, u.created_at, u.suspended, u.role_id, r.name AS role_name, r.permissions
   FROM users u
   LEFT JOIN roles r ON r.id = u.role_id
   ORDER BY u.created_at DESC, u.id DESC`,
);
const findPerson = db.query<UserListRow>(
  `SELECT u.id, u.email, u.name, u.avatar_url, u.created_at, u.suspended, u.role_id, r.name AS role_name, r.permissions
   FROM users u
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE u.id = ?`,
);
const findUserByEmail = db.query<{ id: number }>("SELECT id FROM users WHERE email = ?");
const deleteUser = db.query("DELETE FROM users WHERE id = ?");
const setSuspended = db.query("UPDATE users SET suspended = ? WHERE id = ?");
const setUserRole = db.query("UPDATE users SET role_id = ? WHERE id = ?");

const listRoles = db.query<RoleRow>(
  "SELECT id, name, locked, permissions, icon_url FROM roles ORDER BY position, id",
);
const findRole = db.query<RoleRow>(
  "SELECT id, name, locked, permissions, icon_url FROM roles WHERE id = ?",
);
const findRoleByName = db.query<{ id: number }>(
  "SELECT id FROM roles WHERE lower(name) = lower(?)",
);
const insertRole = db.query<RoleRow>(
  `INSERT INTO roles (name, locked, permissions, icon_url, position)
   VALUES (?, 0, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM roles))
   RETURNING id, name, locked, permissions, icon_url`,
);
const updateRole = db.query<RoleRow>(
  "UPDATE roles SET name = ?, permissions = ?, icon_url = ? WHERE id = ? RETURNING id, name, locked, permissions, icon_url",
);
const deleteRole = db.query("DELETE FROM roles WHERE id = ? AND locked = 0");
const setRolePosition = db.query("UPDATE roles SET position = ? WHERE id = ?");
const countRoleUsers = db.query<{ n: number }>(
  "SELECT COUNT(*)::int AS n FROM users WHERE role_id = ?",
);

const listInvites = db.query<InviteRow>(
  `SELECT id, token, email, created_at, expires_at, accepted_at, email_sent
   FROM invites
   WHERE accepted_at IS NULL AND expires_at > ?
   ORDER BY created_at DESC`,
);
const findInviteByEmail = db.query<InviteRow>(
  `SELECT id, token, email, created_at, expires_at, accepted_at, email_sent
   FROM invites
   WHERE email = ? AND accepted_at IS NULL AND expires_at > ?`,
);
const insertInvite = db.query<InviteRow>(
  `INSERT INTO invites (token, email, invited_by, expires_at)
   VALUES (?, ?, ?, ?)
   RETURNING id, token, email, created_at, expires_at, accepted_at, email_sent`,
);
const refreshInvite = db.query<InviteRow>(
  `UPDATE invites SET token = ?, expires_at = ?, email_sent = ?, created_at = EXTRACT(EPOCH FROM NOW())::BIGINT
   WHERE id = ?
   RETURNING id, token, email, created_at, expires_at, accepted_at, email_sent`,
);
const markInviteSent = db.query("UPDATE invites SET email_sent = 1 WHERE id = ?");
const deleteInvite = db.query("DELETE FROM invites WHERE id = ? AND accepted_at IS NULL");

function inviteUrl(origin: string, token: string) {
  return `${origin}/join/${token}`;
}

function serializeInvite(origin: string, row: InviteRow) {
  return {
    id: row.id,
    email: row.email,
    url: inviteUrl(origin, row.token),
    expiresAt: row.expires_at,
    emailSent: row.email_sent === 1,
  };
}

function isStaffRow(row: { permissions: string | null }) {
  return parsePermissions(row.permissions).includes("dashboard");
}

function serializeUser(row: UserListRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url || null,
    createdAt: row.created_at,
    suspended: row.suspended === 1,
    roleId: row.role_id,
    roleName: row.role_name,
    staff: isStaffRow(row),
  };
}

function serializeRole(row: RoleRow, userCount = 0) {
  return {
    id: row.id,
    name: row.name,
    locked: row.locked === 1,
    permissions: parsePermissions(row.permissions),
    iconUrl: row.icon_url || null,
    userCount,
  };
}

async function snapshot(origin: string) {
  const workspace = await getWorkspace();
  const creds = await resendCredentials();
  const now = Math.floor(Date.now() / 1000);
  return {
    allowGuestFeedback: workspace.allow_guest_feedback === 1,
    changelogEnabled: workspace.changelog_enabled === 1,
    changelogComments: workspace.changelog_comments === 1,
    changelogReactions: workspace.changelog_reactions === 1,
    changelogRssUrl: workspace.changelog_enabled === 1 ? `${origin}/api/changelog/rss` : null,
    assignmentMode: parseAssignmentMode(workspace.assignment_mode),
    accent: parseAccent(workspace.accent),
    logoUrl: workspace.logo_url.trim() || null,
    logoDarkUrl: workspace.logo_dark_url.trim() || null,
    siteName: workspace.site_name.trim() || null,
    siteDescription: workspace.site_description.trim() || null,
    faviconUrl: workspace.favicon_url.trim() || null,
    shareImageUrl: workspace.share_image_url.trim() || null,
    resend: {
      configured: await resendConfigured(),
      enabled: await resendEnabled(),
      from: workspace.resend_from || env.resendFrom || null,
      keyHash: workspace.resend_key_hash ? workspace.resend_key_hash.slice(0, 12) : null,
      fromEnv: Boolean(!workspace.resend_key_cipher && creds),
    },
    smtp: {
      configured: await smtpConfigured(),
      enabled: workspace.smtp_enabled === 1,
      host: workspace.smtp_host || env.smtpHost || null,
      port: workspace.smtp_host ? workspace.smtp_port : env.smtpPort,
      user: workspace.smtp_host ? workspace.smtp_user : env.smtpUser,
      from: workspace.smtp_from || env.smtpFrom || null,
      secure: workspace.smtp_host ? workspace.smtp_secure === 1 : env.smtpSecure,
      passConfigured: Boolean(workspace.smtp_pass_cipher || env.smtpPass),
      fromEnv: !workspace.smtp_host && Boolean(env.smtpHost || env.smtpFrom),
    },
    discord: {
      configured: await discordConfigured(),
      enabled: workspace.discord_enabled === 1,
      keyHash: workspace.discord_webhook_hash ? workspace.discord_webhook_hash.slice(0, 12) : null,
    },
    teams: {
      configured: await teamsConfigured(),
      enabled: workspace.teams_enabled === 1,
      keyHash: workspace.teams_webhook_hash ? workspace.teams_webhook_hash.slice(0, 12) : null,
    },
    oauthOnly: workspace.oauth_only === 1,
    customerTags: workspace.customer_tags === 1,
    customerTagsRequired: workspace.customer_tags === 1 && workspace.customer_tags_required === 1,
    staff: (await listPeople.all()).filter(isStaffRow).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url || null,
      createdAt: row.created_at,
      roleName: row.role_name,
    })),
    invites: (await listInvites.all(now)).map((row) => serializeInvite(origin, row)),
  };
}

async function rolesPayload() {
  const roles = await listRoles.all();
  const counts = await Promise.all(roles.map((role) => countRoleUsers.get(role.id)));
  return {
    roles: roles.map((role, i) => serializeRole(role, counts[i]?.n ?? 0)),
    catalog: PERMISSIONS.map((id) => ({ id, ...PERMISSION_META[id] })),
  };
}

const permissionList = v.pipe(
  v.array(v.picklist(PERMISSIONS)),
  v.transform((items) => [...new Set(items)] as Permission[]),
);

const accentValue = v.pipe(
  v.string(),
  v.trim(),
  v.check(
    (value) => ACCENT_IDS.some((id) => id === value) || isHexColor(value),
    "Pick a preset or a #rrggbb hex color.",
  ),
);

const uploadUrl = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(200),
  v.check(
    (value) => !value || /^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(value),
    "Use an uploaded image.",
  ),
);

export const settings = new Hono<AppEnv>()
  .get("/", requireTeam, async (c) => c.json(await snapshot(publicOrigin(c))))

  .patch(
    "/",
    requirePermission("manage_settings"),
    vValidator(
      "json",
      v.object({
        allowGuestFeedback: v.optional(v.boolean()),
        changelogEnabled: v.optional(v.boolean()),
        changelogComments: v.optional(v.boolean()),
        changelogReactions: v.optional(v.boolean()),
        assignmentMode: v.optional(v.picklist(ASSIGNMENT_MODES)),
        resendEnabled: v.optional(v.boolean()),
        resendFrom: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        resendApiKey: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        smtpHost: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        smtpEnabled: v.optional(v.boolean()),
        smtpPort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535))),
        smtpUser: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        smtpPass: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        smtpFrom: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        smtpSecure: v.optional(v.boolean()),
        discordEnabled: v.optional(v.boolean()),
        discordWebhookUrl: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
        teamsEnabled: v.optional(v.boolean()),
        teamsWebhookUrl: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2000))),
        oauthOnly: v.optional(v.boolean()),
        customerTags: v.optional(v.boolean()),
        customerTagsRequired: v.optional(v.boolean()),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      const current = await getWorkspace();
      const from = body.resendFrom !== undefined ? body.resendFrom.trim() : current.resend_from;
      const hasKey = Boolean(
        body.resendApiKey?.trim() || current.resend_key_cipher || env.resendApiKey,
      );
      const hasFrom = Boolean(from || env.resendFrom);
      if (body.resendEnabled && (!hasKey || !hasFrom)) {
        return c.json({ error: "Add a Resend API key and from address first." }, 400);
      }
      const smtpHost = body.smtpHost !== undefined ? body.smtpHost.trim() : current.smtp_host;
      const smtpFrom = body.smtpFrom !== undefined ? body.smtpFrom.trim() : current.smtp_from;
      if ((smtpHost && !smtpFrom) || (!smtpHost && smtpFrom)) {
        return c.json({ error: "Add both an SMTP host and from address." }, 400);
      }
      const hasSmtpHost = Boolean(smtpHost || env.smtpHost);
      const hasSmtpFrom = Boolean(smtpFrom || env.smtpFrom);
      if (body.smtpEnabled && (!hasSmtpHost || !hasSmtpFrom)) {
        return c.json({ error: "Add an SMTP host and from address first." }, 400);
      }
      const webhook = body.discordWebhookUrl?.trim();
      if (webhook && !isDiscordWebhook(webhook)) {
        return c.json({ error: "Enter a valid Discord webhook URL." }, 400);
      }
      if (body.discordEnabled && !webhook && !current.discord_webhook_cipher) {
        return c.json({ error: "Add a Discord webhook URL first." }, 400);
      }
      const teamsUrl = body.teamsWebhookUrl?.trim();
      if (teamsUrl && !isTeamsWebhook(teamsUrl)) {
        return c.json({ error: "Enter a valid Teams webhook URL." }, 400);
      }
      if (body.teamsEnabled && !teamsUrl && !current.teams_webhook_cipher) {
        return c.json({ error: "Add a Teams webhook URL first." }, 400);
      }
      if (body.customerTagsRequired) {
        const tags = await countTags.get();
        if (!tags?.n) return c.json({ error: "Add a tag before requiring one." }, 400);
      }
      if (body.oauthOnly) {
        const enabled = await countEnabledProviders.get();
        if (!enabled?.n) {
          return c.json(
            { error: "Turn on a sign-in method before requiring a connected account." },
            400,
          );
        }
      }
      await saveWorkspace(body);
      return c.json(await snapshot(publicOrigin(c)));
    },
  )

  .patch(
    "/branding",
    requirePermission("manage_branding"),
    vValidator(
      "json",
      v.object({
        accent: v.optional(accentValue),
        logoUrl: v.optional(uploadUrl),
        logoDarkUrl: v.optional(uploadUrl),
        faviconUrl: v.optional(uploadUrl),
        shareImageUrl: v.optional(uploadUrl),
        siteName: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(SITE_LIMITS.name))),
        siteDescription: v.optional(
          v.pipe(v.string(), v.trim(), v.maxLength(SITE_LIMITS.description)),
        ),
      }),
    ),
    async (c) => {
      await saveBranding(c.req.valid("json"));
      return c.json(await snapshot(publicOrigin(c)));
    },
  )

  .get("/users", requirePermission("manage_users"), async (c) =>
    c.json({ users: (await listUsers.all()).map(serializeUser) }),
  )

  .patch(
    "/users/:id",
    requirePermission("manage_users"),
    vValidator("param", v.object({ id: v.string() })),
    vValidator(
      "json",
      v.object({
        suspended: v.optional(v.boolean()),
        roleId: v.optional(v.pipe(v.number(), v.integer())),
      }),
    ),
    async (c) => {
      const id = Number(c.req.valid("param").id);
      if (!Number.isInteger(id)) return c.json({ error: "Invalid user" }, 400);
      const person = await findPerson.get(id);
      if (!person) return c.json({ error: "User not found" }, 404);
      const actor = c.get("user");
      if (actor?.id === id)
        return c.json({ error: "You cannot change your own account here." }, 400);

      const body = c.req.valid("json");
      if (body.suspended !== undefined) {
        if ((await isOwnerRole(person.role_id)) && (await countOwners()) <= 1 && body.suspended) {
          return c.json({ error: "The workspace needs at least one owner." }, 400);
        }
        await setSuspended.run(body.suspended ? 1 : 0, id);
      }

      if (body.roleId !== undefined) {
        const role = await findRole.get(body.roleId);
        if (!role) return c.json({ error: "Role not found" }, 404);
        if ((await isOwnerRole(person.role_id)) && (await countOwners()) <= 1) {
          return c.json({ error: "The workspace needs at least one owner." }, 400);
        }
        await setUserRole.run(role.id, id);
      }

      return c.json({ user: serializeUser((await findPerson.get(id)) ?? person) });
    },
  )

  .delete(
    "/users/:id",
    requirePermission("manage_users"),
    vValidator("param", v.object({ id: v.string() })),
    async (c) => {
      const id = Number(c.req.valid("param").id);
      if (!Number.isInteger(id)) return c.json({ error: "Invalid user" }, 400);
      const person = await findPerson.get(id);
      if (!person) return c.json({ error: "User not found" }, 404);
      if (c.get("user")?.id === id) return c.json({ error: "You cannot delete yourself." }, 400);
      if ((await isOwnerRole(person.role_id)) && (await countOwners()) <= 1) {
        return c.json({ error: "The workspace needs at least one owner." }, 400);
      }
      await deleteUser.run(id);
      return c.json({ ok: true });
    },
  )

  .get("/roles", requirePermission("manage_roles", "manage_users"), async (c) =>
    c.json(await rolesPayload()),
  )

  .post(
    "/roles",
    requirePermission("manage_roles"),
    vValidator(
      "json",
      v.object({
        name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
        permissions: v.optional(permissionList, []),
        iconUrl: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
      }),
    ),
    async (c) => {
      const { name, permissions, iconUrl } = c.req.valid("json");
      if (await findRoleByName.get(name)) {
        return c.json({ error: "A role with that name already exists." }, 409);
      }
      const row = await insertRole.get(name, encodePermissions(permissions), iconUrl ?? "");
      if (!row) return c.json({ error: "Could not create the role." }, 500);
      return c.json(await rolesPayload(), 201);
    },
  )

  .patch(
    "/roles/order",
    requirePermission("manage_roles"),
    vValidator(
      "json",
      v.object({
        ids: v.pipe(
          v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
          v.minLength(1),
          v.maxLength(100),
        ),
      }),
    ),
    async (c) => {
      const { ids } = c.req.valid("json");
      const roles = await listRoles.all();
      const known = new Set(roles.map((role) => role.id));
      const complete =
        ids.length === roles.length &&
        new Set(ids).size === ids.length &&
        ids.every((id) => known.has(id));
      if (!complete) return c.json({ error: "Send every role in the new order." }, 400);
      await db.transaction(async () => {
        for (const [position, id] of ids.entries()) {
          await setRolePosition.run(position, id);
        }
      });
      return c.json(await rolesPayload());
    },
  )

  .patch(
    "/roles/:id",
    requirePermission("manage_roles"),
    vValidator("param", v.object({ id: v.string() })),
    vValidator(
      "json",
      v.object({
        name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40))),
        permissions: v.optional(permissionList),
        iconUrl: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
      }),
    ),
    async (c) => {
      const id = Number(c.req.valid("param").id);
      if (!Number.isInteger(id)) return c.json({ error: "Invalid role" }, 400);
      const role = await findRole.get(id);
      if (!role) return c.json({ error: "Role not found" }, 404);

      const body = c.req.valid("json");
      if (role.locked === 1 && body.permissions !== undefined) {
        return c.json({ error: "This role's permissions are locked." }, 400);
      }

      const name = body.name?.trim() || role.name;
      if (name.toLowerCase() !== role.name.toLowerCase() && (await findRoleByName.get(name))) {
        return c.json({ error: "A role with that name already exists." }, 409);
      }
      const permissions = body.permissions ?? parsePermissions(role.permissions);
      const iconUrl = body.iconUrl !== undefined ? body.iconUrl : role.icon_url;
      await updateRole.run(name, encodePermissions(permissions), iconUrl, id);
      return c.json(await rolesPayload());
    },
  )

  .delete(
    "/roles/:id",
    requirePermission("manage_roles"),
    vValidator("param", v.object({ id: v.string() })),
    async (c) => {
      const id = Number(c.req.valid("param").id);
      if (!Number.isInteger(id)) return c.json({ error: "Invalid role" }, 400);
      const role = await findRole.get(id);
      if (!role) return c.json({ error: "Role not found" }, 404);
      if (role.locked === 1) return c.json({ error: "This role cannot be deleted." }, 400);
      if (((await countRoleUsers.get(id))?.n ?? 0) > 0) {
        return c.json({ error: "Reassign users before deleting this role." }, 400);
      }
      await deleteRole.run(id);
      return c.json(await rolesPayload());
    },
  )

  .post(
    "/invites",
    requirePermission("manage_staff"),
    vValidator(
      "json",
      v.object({
        email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
      }),
    ),
    async (c) => {
      const { email } = c.req.valid("json");
      const existing = await findUserByEmail.get(email);
      if (existing) {
        const person = await findPerson.get(existing.id);
        if (person && isStaffRow(person)) {
          return c.json({ error: "That email already has a staff account." }, 409);
        }
        await setUserRole.run(await staffRoleId(), existing.id);
        const fresh = await findPerson.get(existing.id);
        return c.json({
          promoted: true,
          email,
          name: fresh?.name ?? person?.name ?? email,
        });
      }

      const origin = publicOrigin(c);
      const now = Math.floor(Date.now() / 1000);
      const token = randomToken(24);
      const pending = await findInviteByEmail.get(email, now);
      const invitedBy = c.get("user")?.id ?? null;
      const row = pending
        ? await refreshInvite.get(token, now + INVITE_TTL, 0, pending.id)
        : await insertInvite.get(token, email, invitedBy, now + INVITE_TTL);
      if (!row) return c.json({ error: "Could not create the invite." }, 500);

      void sendInviteEmail(email, inviteUrl(origin, row.token))
        .then(async (result) => {
          if (result.sent) await markInviteSent.run(row.id);
          else if (
            result.error !== "SMTP email is not configured" &&
            result.error !== "Invite email is turned off"
          ) {
            console.error("Could not send invite email:", result.error);
          }
        })
        .catch((error: unknown) => {
          console.error("Could not send invite email:", error);
        });

      return c.json({
        ...serializeInvite(origin, row),
        emailSent: false,
      });
    },
  )

  .delete(
    "/invites/:id",
    requirePermission("manage_staff"),
    vValidator("param", v.object({ id: v.string() })),
    async (c) => {
      const id = Number(c.req.valid("param").id);
      if (!Number.isInteger(id)) return c.json({ error: "Invalid invite" }, 400);
      await deleteInvite.run(id);
      return c.json(await snapshot(publicOrigin(c)));
    },
  )

  .delete(
    "/staff/:id",
    requirePermission("manage_staff"),
    vValidator("param", v.object({ id: v.string() })),
    async (c) => {
      const id = Number(c.req.valid("param").id);
      if (!Number.isInteger(id)) return c.json({ error: "Invalid staff member" }, 400);
      if (c.get("user")?.id === id) return c.json({ error: "You cannot remove yourself." }, 400);
      const person = await findPerson.get(id);
      if (!person) return c.json({ error: "Staff member not found" }, 404);
      if ((await isOwnerRole(person.role_id)) && (await countOwners()) <= 1) {
        return c.json({ error: "The workspace needs at least one owner." }, 400);
      }
      if ((await countWithPermission("dashboard")) <= 1) {
        return c.json({ error: "The workspace needs at least one staff member." }, 400);
      }
      await setUserRole.run(await memberRoleId(), id);
      return c.json(await snapshot(publicOrigin(c)));
    },
  );
