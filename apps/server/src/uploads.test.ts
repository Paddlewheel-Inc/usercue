import { describe, expect, test } from "bun:test";
import { videoHeaderMatches } from "./routes/uploads";

function bytes(text: string, prefix = [0, 0, 0, 32]) {
  return Uint8Array.from(
    [...prefix, ...text.slice(0, 8)].map((item) =>
      typeof item === "number" ? item : item.charCodeAt(0),
    ),
  );
}

describe("video file headers", () => {
  test("accepts a real MP4, MOV, or WebM header", () => {
    expect(videoHeaderMatches("mp4", bytes("ftypisom"))).toBe(true);
    expect(videoHeaderMatches("mov", bytes("ftypqt  "))).toBe(true);
    expect(videoHeaderMatches("webm", Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3))).toBe(true);
  });

  test("rejects a file whose contents do not match the video type", () => {
    const html = new TextEncoder().encode("<!DOCTYPE html><html></html>");
    expect(videoHeaderMatches("mp4", html)).toBe(false);
    expect(videoHeaderMatches("webm", bytes("ftypisom"))).toBe(false);
    expect(videoHeaderMatches("mp4", Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3))).toBe(false);
  });
});
