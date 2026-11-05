import { resolve } from "node:path";
import { readFile, writeFile } from "fs/promises";

// Deliberately support stable releases and numbered release candidates only.
// Build metadata (+...) is excluded because Docker tags cannot contain '+'.
const format = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?$/;

export function parseVersion(value: string) {
  const match = format.exec(value);
  if (!match || match[0] !== value || `v${value}`.length > 128) {
    throw new Error(`Invalid version '${value}': use X.Y.Z or X.Y.Z-rc.N, without a v prefix.`);
  }
  return {
    parts: [BigInt(match[1]!), BigInt(match[2]!), BigInt(match[3]!)],
    rc: match[4] === undefined ? null : BigInt(match[4]),
  };
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i++) {
    if (a.parts[i]! > b.parts[i]!) return 1;
    if (a.parts[i]! < b.parts[i]!) return -1;
  }
  if (a.rc === b.rc) return 0;
  if (a.rc === null) return 1;
  if (b.rc === null) return -1;
  return a.rc > b.rc ? 1 : -1;
}

export function validateRelease(version: string, changelog: string, tag?: string) {
  parseVersion(version);
  if (tag !== undefined && tag !== `v${version}`) {
    throw new Error(`Release tag '${tag}' must match package.json version 'v${version}'.`);
  }
  const heading = `## [${version}]`;
  if (!changelog.split("\n").some((line) => line === heading || line.startsWith(`${heading} - `))) {
    throw new Error(`CHANGELOG.md must contain a '${heading}' section.`);
  }
}

export function prepareRelease(current: string, next: string, changelog: string) {
  if (compareVersions(next, current) <= 0) {
    throw new Error(`New version ${next} must be greater than ${current}.`);
  }
  const marker = "## [Unreleased]\n";
  if (!changelog.includes(marker)) throw new Error("CHANGELOG.md needs an Unreleased section.");
  if (changelog.includes(`## [${next}]`)) throw new Error(`${next} already has release notes.`);
  const after = changelog.split(marker)[1]!;
  const notes = after.split(/^## /m)[0]!.trim();
  if (!notes) throw new Error("Add release notes under Unreleased before preparing a version.");
  return changelog.replace(marker, `${marker}\n## [${next}]\n`);
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const manifestPath = resolve(root, "package.json");
  const changelogPath = resolve(root, "CHANGELOG.md");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const changelog = await readFile(changelogPath, "utf8");
    const [command, argument] = process.argv.slice(2);
    if (command === "check") {
      validateRelease(manifest.version, changelog, argument ?? process.env.RELEASE_TAG);
      console.log(`Validated UserCue v${manifest.version}`);
    } else if (command === "prepare" && argument) {
      const updated = prepareRelease(manifest.version, argument, changelog);
      manifest.version = argument;
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      await writeFile(changelogPath, updated);
      console.log(
        `Prepared v${argument}. Review and commit package.json and CHANGELOG.md together.`,
      );
    } else {
      throw new Error("Usage: bun run version:check [vX.Y.Z] | bun run version:prepare X.Y.Z");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
