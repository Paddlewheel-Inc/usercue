export const WEBHOOK_EVENT_IDS = [
  "post.created",
  "post.status_changed",
  "post.merged",
  "comment.created",
  "changelog.published",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENT_IDS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "post.created": "New post",
  "post.status_changed": "Status changed",
  "post.merged": "Posts merged",
  "comment.created": "New comment",
  "changelog.published": "Changelog entry published",
};

export const WEBHOOK_LIMITS = { name: 60, url: 2000, perWorkspace: 20 } as const;
