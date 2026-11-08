export const PLAN_IDS = ["free", "paid"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_LIMIT_KEYS = ["staffSeats"] as const;
export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

export interface PlanEntitlements {
  label: string;
  limits: Record<PlanLimitKey, number | null>;
}

export const PLANS: Record<PlanId, PlanEntitlements> = {
  free: { label: "Free", limits: { staffSeats: 5 } },
  paid: { label: "Pro", limits: { staffSeats: null } },
};

export const UNRESTRICTED: PlanEntitlements = {
  label: "Self-hosted",
  limits: { staffSeats: null },
};

export const PLAN_LIMIT_META: Record<
  PlanLimitKey,
  { label: string; unit: string; reached: (planLabel: string, limit: number) => string }
> = {
  staffSeats: {
    label: "Staff users",
    unit: "staff seats",
    reached: (planLabel, limit) =>
      `This instance has reached its limit of ${limit} staff users on the ${planLabel} plan. Pending invites count toward the limit. Upgrade this instance to Pro, or get an additional instance, to invite more people.`,
  },
};

export const PLAN_LIMIT_ERROR = "plan_limit";

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function planLimitMessage(key: PlanLimitKey, planLabel: string, limit: number): string {
  return PLAN_LIMIT_META[key].reached(planLabel, limit);
}
