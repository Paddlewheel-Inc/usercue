import type { Permission } from "@usercue/shared";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { db } from "./db";
import { env } from "./env";
import { hasPermission, parsePermissions } from "./roles";
import { hashSecret } from "./secret";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  roleId: number | null;
  roleName: string | null;
  roleIcon: string | null;
  permissions: Permission[];
  staff: boolean;
  suspended: boolean;
  hasPassword: boolean;
  emailUpdates: boolean;
  emailDigest: boolean;
}

export interface VisitorIdentity {
  name: string;
  provider: string;
}

export type AppEnv = {
  Variables: {
    visitorId: string;
    user: SessionUser | null;
    identity: VisitorIdentity | null;
    apiKeyId: number | null;
  };
};

const YEAR = 60 * 60 * 24 * 365;
const EMBED_VISITOR_ID = /^[A-Za-z0-9_-]{16,64}$/;
export const SESSION_TTL = 60 * 60 * 24 * 30;

export function randomToken(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}

export function setCookieSafe(c: Context, name: string, value: string, maxAge: number) {
  setCookie(c, name, value, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.cookieSecure,
    path: "/",
    maxAge,
  });
}

interface SessionRow {
  id: number;
  email: string | null;
  name: string;
  avatar_url: string | null;
  role_id: number | null;
  suspended: number;
  has_password: number;
  email_updates: number;
  email_digest: number;
  permissions: string | null;
  role_name: string | null;
  role_icon: string | null;
}

const findSession = db.query<SessionRow, [string, number]>(
  `SELECT u.id, u.email, u.name, u.avatar_url, u.role_id, u.suspended,
          u.email_updates, u.email_digest,
          CASE WHEN u.password_hash <> '' THEN 1 ELSE 0 END AS has_password,
          r.permissions, r.name AS role_name, r.icon_url AS role_icon
   FROM sessions s
   JOIN users u ON u.id = s.user_id
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE s.id = ? AND s.expires_at > ?`,
);

const findIdentity = db.query<VisitorIdentity, [string]>(
  "SELECT name, provider FROM identities WHERE visitor_id = ?",
);
const deleteIdentity = db.query("DELETE FROM identities WHERE visitor_id = ?");

interface ApiKeySessionRow extends SessionRow {
  api_key_id: number;
  api_key_permissions: string;
}

const findApiKeySession = db.query<ApiKeySessionRow>(
  `SELECT k.id AS api_key_id, u.id, u.email, u.name, u.avatar_url, u.role_id, u.suspended,
          u.email_updates, u.email_digest,
          CASE WHEN u.password_hash <> '' THEN 1 ELSE 0 END AS has_password,
          r.permissions, r.name AS role_name, r.icon_url AS role_icon,
          k.permissions AS api_key_permissions
   FROM api_keys k
   JOIN users u ON u.id = k.user_id
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE k.key_hash = ?`,
);
const markApiKeyUsed = db.query(
  "UPDATE api_keys SET last_used_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = ?",
);

export function toPublicUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    roleId: user.roleId,
    roleName: user.roleName,
    roleIcon: user.roleIcon,
    permissions: user.permissions,
    staff: user.staff,
    suspended: user.suspended,
    hasPassword: user.hasPassword,
    emailUpdates: user.emailUpdates,
    emailDigest: user.emailDigest,
  };
}

function toSessionUser(row: SessionRow): SessionUser {
  const permissions = parsePermissions(row.permissions);
  return {
    id: row.id,
    email: row.email ?? "",
    name: row.name,
    avatarUrl: row.avatar_url || null,
    roleId: row.role_id,
    roleName: row.role_name,
    roleIcon: row.role_icon || null,
    permissions,
    staff: hasPermission(permissions, "dashboard"),
    suspended: row.suspended === 1,
    hasPassword: row.has_password === 1,
    emailUpdates: row.email_updates === 1,
    emailDigest: row.email_digest === 1,
  };
}

export const identify = createMiddleware<AppEnv>(async (c, next) => {
  let visitorId = getCookie(c, "vid");
  if (!visitorId) {
    const embedded = c.req.header("x-visitor-id");
    if (embedded && EMBED_VISITOR_ID.test(embedded)) {
      visitorId = embedded;
    } else {
      visitorId = randomToken(16);
      setCookieSafe(c, "vid", visitorId, YEAR);
    }
  }
  c.set("visitorId", visitorId);

  const sid = getCookie(c, "sid");
  const row = sid ? await findSession.get(sid, Math.floor(Date.now() / 1000)) : undefined;
  c.set("user", row ? toSessionUser(row) : null);
  c.set("apiKeyId", null);

  const identity = (await findIdentity.get(visitorId)) ?? null;
  if (!row && identity) {
    await deleteIdentity.run(visitorId);
    c.set("identity", null);
  } else {
    c.set("identity", identity);
  }

  await next();
});

function apiKeyMiddleware(required: boolean): MiddlewareHandler<AppEnv> {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (c.get("apiKeyId") !== null) return next();

    const authorization = c.req.header("Authorization");
    if (!authorization) {
      if (required) return c.json({ error: "API key required" }, 401);
      return next();
    }

    const match = /^Bearer\s+(uc_[A-Za-z0-9_-]+)$/i.exec(authorization);
    const token = match?.[1];
    if (!token) return c.json({ error: "Invalid API key" }, 401);

    const row = await findApiKeySession.get(hashSecret(token));
    if (!row) return c.json({ error: "Invalid API key" }, 401);

    const owner = toSessionUser(row);
    const permissions = parsePermissions(row.api_key_permissions).filter((permission) =>
      owner.permissions.includes(permission),
    );
    const user: SessionUser = {
      ...owner,
      permissions,
      staff: hasPermission(permissions, "dashboard"),
    };
    if (user.suspended) return c.json({ error: "Your account has been suspended." }, 403);

    c.set("user", user);
    c.set("identity", null);
    c.set("visitorId", `api-key:${row.api_key_id}`);
    c.set("apiKeyId", row.api_key_id);
    await markApiKeyUsed.run(row.api_key_id);
    await next();
  });
}

export const authenticateApiKey = apiKeyMiddleware(false);
export const requireApiKey = apiKeyMiddleware(true);

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

export function requirePermission(...needed: Permission[]): MiddlewareHandler<AppEnv> {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.suspended) return c.json({ error: "Your account has been suspended." }, 403);
    if (!needed.some((permission) => hasPermission(user.permissions, permission))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

export const requireTeam = requirePermission("dashboard");

export function rateLimit(limit: number, windowSeconds: number): MiddlewareHandler<AppEnv> {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const now = Date.now();
    const key = `${c.get("visitorId")}:${c.req.method}:${c.req.routePath}`;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
    } else if (++entry.count > limit) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  };
}
