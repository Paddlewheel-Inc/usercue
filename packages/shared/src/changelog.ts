export const CHANGELOG_PUBLICATION_STATUSES = ["draft", "scheduled", "published"] as const;
export type ChangelogPublicationStatus = (typeof CHANGELOG_PUBLICATION_STATUSES)[number];

export function changelogPublicationStatus(
  publishedAt: number | null,
  now: number,
): ChangelogPublicationStatus {
  return publishedAt === null ? "draft" : publishedAt > now ? "scheduled" : "published";
}

/** Resolve a publishing action without changing the date of an already published entry. */
export function resolveChangelogPublication(
  action: { publicationStatus?: ChangelogPublicationStatus; publishAt?: number },
  current: number | null,
  now: number,
): number | null {
  const status = action.publicationStatus ?? changelogPublicationStatus(current, now);
  if (action.publishAt !== undefined && status !== "scheduled") {
    throw new Error("Choose scheduled publishing to set a publication time.");
  }
  if (status === "draft") return null;
  if (status === "published") return current !== null && current <= now ? current : now;
  const timestamp = action.publishAt ?? current;
  if (timestamp === null || !Number.isSafeInteger(timestamp) || timestamp <= now) {
    throw new Error("Choose a publication time in the future.");
  }
  return timestamp;
}
