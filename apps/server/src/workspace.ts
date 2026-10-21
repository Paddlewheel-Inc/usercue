import type { AssignmentMode } from "@usercue/shared";
import { ACCENT_IDS, ASSIGNMENT_MODES, isHexColor, SITE_DEFAULTS } from "@usercue/shared";
import { db } from "./db";
import { encryptSecret, hashSecret } from "./secret";

export interface WorkspaceRow {
  id: number;
  allow_guest_feedback: number;
  resend_enabled: number;
  resend_from: string;
  resend_key_cipher: string;
  resend_key_hash: string;
  smtp_enabled: number;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass_cipher: string;
  smtp_from: string;
  smtp_secure: number;
  assignment_mode: string;
  assignment_cursor: number;
  accent: string;
  logo_url: string;
  logo_dark_url: string;
  changelog_enabled: number;
  changelog_comments: number;
  changelog_reactions: number;
  discord_enabled: number;
  discord_webhook_cipher: string;
  discord_webhook_hash: string;
  teams_enabled: number;
  teams_webhook_cipher: string;
  teams_webhook_hash: string;
  oauth_only: number;
  customer_tags: number;
  customer_tags_required: number;
  site_name: string;
  site_description: string;
  favicon_url: string;
  share_image_url: string;
}

export interface Branding {
  name: string;
  description: string;
  faviconUrl: string;
  shareImageUrl: string;
}

export interface StaffAssignee {
  id: number;
  name: string;
  avatarUrl: string | null;
}

const select = db.query<WorkspaceRow>("SELECT * FROM workspace WHERE id = 1");
const update = db.query(
  `UPDATE workspace SET
     allow_guest_feedback = ?,
     resend_enabled = ?,
     resend_from = ?,
     resend_key_cipher = ?,
     resend_key_hash = ?,
     smtp_enabled = ?,
     smtp_host = ?,
     smtp_port = ?,
     smtp_user = ?,
     smtp_pass_cipher = ?,
     smtp_from = ?,
     smtp_secure = ?,
     assignment_mode = ?,
     changelog_enabled = ?,
     changelog_comments = ?,
     changelog_reactions = ?,
     discord_enabled = ?,
     discord_webhook_cipher = ?,
     discord_webhook_hash = ?,
     teams_enabled = ?,
     teams_webhook_cipher = ?,
     teams_webhook_hash = ?,
     oauth_only = ?,
     customer_tags = ?,
     customer_tags_required = ?
   WHERE id = 1`,
);
const updateBranding = db.query(
  `UPDATE workspace SET
     accent = ?,
     logo_url = ?,
     logo_dark_url = ?,
     site_name = ?,
     site_description = ?,
     favicon_url = ?,
     share_image_url = ?
   WHERE id = 1`,
);
const setCursor = db.query("UPDATE workspace SET assignment_cursor = ? WHERE id = 1");
const listStaff = db.query<{ id: number; name: string; avatar_url: string | null }>(
  `SELECT u.id, u.name, u.avatar_url
   FROM users u
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE u.suspended = 0 AND r.permissions LIKE '%"dashboard"%'
   ORDER BY u.id`,
);

const empty: WorkspaceRow = {
  id: 1,
  allow_guest_feedback: 1,
  resend_enabled: 0,
  resend_from: "",
  resend_key_cipher: "",
  resend_key_hash: "",
  smtp_enabled: 0,
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_pass_cipher: "",
  smtp_from: "",
  smtp_secure: 0,
  assignment_mode: "off",
  assignment_cursor: 0,
  accent: "pink",
  logo_url: "",
  logo_dark_url: "",
  changelog_enabled: 0,
  changelog_comments: 0,
  changelog_reactions: 0,
  discord_enabled: 0,
  discord_webhook_cipher: "",
  discord_webhook_hash: "",
  teams_enabled: 0,
  teams_webhook_cipher: "",
  teams_webhook_hash: "",
  oauth_only: 0,
  customer_tags: 0,
  customer_tags_required: 0,
  site_name: "",
  site_description: "",
  favicon_url: "",
  share_image_url: "",
};

export function parseAssignmentMode(value: string | null | undefined): AssignmentMode {
  return ASSIGNMENT_MODES.find((mode) => mode === value) ?? "off";
}

export function parseAccent(value: string | null | undefined): string {
  const preset = ACCENT_IDS.find((item) => item === value);
  if (preset) return preset;
  if (typeof value === "string" && isHexColor(value)) return value.toLowerCase();
  return "pink";
}

export async function getWorkspace(): Promise<WorkspaceRow> {
  const row = await select.get();
  if (row) return row;
  await db.query("INSERT INTO workspace (id) VALUES (1) ON CONFLICT (id) DO NOTHING").run();
  return (await select.get()) ?? empty;
}

export async function saveWorkspace(patch: {
  allowGuestFeedback?: boolean;
  resendEnabled?: boolean;
  resendFrom?: string;
  resendApiKey?: string;
  smtpEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpSecure?: boolean;
  assignmentMode?: AssignmentMode;
  changelogEnabled?: boolean;
  changelogComments?: boolean;
  changelogReactions?: boolean;
  discordEnabled?: boolean;
  discordWebhookUrl?: string;
  teamsEnabled?: boolean;
  teamsWebhookUrl?: string;
  oauthOnly?: boolean;
  customerTags?: boolean;
  customerTagsRequired?: boolean;
}) {
  const current = await getWorkspace();
  const allow =
    patch.allowGuestFeedback === undefined
      ? current.allow_guest_feedback
      : patch.allowGuestFeedback
        ? 1
        : 0;
  const resend =
    patch.resendEnabled === undefined ? current.resend_enabled : patch.resendEnabled ? 1 : 0;
  const from = patch.resendFrom !== undefined ? patch.resendFrom.trim() : current.resend_from;
  const cipher = patch.resendApiKey?.trim()
    ? encryptSecret(patch.resendApiKey.trim())
    : current.resend_key_cipher;
  const hash = patch.resendApiKey?.trim()
    ? hashSecret(patch.resendApiKey.trim())
    : current.resend_key_hash;
  const smtpEnabled =
    patch.smtpEnabled === undefined ? current.smtp_enabled : patch.smtpEnabled ? 1 : 0;
  const smtpHost = patch.smtpHost !== undefined ? patch.smtpHost.trim() : current.smtp_host;
  const smtpPort = patch.smtpPort ?? current.smtp_port;
  const smtpUser = patch.smtpUser !== undefined ? patch.smtpUser.trim() : current.smtp_user;
  const smtpPassCipher = patch.smtpPass?.trim()
    ? encryptSecret(patch.smtpPass.trim())
    : current.smtp_pass_cipher;
  const smtpFrom = patch.smtpFrom !== undefined ? patch.smtpFrom.trim() : current.smtp_from;
  const smtpSecure =
    patch.smtpSecure === undefined ? current.smtp_secure : patch.smtpSecure ? 1 : 0;
  const mode =
    patch.assignmentMode === undefined
      ? parseAssignmentMode(current.assignment_mode)
      : patch.assignmentMode;
  const flag = (value: boolean | undefined, current: number) =>
    value === undefined ? current : value ? 1 : 0;
  const changelog = flag(patch.changelogEnabled, current.changelog_enabled);
  const changelogComments = flag(patch.changelogComments, current.changelog_comments);
  const changelogReactions = flag(patch.changelogReactions, current.changelog_reactions);
  const discord =
    patch.discordEnabled === undefined ? current.discord_enabled : patch.discordEnabled ? 1 : 0;
  const webhookCipher = patch.discordWebhookUrl?.trim()
    ? encryptSecret(patch.discordWebhookUrl.trim())
    : current.discord_webhook_cipher;
  const webhookHash = patch.discordWebhookUrl?.trim()
    ? hashSecret(patch.discordWebhookUrl.trim())
    : current.discord_webhook_hash;
  const teams =
    patch.teamsEnabled === undefined ? current.teams_enabled : patch.teamsEnabled ? 1 : 0;
  const teamsCipher = patch.teamsWebhookUrl?.trim()
    ? encryptSecret(patch.teamsWebhookUrl.trim())
    : current.teams_webhook_cipher;
  const teamsHash = patch.teamsWebhookUrl?.trim()
    ? hashSecret(patch.teamsWebhookUrl.trim())
    : current.teams_webhook_hash;
  const oauth = flag(patch.oauthOnly, current.oauth_only);
  let customerTags = flag(patch.customerTags, current.customer_tags);
  let customerTagsRequired = flag(patch.customerTagsRequired, current.customer_tags_required);
  if (customerTagsRequired) customerTags = 1;
  if (!customerTags) customerTagsRequired = 0;
  await update.run(
    allow,
    resend,
    from,
    cipher,
    hash,
    smtpEnabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassCipher,
    smtpFrom,
    smtpSecure,
    mode,
    changelog,
    changelogComments,
    changelogReactions,
    discord,
    webhookCipher,
    webhookHash,
    teams,
    teamsCipher,
    teamsHash,
    oauth,
    customerTags,
    customerTagsRequired,
  );
  return getWorkspace();
}

export async function saveBranding(patch: {
  accent?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  siteName?: string;
  siteDescription?: string;
  faviconUrl?: string;
  shareImageUrl?: string;
}) {
  const current = await getWorkspace();
  const text = (value: string | undefined, fallback: string) =>
    value === undefined ? fallback : value.trim();
  await updateBranding.run(
    patch.accent === undefined ? parseAccent(current.accent) : parseAccent(patch.accent),
    text(patch.logoUrl, current.logo_url),
    text(patch.logoDarkUrl, current.logo_dark_url),
    text(patch.siteName, current.site_name),
    text(patch.siteDescription, current.site_description),
    text(patch.faviconUrl, current.favicon_url),
    text(patch.shareImageUrl, current.share_image_url),
  );
  return getWorkspace();
}

export async function workspaceBranding(): Promise<Branding> {
  const row = await getWorkspace();
  return {
    name: row.site_name.trim() || SITE_DEFAULTS.name,
    description: row.site_description.trim() || SITE_DEFAULTS.description,
    faviconUrl: row.favicon_url.trim() || SITE_DEFAULTS.faviconUrl,
    shareImageUrl: row.share_image_url.trim() || SITE_DEFAULTS.shareImageUrl,
  };
}

export async function oauthOnly() {
  return (await getWorkspace()).oauth_only === 1;
}

export async function customerTagMode() {
  const row = await getWorkspace();
  const allowed = row.customer_tags === 1;
  return { allowed, required: allowed && row.customer_tags_required === 1 };
}

export interface ChangelogFlags {
  enabled: boolean;
  comments: boolean;
  reactions: boolean;
}

export async function changelogFlags(): Promise<ChangelogFlags> {
  const row = await getWorkspace();
  return {
    enabled: row.changelog_enabled === 1,
    comments: row.changelog_comments === 1,
    reactions: row.changelog_reactions === 1,
  };
}

export async function guestsAllowed(): Promise<boolean> {
  return (await getWorkspace()).allow_guest_feedback === 1;
}

export async function assignmentMode(): Promise<AssignmentMode> {
  return parseAssignmentMode((await getWorkspace()).assignment_mode);
}

export async function workspaceAccent(): Promise<string> {
  return parseAccent((await getWorkspace()).accent);
}

export async function workspaceLogos(): Promise<{ light: string | null; dark: string | null }> {
  const row = await getWorkspace();
  return {
    light: row.logo_url.trim() || null,
    dark: row.logo_dark_url.trim() || null,
  };
}

export async function listAssignableStaff(): Promise<StaffAssignee[]> {
  return (await listStaff.all()).map((row) => ({
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url || null,
  }));
}

export async function pickNextAssignee(): Promise<StaffAssignee | null> {
  const staff = await listAssignableStaff();
  const first = staff[0];
  if (!first) return null;
  const cursor = (await getWorkspace()).assignment_cursor;
  const next = staff.find((person) => person.id > cursor) ?? first;
  await setCursor.run(next.id);
  return next;
}
