import { afterEach, describe, expect, test } from "bun:test";
import { CaptchaError, verifyCaptcha } from "./captcha";

const SECRET = "test-secret";
const TOKEN = "test-token";
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(body: unknown, status = 200) {
  let seen: { url: string; body: URLSearchParams } | null = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seen = {
      url: String(url),
      body: new URLSearchParams(String(init?.body ?? "")),
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return () => seen;
}

describe("verifyCaptcha", () => {
  test("posts the token and secret to Google and accepts success", async () => {
    const seen = stubFetch({ success: true });
    await verifyCaptcha({ secret: SECRET, token: TOKEN, remoteIp: "203.0.113.5" });
    expect(seen()?.url).toBe("https://www.google.com/recaptcha/api/siteverify");
    expect(seen()?.body.get("secret")).toBe(SECRET);
    expect(seen()?.body.get("response")).toBe(TOKEN);
    expect(seen()?.body.get("remoteip")).toBe("203.0.113.5");
  });

  test("rejects a failed check", async () => {
    stubFetch({ success: false, "error-codes": ["invalid-input-response"] });
    await expect(verifyCaptcha({ secret: SECRET, token: TOKEN })).rejects.toBeInstanceOf(
      CaptchaError,
    );
  });

  test("rejects a non-2xx response", async () => {
    stubFetch({}, 502);
    await expect(verifyCaptcha({ secret: SECRET, token: TOKEN })).rejects.toThrow(
      "Could not verify the captcha",
    );
  });

  test("rejects malformed JSON", async () => {
    globalThis.fetch = (async () =>
      new Response("not json", { status: 200 })) as unknown as typeof fetch;
    await expect(verifyCaptcha({ secret: SECRET, token: TOKEN })).rejects.toThrow(
      "Captcha check failed",
    );
  });

  test("rejects a network error", async () => {
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(verifyCaptcha({ secret: SECRET, token: TOKEN })).rejects.toThrow(
      "Could not verify the captcha",
    );
  });

  test("requires a token and a configured secret", async () => {
    await expect(verifyCaptcha({ secret: SECRET, token: undefined })).rejects.toThrow(
      "Complete the captcha",
    );
    await expect(verifyCaptcha({ secret: "", token: TOKEN })).rejects.toThrow("not configured");
  });

  test("accepts an injected fetcher", async () => {
    let called = false;
    const fetcher = (async () => {
      called = true;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;
    await verifyCaptcha({ secret: SECRET, token: TOKEN, fetcher });
    expect(called).toBe(true);
    expect(globalThis.fetch).toBe(originalFetch);
  });
});
