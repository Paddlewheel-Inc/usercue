import { readFile, stat } from "node:fs/promises";
import {
  isPlanId,
  PLAN_LIMIT_ERROR,
  PLAN_LIMIT_KEYS,
  PLAN_LIMIT_META,
  PLANS,
  type PlanEntitlements,
  type PlanId,
  type PlanLimitKey,
  planLimitMessage,
  UNRESTRICTED,
} from "@usercue/shared";
import { db } from "./db";
import { countWithPermission } from "./roles";

export interface InstancePlan {
  id: PlanId | null;
  managed: boolean;
  entitlements: PlanEntitlements;
}

export interface PlanLimitError {
  error: string;
  code: typeof PLAN_LIMIT_ERROR;
  limit: PlanLimitKey;
  max: number;
  used: number;
}

const countPendingInvites = db.query<{ n: number }>(
  "SELECT COUNT(*)::int AS n FROM invites WHERE accepted_at IS NULL AND expires_at > ?",
);

const usage: Record<PlanLimitKey, () => Promise<number>> = {
  staffSeats: async () => {
    const now = Math.floor(Date.now() / 1000);
    const staff = await countWithPermission("dashboard");
    const pending = (await countPendingInvites.get(now))?.n ?? 0;
    return staff + pending;
  },
};

const LOCK_KEY = 72_310_501;

let cached: { path: string; mtimeMs: number; plan: InstancePlan } | undefined;

export function planFilePath(): string {
  return process.env.USERCUE_PLAN_FILE?.trim() ?? "";
}

export function resetPlanCache() {
  cached = undefined;
}

function managedPlan(id: PlanId): InstancePlan {
  return { id, managed: true, entitlements: PLANS[id] };
}

const unmanaged: InstancePlan = { id: null, managed: false, entitlements: UNRESTRICTED };

export function parsePlanFile(raw: string): InstancePlan {
  try {
    const body = JSON.parse(raw) as { plan?: unknown };
    if (isPlanId(body?.plan)) return managedPlan(body.plan);
  } catch {}
  return managedPlan("free");
}

export async function currentPlan(): Promise<InstancePlan> {
  const path = planFilePath();
  if (!path) return unmanaged;
  let mtimeMs: number;
  try {
    mtimeMs = (await stat(path)).mtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return unmanaged;
    console.error("Could not read the instance plan file:", error);
    return managedPlan("free");
  }
  if (cached && cached.path === path && cached.mtimeMs === mtimeMs) return cached.plan;
  let plan: InstancePlan;
  try {
    plan = parsePlanFile(await readFile(path, "utf8"));
  } catch (error) {
    console.error("Could not read the instance plan file:", error);
    return managedPlan("free");
  }
  cached = { path, mtimeMs, plan };
  return plan;
}

export async function checkPlanLimit(
  key: PlanLimitKey,
  adding = 1,
): Promise<PlanLimitError | null> {
  if (adding <= 0) return null;
  const plan = await currentPlan();
  const max = plan.entitlements.limits[key];
  if (max === null) return null;
  const used = await usage[key]();
  if (used + adding <= max) return null;
  return {
    error: planLimitMessage(key, plan.entitlements.label, max),
    code: PLAN_LIMIT_ERROR,
    limit: key,
    max,
    used,
  };
}

export async function withinPlanLimit<T>(
  key: PlanLimitKey,
  adding: number,
  action: () => Promise<T>,
): Promise<{ blocked: PlanLimitError } | { result: T }> {
  if (adding <= 0) return { result: await action() };
  return db.transaction(async () => {
    await db.query("SELECT pg_advisory_xact_lock(?)").run(LOCK_KEY);
    const blocked = await checkPlanLimit(key, adding);
    if (blocked) return { blocked };
    return { result: await action() };
  });
}

export async function planSnapshot() {
  const plan = await currentPlan();
  const limits = await Promise.all(
    PLAN_LIMIT_KEYS.map(async (key) => {
      const max = plan.entitlements.limits[key];
      const used = await usage[key]();
      return {
        key,
        label: PLAN_LIMIT_META[key].label,
        unit: PLAN_LIMIT_META[key].unit,
        max,
        used,
        reached: max !== null && used >= max,
      };
    }),
  );
  return {
    id: plan.id,
    label: plan.entitlements.label,
    managed: plan.managed,
    limits,
  };
}
