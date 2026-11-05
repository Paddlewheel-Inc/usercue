import { compareVersions, parseVersion } from "./version";

// Runs inside the serialized publication job, after the version image is verified and pushed.
// A registry failure must stop promotion rather than be interpreted as a missing latest tag.
const image = process.env.IMAGE!;
const tag = process.env.RELEASE_TAG!;
const reference = process.env.IMAGE_REFERENCE!;
const version = tag.slice(1);
parseVersion(version);
if (version.includes("-")) throw new Error("Prereleases cannot become latest.");

const command = async (args: string[]) => {
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`${args[0]} failed: ${stderr}`);
  return stdout.trim();
};

// manifest inspect distinguishes a missing manifest from authentication/network failures.
const child = Bun.spawn(["docker", "manifest", "inspect", `${image}:latest`], {
  stdout: "ignore",
  stderr: "pipe",
});
const [error, code] = await Promise.all([new Response(child.stderr).text(), child.exited]);
if (code === 0) {
  await command(["docker", "pull", `${image}:latest`]);
  const current = await command([
    "docker",
    "image",
    "inspect",
    `${image}:latest`,
    "--format",
    '{{ index .Config.Labels "org.opencontainers.image.version" }}',
  ]);
  // The old workflow did not label versions. Only the initial baseline may replace it.
  if (!current || current === "<no value>") {
    if (version !== "1.0.0")
      throw new Error("Unversioned latest requires the v1.0.0 baseline first.");
  } else if (compareVersions(version, current) < 0) {
    console.log(`Keeping latest at ${current}; published ${tag} remains available by version.`);
    process.exit(0);
  }
} else if (!/manifest unknown|no such manifest/i.test(error)) {
  throw new Error(`Cannot inspect latest; refusing promotion: ${error}`);
}

await command([
  "docker",
  "buildx",
  "imagetools",
  "create",
  "--prefer-index=false",
  "--tag",
  `${image}:latest`,
  reference,
]);
console.log(`latest now points to ${reference}`);
