import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

async function promotion(options: {
  current?: string;
  error?: string;
  version?: string;
  legacy?: boolean;
}) {
  const directory = await mkdtemp(join(tmpdir(), "usercue-promotion-"));
  const log = join(directory, "calls.jsonl");
  try {
    await writeFile(
      join(directory, "docker"),
      `#!${process.execPath}\n${
        "const args = process.argv.slice(2);\n" +
        'await Bun.write(process.env.CALL_LOG, (await Bun.file(process.env.CALL_LOG).text().catch(() => "")) + JSON.stringify(args) + "\\n");\n' +
        'if (args[0] === "manifest" && process.env.INSPECT_ERROR) { console.error(process.env.INSPECT_ERROR); process.exit(1); }\n' +
        'if (args[0] === "image") console.log(JSON.stringify({ Labels: { "org.opencontainers.image.version": process.env.CURRENT_VERSION }, Env: process.env.LEGACY_IMAGE === "true" ? [] : ["USERCUE_REVISION=example"] }));\n'
      }`,
      { mode: 0o755 },
    );
    const child = Bun.spawn([process.execPath, resolve(import.meta.dir, "promote-latest.ts")], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        CALL_LOG: log,
        CURRENT_VERSION: options.current ?? "",
        LEGACY_IMAGE: String(options.legacy ?? false),
        INSPECT_ERROR: options.error ?? "",
        RELEASE_TAG: `v${options.version ?? "1.0.0"}`,
        IMAGE: "ghcr.io/example/usercue",
        IMAGE_REFERENCE: "ghcr.io/example/usercue@sha256:example",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    const calls: string[][] = (await readFile(log, "utf8").catch(() => ""))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return { code, stdout, stderr, calls, promoted: calls.some((args) => args[0] === "buildx") };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("latest advances numerically and reuses the published digest", async () => {
  const result = await promotion({ current: "1.9.0", version: "1.10.0" });
  expect(result.code).toBe(0);
  expect(result.calls.at(-1)).toEqual([
    "buildx",
    "imagetools",
    "create",
    "--prefer-index=false",
    "--tag",
    "ghcr.io/example/usercue:latest",
    "ghcr.io/example/usercue@sha256:example",
  ]);
});

test("releasing an older version preserves latest", async () => {
  const result = await promotion({ current: "2.0.0", version: "1.0.1" });
  expect(result.code).toBe(0);
  expect(result.promoted).toBe(false);
});

test("same-version retry can complete latest promotion", async () => {
  const result = await promotion({ current: "1.0.0" });
  expect(result.code).toBe(0);
  expect(result.promoted).toBe(true);
});

test("first release can create latest or replace the legacy unlabeled image", async () => {
  for (const options of [{ error: "manifest unknown" }, { current: "1.4.4", legacy: true }]) {
    const result = await promotion(options);
    expect(result.code).toBe(0);
    expect(result.promoted).toBe(true);
  }
});

test("registry authentication and network failures never trigger promotion", async () => {
  for (const error of ["unauthorized", "connection refused", "TLS handshake timeout"]) {
    const result = await promotion({ error });
    expect(result.code).not.toBe(0);
    expect(result.promoted).toBe(false);
  }
});

test("prereleases cannot promote latest", async () => {
  const result = await promotion({ current: "1.0.0", version: "1.1.0-rc.1" });
  expect(result.code).not.toBe(0);
  expect(result.promoted).toBe(false);
});

test("unexpected latest metadata fails closed after the baseline", async () => {
  for (const current of ["<no value>", "development", "v1.0.0"]) {
    const result = await promotion({ current, version: "1.0.1" });
    expect(result.code).not.toBe(0);
    expect(result.promoted).toBe(false);
  }
});

test("Bun metadata is treated as legacy only for the initial UserCue release", async () => {
  const initial = await promotion({ current: "1.4.4", legacy: true });
  expect(initial.code).toBe(0);
  expect(initial.promoted).toBe(true);
  const later = await promotion({ current: "1.4.4", legacy: true, version: "1.0.1" });
  expect(later.code).not.toBe(0);
  expect(later.promoted).toBe(false);
});
