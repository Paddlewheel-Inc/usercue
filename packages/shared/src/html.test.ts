import { describe, expect, test } from "bun:test";
import { isEmptyHtml, sanitizeHtml } from "./html";

const clip = `<video src="/api/uploads/clip.mp4" controls playsinline preload="metadata" contenteditable="false"></video>`;

describe("video html", () => {
  test("keeps an uploaded video and marks the first one as the lead", () => {
    const html = sanitizeHtml(
      `${clip}<p>After</p><video src="/api/uploads/second.webm" autoplay></video>`,
    );
    expect(html).toContain(
      '<video src="/api/uploads/clip.mp4" playsinline preload="metadata" contenteditable="false" data-lead></video>',
    );
    expect(html).toContain('<video src="/api/uploads/second.webm" playsinline></video>');
    expect(html).not.toContain("controls");
    expect(html).not.toContain("autoplay");
    expect(html.match(/data-lead/g)?.length).toBe(1);
  });

  test("drops a video without a safe source", () => {
    expect(sanitizeHtml('<video src="javascript:alert(1)" controls></video>text')).toBe("text");
    expect(sanitizeHtml("<video>hidden</video>text")).toBe("text");
    expect(sanitizeHtml('<video src="https://example.com/clip.mp4" controls></video>')).toBe("");
    expect(sanitizeHtml('<video src="/uploads/clip.mp4" controls></video>')).toContain(
      'src="/uploads/clip.mp4"',
    );
  });

  test("a video counts as content", () => {
    expect(isEmptyHtml(clip)).toBe(false);
    expect(isEmptyHtml("<p><br></p>")).toBe(true);
  });
});
