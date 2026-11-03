import { describe, expect, test } from "bun:test";
import { changelogPublicationStatus, resolveChangelogPublication } from "./changelog";

const now = 1_800_000_000;

describe("changelog publication", () => {
  test("drafts remain private indefinitely", () => {
    expect(changelogPublicationStatus(null, now)).toBe("draft");
    expect(resolveChangelogPublication({}, null, now)).toBeNull();
  });
  test("a schedule becomes published exactly when due", () => {
    expect(changelogPublicationStatus(now + 60, now)).toBe("scheduled");
    expect(changelogPublicationStatus(now + 60, now + 59)).toBe("scheduled");
    expect(changelogPublicationStatus(now + 60, now + 60)).toBe("published");
  });
  test("publishing a draft uses the current time", () => {
    expect(resolveChangelogPublication({ publicationStatus: "published" }, null, now)).toBe(now);
  });
  test("editing a published entry preserves its publication date", () => {
    expect(resolveChangelogPublication({}, now - 1000, now)).toBe(now - 1000);
    expect(resolveChangelogPublication({ publicationStatus: "published" }, now - 1000, now)).toBe(
      now - 1000,
    );
  });
  test("drafts can be scheduled and schedules can be changed", () => {
    expect(
      resolveChangelogPublication(
        { publicationStatus: "scheduled", publishAt: now + 60 },
        null,
        now,
      ),
    ).toBe(now + 60);
    expect(resolveChangelogPublication({ publishAt: now + 120 }, now + 60, now)).toBe(now + 120);
    expect(resolveChangelogPublication({}, now + 60, now)).toBe(now + 60);
  });
  test("canceling publication or a schedule returns to a draft", () => {
    expect(resolveChangelogPublication({ publicationStatus: "draft" }, now + 60, now)).toBeNull();
    expect(resolveChangelogPublication({ publicationStatus: "draft" }, now - 60, now)).toBeNull();
  });
  test("a scheduled entry can be published immediately", () => {
    expect(resolveChangelogPublication({ publicationStatus: "published" }, now + 60, now)).toBe(
      now,
    );
  });
  test.each([now - 60, now, Number.NaN, Number.POSITIVE_INFINITY, now + 0.5])(
    "rejects invalid schedule %s",
    (publishAt) => {
      expect(() =>
        resolveChangelogPublication({ publicationStatus: "scheduled", publishAt }, null, now),
      ).toThrow();
    },
  );
  test("a schedule requires a publication time", () => {
    expect(() =>
      resolveChangelogPublication({ publicationStatus: "scheduled" }, null, now),
    ).toThrow();
  });
  test("a publication time must accompany the scheduled mode", () => {
    expect(() =>
      resolveChangelogPublication({ publicationStatus: "draft", publishAt: now + 60 }, null, now),
    ).toThrow();
    expect(() =>
      resolveChangelogPublication(
        { publicationStatus: "published", publishAt: now + 60 },
        null,
        now,
      ),
    ).toThrow();
  });
});
