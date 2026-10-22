import { createHash } from "node:crypto";
import { AUTH_PROVIDERS, type AuthProviderId } from "@usercue/shared";
import type { Context } from "hono";
import { env } from "./env";

export const PROVIDER_IDS = AUTH_PROVIDERS;

export function isProvider(value: string): value is AuthProviderId {
  return (AUTH_PROVIDERS as readonly string[]).includes(value);
}

interface ProviderSpec {
  authorize: string;
  token: string;
  user: string;
  emails?: string;
  scope: string;
  pkce?: boolean;
}

export const PROVIDER_SPEC: Record<AuthProviderId, ProviderSpec> = {
  github: {
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    user: "https://api.github.com/user",
    emails: "https://api.github.com/user/emails",
    scope: "read:user user:email",
  },
  discord: {
    authorize: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    user: "https://discord.com/api/users/@me",
    scope: "identify email",
  },
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    user: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  },
  roblox: {
    authorize: "https://apis.roblox.com/oauth/v1/authorize",
    token: "https://apis.roblox.com/oauth/v1/token",
    user: "https://apis.roblox.com/oauth/v1/userinfo",
    scope: "openid profile",
    pkce: true,
  },
  azure: {
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    user: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile User.Read",
  },
};

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function publicOrigin(c: Context): string {
  if (env.publicUrl) return env.publicUrl.replace(/\/$/, "");
  const forwarded = c.req.header("x-forwarded-host");
  if (forwarded) {
    const proto = c.req.header("x-forwarded-proto") ?? "http";
    return `${proto}://${forwarded.split(",")[0]!.trim()}`;
  }
  const origin = c.req.header("origin");
  if (origin?.startsWith("http")) return origin.replace(/\/$/, "");
  const referer = c.req.header("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = c.req.header("host") ?? url.host;
  return `${proto}://${host}`;
}

export function redirectUrl(origin: string, provider: AuthProviderId): string {
  return `${origin}/api/auth/oauth/${provider}/callback`;
}

export interface OAuthProfile {
  subject: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

function textField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function discordAvatar(user: Record<string, unknown>): string | null {
  const id = textField(user.id);
  const hash = textField(user.avatar);
  if (id && hash) {
    const ext = hash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${id}/${hash}.${ext}?size=64`;
  }
  if (id && /^\d+$/.test(id)) {
    const index = Number((BigInt(id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  return null;
}

function emailish(value: unknown): string | null {
  const text = textField(value);
  return text?.includes("@") ? text : null;
}

function publicAvatar(value: unknown): string | null {
  const url = textField(value);
  if (!url?.startsWith("https://")) return null;
  if (url.includes("graph.microsoft.com")) return null;
  return url;
}

function jwtPayload(token: string | undefined): Record<string, unknown> | null {
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function exchangeCode(
  provider: AuthProviderId,
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  codeVerifier?: string,
): Promise<OAuthProfile> {
  const spec = PROVIDER_SPEC[provider];
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const tokenRes = await fetch(spec.token, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const tokenBody = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenBody.access_token) {
    throw new Error(
      tokenBody.error_description ?? tokenBody.error ?? "Could not exchange authorization code",
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${tokenBody.access_token}`,
    "User-Agent": "usercue",
  };

  const userRes = await fetch(spec.user, { headers });
  if (!userRes.ok) throw new Error("Could not load the OAuth profile");
  const user = (await userRes.json()) as Record<string, unknown>;

  if (provider === "github") {
    const login = String(user.login ?? "github");
    let email = typeof user.email === "string" ? user.email : null;
    if (!email && spec.emails) {
      const emailsRes = await fetch(spec.emails, { headers });
      const emails = (await emailsRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      email =
        emails.find((e) => e.primary && e.verified)?.email ??
        emails.find((e) => e.verified)?.email ??
        null;
    }
    return {
      subject: String(user.id),
      name: String(user.name || login),
      email,
      avatarUrl: textField(user.avatar_url),
    };
  }

  if (provider === "discord") {
    const username = String(user.global_name || user.username || "discord");
    const email = typeof user.email === "string" ? user.email : null;
    return {
      subject: String(user.id),
      name: username,
      email,
      avatarUrl: discordAvatar(user),
    };
  }

  if (provider === "roblox") {
    return {
      subject: String(user.sub),
      name: String(user.name || user.preferred_username || user.nickname || "roblox"),
      email: null,
      avatarUrl: publicAvatar(user.picture),
    };
  }

  if (provider === "azure") {
    const claims = jwtPayload(tokenBody.id_token);
    const email =
      emailish(user.email) ??
      emailish(user.preferred_username) ??
      emailish(claims?.email) ??
      emailish(claims?.preferred_username);
    return {
      subject: String(user.sub ?? claims?.sub),
      name: String(user.name || claims?.name || email || "azure"),
      email,
      avatarUrl: publicAvatar(user.picture) ?? publicAvatar(claims?.picture),
    };
  }

  const email = typeof user.email === "string" ? user.email : null;
  return {
    subject: String(user.sub ?? user.id),
    name: String(user.name || email || "google"),
    email,
    avatarUrl: textField(user.picture),
  };
}
