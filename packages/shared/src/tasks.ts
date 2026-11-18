export const HEALTH_VALUES = ["on_track", "at_risk", "delayed"] as const;
export type Health = (typeof HEALTH_VALUES)[number];

export const HEALTH_META: Record<Health, { label: string; hex: string }> = {
  on_track: { label: "On track", hex: "#1f9d55" },
  at_risk: { label: "At risk", hex: "#e08a12" },
  delayed: { label: "Delayed", hex: "#e11d48" },
};

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "blocked"];

export const isOpenTask = (status: string) => OPEN_TASK_STATUSES.includes(status as TaskStatus);

export const TASK_PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const WORK_LIMITS = {
  taskTitle: 140,
  taskDescription: 8000,
  taskActivity: 2000,
  blockedReason: 500,
} as const;

export const TASK_ACTIVITY_KINDS = ["comment", "status", "member", "blocker"] as const;
export type TaskActivityKind = (typeof TASK_ACTIVITY_KINDS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function todayDateOnly(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
