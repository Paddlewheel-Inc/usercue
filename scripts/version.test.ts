import { describe, expect, test } from "bun:test";
import { compareVersions, parseVersion, prepareRelease, validateRelease } from "./version";

describe("release version safeguards", () => {
  test.each(["1.0.0", "1.2.0-rc.1", "10.20.30", "1.0.0-rc.0"])("accepts %s", (value) => {
    expect(() => parseVersion(value)).not.toThrow();
  });
  test.each([
    "latest",
    "v1.0.0",
    "01.0.0",
    "1.0",
    "1.0.0-rc.01",
    "1.0.0+abc",
    "1.0.0\n",
    "1.0.0;echo bad",
  ])("rejects %s", (value) => expect(() => parseVersion(value)).toThrow());
  test.each([
    ["1.10.0", "1.9.0"],
    ["2.0.0", "1.99.99"],
    ["1.0.0", "1.0.0-rc.9"],
    ["1.0.0-rc.10", "1.0.0-rc.9"],
    ["1.0.1-rc.1", "1.0.0"],
  ])("orders %s after %s", (a, b) => {
    expect(compareVersions(a!, b!)).toBe(1);
    expect(compareVersions(b!, a!)).toBe(-1);
    expect(compareVersions(a!, a!)).toBe(0);
  });
  test("rejects a tag/manifest mismatch and missing release notes", () => {
    expect(() => validateRelease("1.0.0", "## [1.0.0]\n", "v1.0.1")).toThrow();
    expect(() => validateRelease("1.0.0", "## [Unreleased]\n", "v1.0.0")).toThrow();
    expect(() => validateRelease("1.0.0", "## [1.0.0]\n", "v1.0.0")).not.toThrow();
  });
  test("prepares notes without removing release history", () => {
    const notes = "# Releases\n\n## [Unreleased]\n\n- Fix login.\n\n## [1.0.0]\n\n- Baseline.\n";
    const result = prepareRelease("1.0.0", "1.0.1", notes);
    expect(result).toContain("## [Unreleased]\n\n## [1.0.1]\n\n- Fix login.");
    expect(result).toContain("## [1.0.0]\n\n- Baseline.");
    validateRelease("1.0.1", result, "v1.0.1");
  });
  test("rejects downgrades, duplicates, and empty preparation", () => {
    expect(() => prepareRelease("1.0.0", "1.0.0", "")).toThrow();
    expect(() => prepareRelease("1.0.0", "0.9.0", "")).toThrow();
    expect(() => prepareRelease("1.0.0", "1.0.1", "## [Unreleased]\n\n## [1.0.0]\n")).toThrow();
    expect(() =>
      prepareRelease("1.0.0", "1.0.1", "## [Unreleased]\n- Fix.\n## [1.0.1]\n"),
    ).toThrow();
  });
});
