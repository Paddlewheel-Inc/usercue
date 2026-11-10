export const SAVED_VIEW_KEYS = [
  "status",
  "board",
  "tag",
  "assignee",
  "minVotes",
  "sort",
  "q",
] as const;
export const SAVED_VIEW_LIMITS = { name: 40, perUser: 30, value: 100 } as const;

export function normalizeViewQuery(raw: string): string {
  const params = new URLSearchParams(raw);
  const clean = new URLSearchParams();
  for (const key of SAVED_VIEW_KEYS) {
    const value = params.get(key)?.trim().slice(0, SAVED_VIEW_LIMITS.value);
    if (value) clean.set(key, value);
  }
  return clean.toString();
}
