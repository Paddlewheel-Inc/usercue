import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLANS, UNRESTRICTED } from "@usercue/shared";
import { checkPlanLimit, currentPlan, parsePlanFile, resetPlanCache } from "./entitlements";

const original = process.env.USERCUE_PLAN_FILE;

afterEach(() => {
  if (original === undefined) delete process.env.USERCUE_PLAN_FILE;
  else process.env.USERCUE_PLAN_FILE = original;
  resetPlanCache();
});

async function withPlanDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "usercue-plan-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("free instances allow five staff seats and paid instances are unlimited", () => {
  expect(PLANS.free.limits.staffSeats).toBe(5);
  expect(PLANS.paid.limits.staffSeats).toBeNull();
  expect(PLANS.paid.label).toBe("Pro");
});

test("plan file parsing falls back to free for anything unrecognised", () => {
  expect(parsePlanFile('{"plan":"paid"}').id).toBe("paid");
  expect(parsePlanFile('{"plan":"free"}').id).toBe("free");
  expect(parsePlanFile('{"plan":"enterprise"}').id).toBe("free");
  expect(parsePlanFile("not json").id).toBe("free");
});

test("self-hosted instances without a plan file are unrestricted", async () => {
  delete process.env.USERCUE_PLAN_FILE;
  const plan = await currentPlan();
  expect(plan.managed).toBe(false);
  expect(plan.entitlements).toBe(UNRESTRICTED);
  expect(await checkPlanLimit("staffSeats", 100)).toBeNull();
});

test("a configured plan file that has not been written yet is unrestricted", async () => {
  await withPlanDir(async (dir) => {
    process.env.USERCUE_PLAN_FILE = join(dir, "plan.json");
    expect((await currentPlan()).managed).toBe(false);
  });
});

test("plan changes on disk apply without a restart", async () => {
  await withPlanDir(async (dir) => {
    const path = join(dir, "plan.json");
    process.env.USERCUE_PLAN_FILE = path;
    await writeFile(path, '{"plan":"free"}');
    await utimes(path, 1000, 1000);
    expect((await currentPlan()).id).toBe("free");
    await writeFile(path, '{"plan":"paid"}');
    await utimes(path, 2000, 2000);
    expect((await currentPlan()).id).toBe("paid");
    expect(await checkPlanLimit("staffSeats", 100)).toBeNull();
  });
});

test("adding nothing never trips a limit", async () => {
  await withPlanDir(async (dir) => {
    const path = join(dir, "plan.json");
    process.env.USERCUE_PLAN_FILE = path;
    await writeFile(path, '{"plan":"free"}');
    expect(await checkPlanLimit("staffSeats", 0)).toBeNull();
  });
});
