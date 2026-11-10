export const PRIORITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export function isPriorityLevel(value: unknown): value is PriorityLevel {
  return PRIORITY_LEVELS.some((level) => level === value);
}

export function priorityScore(
  votes: number,
  impact: number | null,
  effort: number | null,
): number | null {
  if (impact === null || effort === null || effort <= 0) return null;
  return Math.round(((votes + 1) * impact * 10) / effort) / 10;
}
