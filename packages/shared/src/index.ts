export const STATUSES = ["open", "planned", "in_progress", "complete", "closed"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In Progress",
  complete: "Complete",
  closed: "Closed",
};

export const SORTS = ["top", "new"] as const;
export type Sort = (typeof SORTS)[number];

export const ASSIGNMENT_MODES = ["off", "manual", "auto"] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export const ASSIGNMENT_LABELS: Record<AssignmentMode, string> = {
  off: "Off",
  manual: "Manual",
  auto: "Automatic",
};

export const ACCENT_IDS = [
  "pink",
  "rose",
  "coral",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const ACCENTS: { id: AccentId; label: string; hex: string }[] = [
  { id: "pink", label: "Pink", hex: "#ff2b87" },
  { id: "rose", label: "Rose", hex: "#e11d48" },
  { id: "coral", label: "Coral", hex: "#f15a36" },
  { id: "amber", label: "Amber", hex: "#e08a12" },
  { id: "green", label: "Green", hex: "#1f9d55" },
  { id: "teal", label: "Teal", hex: "#0f9d90" },
  { id: "blue", label: "Blue", hex: "#3b6ef5" },
  { id: "violet", label: "Violet", hex: "#7c4dff" },
];

export const TAG_COLOR_IDS = [
  "pink",
  "rose",
  "coral",
  "amber",
  "lime",
  "green",
  "teal",
  "sky",
  "blue",
  "violet",
  "stone",
] as const;
export type TagColor = (typeof TAG_COLOR_IDS)[number];

export const TAG_COLORS: { id: TagColor; hex: string }[] = [
  { id: "pink", hex: "#ff2b87" },
  { id: "rose", hex: "#e11d48" },
  { id: "coral", hex: "#f15a36" },
  { id: "amber", hex: "#e08a12" },
  { id: "lime", hex: "#7da317" },
  { id: "green", hex: "#1f9d55" },
  { id: "teal", hex: "#0f9d90" },
  { id: "sky", hex: "#2f8fbf" },
  { id: "blue", hex: "#3b6ef5" },
  { id: "violet", hex: "#7c4dff" },
  { id: "stone", hex: "#8a8178" },
];

export function tagColorHex(color: string): string {
  return TAG_COLORS.find((item) => item.id === color)?.hex ?? "#8a8178";
}

export const CHANGELOG_REACTION_IDS = ["up", "party", "heart", "rocket"] as const;
export type ChangelogReaction = (typeof CHANGELOG_REACTION_IDS)[number];

export const CHANGELOG_REACTIONS: { id: ChangelogReaction; label: string; emoji: string }[] = [
  { id: "up", label: "Like", emoji: "👍" },
  { id: "party", label: "Celebrate", emoji: "🎉" },
  { id: "heart", label: "Love", emoji: "❤️" },
  { id: "rocket", label: "Ship", emoji: "🚀" },
];

export const CHANGELOG_SECTIONS = ["New", "Changed", "Fixed", "Removed"] as const;
export type ChangelogSection = (typeof CHANGELOG_SECTIONS)[number];

export const CHANGELOG_LIMITS = {
  sectionLabel: 40,
  contributors: 20,
} as const;

export function changelogSectionLabel(value: string): ChangelogSection | null {
  const query = value.trim().toLowerCase();
  return CHANGELOG_SECTIONS.find((label) => label.toLowerCase() === query) ?? null;
}

export function changelogSectionChip(label: ChangelogSection): string {
  return `<span data-section="${label}" contenteditable="false">${label}</span>`;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export const LIMITS = {
  title: 140,
  body: 8000,
  comment: 2000,
  name: 60,
  imageBytes: 1_500_000,
  mentions: 8,
  roleMentions: 3,
} as const;

export {
  IMAGE_WIDTH,
  isEmptyHtml,
  isPostHref,
  mentionChip,
  parseMentionIds,
  parseRoleMentionIds,
  roleMentionChip,
  sanitizeHtml,
  stripHtml,
} from "./html";

export const PERMISSIONS = [
  "dashboard",
  "manage_posts",
  "manage_boards",
  "manage_settings",
  "manage_branding",
  "manage_users",
  "manage_roles",
  "manage_staff",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_META: Record<Permission, { label: string; description: string }> = {
  dashboard: {
    label: "Dashboard",
    description: "Open the staff workspace and triage inbox.",
  },
  manage_posts: {
    label: "Manage posts",
    description: "Change status, edit, and delete posts.",
  },
  manage_boards: {
    label: "Manage boards",
    description: "Create and rename feedback boards.",
  },
  manage_settings: {
    label: "Workspace settings",
    description: "Change general and authentication settings.",
  },
  manage_branding: {
    label: "Branding",
    description: "Change the workspace name, description, icons, logo, and color.",
  },
  manage_users: {
    label: "Manage users",
    description: "View, suspend, and delete registered accounts.",
  },
  manage_roles: {
    label: "Manage roles",
    description: "Create roles and choose their permissions.",
  },
  manage_staff: {
    label: "Manage staff",
    description: "Invite people to the workspace and remove staff.",
  },
};

export const SITE_DEFAULTS = {
  name: "UserCue",
  description:
    "Collect feedback, prioritize with your team, and keep customers in the loop from one place.",
  faviconUrl: "/usercue.svg",
  shareImageUrl: "/og.png",
} as const;

export const SITE_LIMITS = { name: 60, description: 200 } as const;

export const AUTH_PROVIDERS = ["github", "discord", "google", "roblox", "azure"] as const;
export type AuthProviderId = (typeof AUTH_PROVIDERS)[number];

export const AUTH_PROVIDER_META: Record<
  AuthProviderId,
  { label: string; console: string; redirectField: string; hint?: string }
> = {
  github: {
    label: "GitHub",
    console: "https://github.com/settings/developers",
    redirectField: "Authorization callback URL",
  },
  discord: {
    label: "Discord",
    console: "https://discord.com/developers/applications",
    redirectField: "Redirects",
  },
  google: {
    label: "Google",
    console: "https://console.cloud.google.com/apis/credentials",
    redirectField: "Authorized redirect URIs",
  },
  roblox: {
    label: "Roblox",
    console: "https://create.roblox.com/dashboard/credentials",
    redirectField: "Redirect URLs",
    hint: "Roblox does not share an email. A new account is created from the Roblox user id.",
  },
  azure: {
    label: "Azure",
    console: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    redirectField: "Redirect URI",
    hint: "Use a multitenant app registration. Personal and work Microsoft accounts both sign in through the common endpoint.",
  },
};
