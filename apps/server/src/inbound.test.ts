import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { cleanBody, cleanSubject, parseSender } from "./mailparse";
import { signWebhook, verifySvixSignature } from "./signatures";
import { textToHtml } from "./text";

const secret = `whsec_${Buffer.from("test-secret").toString("base64")}`;

function sign(id: string, timestamp: string, body: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

describe("verifySvixSignature", () => {
  const body = '{"type":"email.received"}';
  const now = 1_700_000_000;
  const timestamp = String(now);

  test("accepts a valid signature", () => {
    const signature = `v1,${sign("msg_1", timestamp, body)}`;
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp, signature }, body, now)).toBe(
      true,
    );
  });

  test("accepts when any listed signature matches", () => {
    const signature = `v1,invalid v1,${sign("msg_1", timestamp, body)}`;
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp, signature }, body, now)).toBe(
      true,
    );
  });

  test("rejects a tampered body", () => {
    const signature = `v1,${sign("msg_1", timestamp, body)}`;
    expect(verifySvixSignature(secret, { id: "msg_1", timestamp, signature }, "{}", now)).toBe(
      false,
    );
  });

  test("rejects stale timestamps", () => {
    const signature = `v1,${sign("msg_1", timestamp, body)}`;
    expect(
      verifySvixSignature(secret, { id: "msg_1", timestamp, signature }, body, now + 3600),
    ).toBe(false);
  });
});

describe("signWebhook", () => {
  test("is deterministic and depends on the timestamp", () => {
    expect(signWebhook("s", "1", "{}")).toBe(signWebhook("s", "1", "{}"));
    expect(signWebhook("s", "1", "{}")).not.toBe(signWebhook("s", "2", "{}"));
  });
});

describe("parseSender", () => {
  test("reads a display name and address", () => {
    expect(parseSender('"Ada Lovelace" <Ada@Example.com>')).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  test("falls back to the local part", () => {
    expect(parseSender("ada@example.com")).toEqual({ name: "ada", email: "ada@example.com" });
  });

  test("rejects garbage", () => {
    expect(parseSender("not an email")).toBeNull();
  });
});

describe("cleanSubject", () => {
  test("removes reply and forward prefixes", () => {
    expect(cleanSubject("Re: FWD: Add dark mode")).toBe("Add dark mode");
  });

  test("uses a fallback for empty subjects", () => {
    expect(cleanSubject("  ")).toBe("Email feedback");
  });
});

describe("cleanBody", () => {
  test("drops quoted replies and collapses blank lines", () => {
    expect(cleanBody("Hello\n> quoted\n\n\n\nThanks")).toBe("Hello\n\nThanks");
  });
});

describe("textToHtml", () => {
  test("escapes markup and keeps paragraphs", () => {
    expect(textToHtml("a <b>\nc\n\nd")).toBe("<p>a &lt;b&gt;<br>c</p><p>d</p>");
  });
});
