import { vValidator } from "@hono/valibot-validator";
import { AUTH_PROVIDER_META, AUTH_PROVIDERS } from "@usercue/shared";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import * as v from "valibot";
import { db } from "../db";
import {
  type AppEnv,
  randomToken,
  rateLimit,
  requirePermission,
  requireUser,
  SESSION_TTL,
  setCookieSafe,
} from "../middleware";
import {
  codeChallenge,
  exchangeCode,
  isProvider,
  PROVIDER_SPEC,
  publicOrigin,
  redirectUrl,
} from "../oauth";
import { memberRoleId, staffRoleId } from "../roles";
import { decryptSecret, encryptSecret, hashSecret, signPayload, verifyPayload } from "../secret";
import { oauthOnly } from "../workspace";

interface ProviderRow {
  provider: string;
  client_id: string;
  secret_cipher: string;
  secret_hash: string;
  enabled: number;
  allow_signup: number;
}

const NOW = "EXTRACT(EPOCH FROM NOW())::BIGINT";

const listProviders = db.query<ProviderRow>("SELECT * FROM oauth_providers");
const getProvider = db.query<ProviderRow>("SELECT * FROM oauth_providers WHERE provider = ?");
const upsertProvider = db.query(
  `INSERT INTO oauth_providers (provider, client_id, secret_cipher, secret_hash, enabled, allow_signup, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ${NOW})
   ON CONFLICT (provider) DO UPDATE SET
     client_id = excluded.client_id,
     secret_cipher = excluded.secret_cipher,
     secret_hash = excluded.secret_hash,
     enabled = excluded.enabled,
     allow_signup = excluded.allow_signup,
     updated_at = ${NOW}`,
);
const deleteProvider = db.query("DELETE FROM oauth_providers WHERE provider = ?");

const findUserByEmail = db.query<{ id: number }>("SELECT id FROM users WHERE email = ?");
const findUserByOAuth = db.query<{ user_id: number }>(
  "SELECT user_id FROM oauth_accounts WHERE provider = ? AND subject = ?",
);
const insertUser = db.query<{ id: number }>(
  "INSERT INTO users (email, name, password_hash, role_id, avatar_url) VALUES (?, ?, '', ?, ?) RETURNING id",
);
const applyProfile = db.query(
  "UPDATE users SET name = ?, avatar_url = CASE WHEN avatar_url = '' AND ? <> '' THEN ? ELSE avatar_url END WHERE id = ?",
);
const insertOAuthAccount = db.query(
  "INSERT INTO oauth_accounts (provider, subject, user_id) VALUES (?, ?, ?) ON CONFLICT (provider, subject) DO NOTHING",
);
const listLinks = db.query<{ provider: string }, [number]>(
  "SELECT provider FROM oauth_accounts WHERE user_id = ? ORDER BY provider",
);
const deleteLink = db.query("DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?");
const clearProviderForUser = db.query(
  "DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ? AND subject <> ?",
);
const insertSession = db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)");
const clearIdentity = db.query(
  "DELETE FROM identities WHERE visitor_id = ? OR (provider = ? AND subject = ?)",
);
const insertIdentity = db.query(
  "INSERT INTO identities (visitor_id, provider, subject, name, email) VALUES (?, ?, ?, ?, ?)",
);

async function saveIdentity(
  visitorId: string,
  provider: string,
  subject: string,
  name: string,
  email: string | null,
) {
  await db.transaction(async () => {
    await clearIdentity.run(visitorId, provider, subject);
    await insertIdentity.run(visitorId, provider, subject, name, email);
  });
}

async function startSession(c: Parameters<typeof setCookieSafe>[0], userId: number) {
  const id = randomToken();
  await insertSession.run(id, userId, Math.floor(Date.now() / 1000) + SESSION_TTL);
  setCookieSafe(c, "sid", id, SESSION_TTL);
}

function fail(
  c: Parameters<typeof setCookieSafe>[0],
  next: "admin" | "board" | "link",
  message: string,
) {
  const dest = next === "admin" ? "/login" : next === "link" ? "/account" : "/";
  return c.redirect(`${dest}?error=${encodeURIComponent(message)}`);
}

export const oauthProviders = new Hono<AppEnv>()
  .get("/providers", requirePermission("manage_settings"), async (c) => {
    const origin = publicOrigin(c);
    const rows = new Map((await listProviders.all()).map((p) => [p.provider, p]));
    return c.json(
      AUTH_PROVIDERS.map((id) => {
        const row = rows.get(id);
        const meta = AUTH_PROVIDER_META[id];
        return {
          id,
          label: meta.label,
          console: meta.console,
          redirectField: meta.redirectField,
          hint: meta.hint ?? null,
          redirectUrl: redirectUrl(origin, id),
          configured: Boolean(row),
          enabled: row?.enabled === 1,
          allowSignup: row?.allow_signup === 1,
          clientId: row?.client_id ?? "",
          secretHash: row ? row.secret_hash.slice(0, 12) : null,
        };
      }),
    );
  })

  .put(
    "/providers/:provider",
    requirePermission("manage_settings"),
    vValidator(
      "json",
      v.object({
        clientId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
        secret: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(400))),
        enabled: v.optional(v.boolean(), false),
        allowSignup: v.optional(v.boolean(), false),
      }),
    ),
    async (c) => {
      const provider = c.req.param("provider");
      if (!isProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
      const body = c.req.valid("json");
      const existing = await getProvider.get(provider);
      const clientId = body.clientId || existing?.client_id;
      if (!clientId) return c.json({ error: "Client ID is required" }, 400);

      const secret = body.secret;
      if (!secret && !existing) return c.json({ error: "Client secret is required" }, 400);

      const cipher = secret ? encryptSecret(secret) : existing!.secret_cipher;
      const hash = secret ? hashSecret(secret) : existing!.secret_hash;
      const enabled = body.enabled ? 1 : 0;
      const allowSignup = body.allowSignup ? 1 : 0;
      await upsertProvider.run(provider, clientId, cipher, hash, enabled, allowSignup);
      return c.json({ ok: true, secretHash: hash.slice(0, 12) });
    },
  )

  .delete("/providers/:provider", requirePermission("manage_settings"), async (c) => {
    const provider = c.req.param("provider");
    if (!isProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    await deleteProvider.run(provider);
    return c.json({ ok: true });
  });

export const oauth = new Hono<AppEnv>()
  .get("/methods", async (c) => {
    const origin = publicOrigin(c);
    const enabled = new Set(
      (await listProviders.all()).filter((p) => p.enabled === 1).map((p) => p.provider),
    );
    return c.json({
      providers: AUTH_PROVIDERS.filter((id) => enabled.has(id)).map((id) => ({
        id,
        label: AUTH_PROVIDER_META[id].label,
      })),
      passwordLogin: !(await oauthOnly()),
      redirects: Object.fromEntries(
        AUTH_PROVIDERS.map((id) => [id, redirectUrl(origin, id)]),
      ) as Record<string, string>,
    });
  })
  .route("/", oauthProviders)

  .get("/links", requireUser, async (c) => {
    const rows = await listLinks.all(c.get("user")!.id);
    return c.json({
      accounts: rows.map((row) => ({
        id: row.provider,
        label: isProvider(row.provider) ? AUTH_PROVIDER_META[row.provider].label : row.provider,
      })),
    });
  })

  .delete("/links/:provider", requireUser, async (c) => {
    const provider = c.req.param("provider");
    if (!isProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    const user = c.get("user")!;
    const linked = await listLinks.all(user.id);
    const owns = linked.some((row) => row.provider === provider);
    if (!owns) return c.json({ ok: true });
    if (linked.length <= 1 && !user.hasPassword) {
      return c.json({ error: "Set a password before removing your only sign-in." }, 400);
    }
    if (linked.length <= 1 && (await oauthOnly())) {
      return c.json(
        { error: "This is your only way in while connected accounts are required." },
        400,
      );
    }
    await deleteLink.run(user.id, provider);
    return c.json({ ok: true });
  })

  .get("/oauth/:provider", rateLimit(20, 60), async (c) => {
    const provider = c.req.param("provider");
    if (!isProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    const row = await getProvider.get(provider);
    if (!row || row.enabled !== 1)
      return c.json({ error: "This sign-in method is not enabled" }, 404);

    const requested = c.req.query("next");
    const next = requested === "admin" ? "admin" : requested === "link" ? "link" : "board";
    const user = c.get("user");
    if (next === "link") {
      if (!user) {
        return c.redirect(
          `/signin?error=${encodeURIComponent("Sign in before linking an account.")}`,
        );
      }
      if (user.suspended) {
        return c.redirect(
          `/account?error=${encodeURIComponent("Your account has been suspended.")}`,
        );
      }
    }
    const origin = publicOrigin(c);
    const callback = redirectUrl(origin, provider);
    const nonce = randomToken(16);
    const spec = PROVIDER_SPEC[provider];
    const verifier = spec.pkce ? randomToken(32) : undefined;
    const state = signPayload(
      JSON.stringify({
        n: nonce,
        next,
        p: provider,
        o: origin,
        v: verifier,
        u: next === "link" ? user?.id : undefined,
      }),
    );
    setCookieSafe(c, "oauth", state, 60 * 10);

    const url = new URL(spec.authorize);
    url.searchParams.set("client_id", row.client_id);
    url.searchParams.set("redirect_uri", callback);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", spec.scope);
    url.searchParams.set("state", nonce);
    if (verifier) {
      url.searchParams.set("code_challenge", codeChallenge(verifier));
      url.searchParams.set("code_challenge_method", "S256");
    }
    if (provider === "google" || provider === "azure") {
      url.searchParams.set("prompt", "select_account");
    }
    return c.redirect(url.toString());
  })

  .get("/oauth/:provider/callback", rateLimit(20, 60), async (c) => {
    const provider = c.req.param("provider");
    if (!isProvider(provider)) return c.redirect("/login?error=Unknown%20provider");

    const packed = getCookie(c, "oauth");
    deleteCookie(c, "oauth", { path: "/" });
    const raw = packed ? verifyPayload(packed) : null;
    let next: "admin" | "board" | "link" = "board";
    let origin = publicOrigin(c);
    let verifier: string | undefined;
    let linkUserId: number | undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          n: string;
          next: "admin" | "board" | "link";
          p: string;
          o: string;
          v?: string;
          u?: number;
        };
        next = parsed.next === "link" ? "link" : parsed.next === "admin" ? "admin" : "board";
        origin = parsed.o || origin;
        verifier = parsed.v;
        linkUserId = parsed.u;
        if (parsed.p !== provider || parsed.n !== c.req.query("state")) {
          return fail(c, next, "Sign-in expired. Try again.");
        }
      } catch {
        return fail(c, next, "Sign-in expired. Try again.");
      }
    } else {
      return fail(c, next, "Sign-in expired. Try again.");
    }

    const err = c.req.query("error");
    if (err) return fail(c, next, "The provider denied access.");
    const code = c.req.query("code");
    if (!code) return fail(c, next, "Missing authorization code.");

    const row = await getProvider.get(provider);
    if (!row || row.enabled !== 1) return fail(c, next, "This sign-in method is not enabled.");

    try {
      if (PROVIDER_SPEC[provider].pkce && !verifier) {
        return fail(c, next, "Sign-in expired. Try again.");
      }

      const profile = await exchangeCode(
        provider,
        code,
        redirectUrl(origin, provider),
        row.client_id,
        decryptSecret(row.secret_cipher),
        verifier,
      );
      if (!profile.subject || profile.subject === "undefined") {
        return fail(c, next, "This provider did not share an account id.");
      }

      if (next === "link") {
        const session = c.get("user");
        if (!session || linkUserId !== session.id) {
          return fail(c, next, "Sign in before linking an account.");
        }
        if (session.suspended) return fail(c, next, "Your account has been suspended.");
        const taken = await findUserByOAuth.get(provider, profile.subject);
        if (taken && taken.user_id !== session.id) {
          return fail(c, next, "That login is already linked to another account.");
        }
        await insertOAuthAccount.run(provider, profile.subject, session.id);
        const confirmed = await findUserByOAuth.get(provider, profile.subject);
        if (confirmed?.user_id !== session.id) {
          return fail(c, next, "That login is already linked to another account.");
        }
        await clearProviderForUser.run(session.id, provider, profile.subject);
        return c.redirect("/account");
      }

      const email = profile.email?.toLowerCase() ?? null;
      const linked = await findUserByOAuth.get(provider, profile.subject);
      let userId = linked?.user_id;
      if (!userId && email) userId = (await findUserByEmail.get(email))?.id;

      if (!userId) {
        if (next === "admin" && !row.allow_signup) {
          return fail(c, next, "No team account is linked to this login.");
        }
        if (!email && provider !== "roblox") {
          return fail(c, next, "This provider did not share an email.");
        }
        const roleId = next === "admin" ? await staffRoleId() : await memberRoleId();
        const created = await insertUser.get(email, profile.name, roleId, profile.avatarUrl ?? "");
        if (!created) return fail(c, next, "Could not create your account.");
        userId = created.id;
      } else {
        const avatar = profile.avatarUrl ?? "";
        await applyProfile.run(profile.name, avatar, avatar, userId);
      }

      await insertOAuthAccount.run(provider, profile.subject, userId);
      await startSession(c, userId);
      await saveIdentity(
        c.get("visitorId"),
        provider,
        profile.subject,
        profile.name,
        profile.email,
      );
      return c.redirect(next === "admin" ? "/admin" : "/");
    } catch (e) {
      console.error(e);
      return fail(c, next, "Could not complete sign-in.");
    }
  });
