import { CAPTCHA_ACTIONS, type CaptchaAction } from "@usercue/shared";
import type { Context } from "hono";
import { env } from "./env";
import type { AppEnv } from "./middleware";
import { getWorkspace } from "./workspace";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const TIMEOUT_MS = 8_000;

export class CaptchaError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 503 = 400,
  ) {
    super(message);
  }
}

export interface CaptchaSettings {
  siteKey: string;
  configured: boolean;
  actions: Record<CaptchaAction, boolean>;
  fromEnv: Record<CaptchaAction, boolean>;
}

function forced(action: CaptchaAction): boolean {
  return env.recaptchaActions.includes("all") || env.recaptchaActions.includes(action);
}

export async function captchaSettings(): Promise<CaptchaSettings> {
  const workspace = await getWorkspace();
  const configured = Boolean(env.recaptchaSiteKey && env.recaptchaSecretKey);
  const enabled = (action: CaptchaAction, column: number) =>
    configured && (column === 1 || forced(action));
  return {
    siteKey: env.recaptchaSiteKey,
    configured,
    actions: {
      posts: enabled("posts", workspace.captcha_posts),
      comments: enabled("comments", workspace.captcha_comments),
      login: enabled("login", workspace.captcha_login),
      setup: enabled("setup", workspace.captcha_setup),
    },
    fromEnv: Object.fromEntries(
      CAPTCHA_ACTIONS.map((action) => [action, forced(action)]),
    ) as Record<CaptchaAction, boolean>,
  };
}

interface VerifyOptions {
  secret: string;
  token: unknown;
  remoteIp?: string;
  fetcher?: typeof fetch;
}

export async function verifyCaptcha({
  secret,
  token,
  remoteIp,
  fetcher = fetch,
}: VerifyOptions): Promise<void> {
  if (typeof token !== "string" || !token.trim()) {
    throw new CaptchaError("Complete the captcha to continue.");
  }
  if (!secret) throw new CaptchaError("Captcha is not configured on this instance.", 503);

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let response: Response;
  try {
    response = await fetcher(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new CaptchaError("Could not verify the captcha. Try again.", 503);
  }
  if (!response.ok) {
    throw new CaptchaError("Could not verify the captcha. Try again.", 503);
  }
  const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
  if (result?.success !== true) {
    throw new CaptchaError("Captcha check failed. Try again.");
  }
}

function clientIp(c: Context<AppEnv>): string | undefined {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || c.req.header("cf-connecting-ip")?.trim() || undefined;
}

export async function enforceCaptcha(
  c: Context<AppEnv>,
  action: CaptchaAction,
  token: unknown,
): Promise<void> {
  if (c.get("apiKeyId")) return;
  const settings = await captchaSettings();
  if (!settings.actions[action]) return;
  await verifyCaptcha({ secret: env.recaptchaSecretKey, token, remoteIp: clientIp(c) });
}

export async function checkCaptcha(
  c: Context<AppEnv>,
  action: CaptchaAction,
  token: unknown,
): Promise<Response | null> {
  try {
    await enforceCaptcha(c, action, token);
    return null;
  } catch (error) {
    if (error instanceof CaptchaError) return c.json({ error: error.message }, error.status);
    throw error;
  }
}
