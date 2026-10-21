import {
  ACCENTS,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_MODES,
  type AssignmentMode,
  isHexColor,
  type Permission,
  SITE_DEFAULTS,
  SITE_LIMITS,
  TAG_COLORS,
  type TagColor,
  tagColorHex,
} from "@usercue/shared";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, Redirect, useParams } from "wouter";
import { ArrowUpRight, Check, ChevronDown, More, Plus, Trash } from "../components/icons";
import { ProviderIcon } from "../components/OAuthButtons";
import { Avatar, Checkbox, CopyField, ErrorText, useToast } from "../components/ui";
import { uploadImage } from "../lib/api";
import { timeAgo } from "../lib/format";
import {
  type AuthProvider,
  can,
  useCreateRole,
  useCreateTag,
  useDeleteProvider,
  useDeleteRole,
  useDeleteTag,
  useDeleteWorkspaceUser,
  useInviteStaff,
  useMe,
  useProviders,
  useRemoveStaff,
  useReorderRoles,
  useRevokeInvite,
  useRoles,
  useSaveBranding,
  useSaveProvider,
  useSaveSettings,
  useSettings,
  useTags,
  useUpdateRole,
  useUpdateTag,
  useUpdateWorkspaceUser,
  useWorkspaceUsers,
} from "../lib/queries";
import { AdminShell } from "./Admin";

const TABS = [
  { id: "general", href: "/admin/settings", label: "General" },
  { id: "branding", href: "/admin/settings/branding", label: "Branding" },
  { id: "tags", href: "/admin/settings/tags", label: "Tags" },
  { id: "auth", href: "/admin/settings/auth", label: "Authentication" },
  { id: "users", href: "/admin/settings/users", label: "Users" },
  { id: "roles", href: "/admin/settings/roles", label: "Roles" },
] as const;

type SettingsTab = (typeof TABS)[number]["id"];

export function Settings() {
  const { data: me } = useMe();
  const params = useParams<{ tab?: string }>();
  const requested = TABS.some((tab) => tab.id === params.tab)
    ? (params.tab as SettingsTab)
    : "general";

  const visible = TABS.filter((tab) => {
    if (tab.id === "general") return can(me, "manage_settings") || can(me, "manage_staff");
    if (tab.id === "branding") return can(me, "manage_branding");
    if (tab.id === "tags") return can(me, "manage_posts") || can(me, "manage_settings");
    if (tab.id === "auth") return can(me, "manage_settings");
    if (tab.id === "users") return can(me, "manage_users");
    return can(me, "manage_roles");
  });

  const tab = visible.some((item) => item.id === requested) ? requested : visible[0]?.id;
  const wide = tab === "users" || tab === "roles";

  if (!tab) {
    return (
      <AdminShell settings>
        <section className="min-w-0 flex-1 overflow-y-auto">
          <p className="px-5 py-8 text-muted sm:px-8">You don&apos;t have access to settings.</p>
        </section>
      </AdminShell>
    );
  }

  if (tab !== requested) return <Redirect to={visible[0]?.href ?? "/admin"} />;

  return (
    <AdminShell settings>
      <section className="min-w-0 flex-1 overflow-y-auto">
        <div
          className={`flex flex-col gap-7 px-5 py-7 sm:px-8 sm:py-10 ${wide ? "max-w-2xl" : "max-w-xl"}`}
        >
          <header className="flex flex-col gap-4">
            <div>
              <h1 className="text-base font-semibold tracking-tight">Settings</h1>
              <p className="mt-1.5 text-muted">
                Control who can leave feedback and who can triage it.
              </p>
            </div>
            <nav className="flex flex-wrap gap-1">
              {visible.map((item) => (
                <TabLink key={item.id} href={item.href} active={tab === item.id}>
                  {item.label}
                </TabLink>
              ))}
            </nav>
          </header>
          {tab === "auth" ? (
            <AuthSettings />
          ) : tab === "branding" ? (
            <BrandingSettings />
          ) : tab === "tags" ? (
            <TagsSettings />
          ) : tab === "users" ? (
            <UsersSettings />
          ) : tab === "roles" ? (
            <RolesSettings />
          ) : (
            <GeneralSettings />
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] transition-colors ${
        active
          ? "bg-surface font-medium text-fg shadow-(--shadow)"
          : "text-muted hover:bg-hover/70 hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

function ResendSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const [from, setFrom] = useState(data?.resend.from ?? "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.resend.enabled));

  useEffect(() => {
    if (!data) return;
    setFrom(data.resend.from ?? "");
    setApiKey("");
    setEnabled(data.resend.enabled);
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      {
        resendFrom: from,
        resendApiKey: apiKey.trim() || undefined,
        resendEnabled: enabled,
      },
      {
        onSuccess: () => toast({ message: "Resend settings saved." }),
        onError: (error) => toast({ message: error.message, tone: "error" }),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-medium">Invite email</h2>
        <p className="mt-1 text-[12px] text-muted">
          Staff invites always get a registration link. Add a Resend API key and from address to
          email it too. The key is hashed and encrypted. We never show it again.
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">From email</span>
        <input
          className="input"
          type="text"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="UserCue <noreply@yourdomain.com>"
          autoComplete="off"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">API key</span>
        <input
          className="input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          placeholder={
            data.resend.keyHash || data.resend.fromEnv
              ? "Leave blank to keep the current key"
              : "re_…"
          }
        />
        {!data.resend.keyHash && data.resend.fromEnv && (
          <p className="px-1 text-[11px] text-faint">Using the key from the environment.</p>
        )}
      </label>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Email staff invites with Resend
      </Checkbox>
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          Save
        </button>
      </div>
    </form>
  );
}

function SmtpSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const [host, setHost] = useState(data?.smtp?.host ?? "");
  const [port, setPort] = useState(String(data?.smtp?.port ?? 587));
  const [user, setUser] = useState(data?.smtp?.user ?? "");
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState(data?.smtp?.from ?? "");
  const [secure, setSecure] = useState(Boolean(data?.smtp?.secure));
  const [enabled, setEnabled] = useState(Boolean(data?.smtp?.enabled));

  useEffect(() => {
    if (!data?.smtp) return;
    setHost(data.smtp.host ?? "");
    setPort(String(data.smtp.port ?? 587));
    setUser(data.smtp.user ?? "");
    setPassword("");
    setFrom(data.smtp.from ?? "");
    setSecure(data.smtp.secure);
    setEnabled(data.smtp.enabled);
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      {
        smtpHost: host,
        smtpPort: Number(port),
        smtpUser: user,
        smtpPass: password.trim() || undefined,
        smtpFrom: from,
        smtpSecure: secure,
        smtpEnabled: enabled,
      },
      {
        onSuccess: () => toast({ message: "SMTP settings saved." }),
        onError: (error) => toast({ message: error.message, tone: "error" }),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-medium">SMTP email</h2>
        <p className="mt-1 text-[12px] text-muted">
          Use your own SMTP server for staff invite emails. The password is encrypted and never
          shown again.
        </p>
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Host</span>
          <input
            className="input"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.example.com"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Port</span>
          <input
            className="input"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Username</span>
        <input
          className="input"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          placeholder={
            data.smtp?.passConfigured || data.smtp?.fromEnv
              ? "Leave blank to keep the current password"
              : "SMTP password"
          }
        />
        {!data.smtp?.passConfigured && data.smtp?.fromEnv && (
          <p className="px-1 text-[11px] text-faint">
            Using SMTP credentials from the environment.
          </p>
        )}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">From email</span>
        <input
          className="input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="UserCue <noreply@yourdomain.com>"
          autoComplete="off"
          required={Boolean(host.trim())}
        />
      </label>
      <Checkbox checked={secure} onChange={setSecure}>
        Use a secure connection
      </Checkbox>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Email staff invites with SMTP
      </Checkbox>
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          Save
        </button>
      </div>
    </form>
  );
}

function DiscordSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const [webhook, setWebhook] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.discord.enabled));

  useEffect(() => {
    if (!data) return;
    setWebhook("");
    setEnabled(data.discord.enabled);
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      discordWebhookUrl: webhook.trim() || undefined,
      discordEnabled: enabled,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-medium">Discord</h2>
        <p className="mt-1 text-[12px] text-muted">
          Post new suggestions, status changes, and comments to a Discord channel. Paste the webhook
          URL from the channel&apos;s Integrations settings. It is encrypted. We never show it
          again.
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Webhook URL</span>
        <input
          className="input"
          type="password"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            data.discord.configured
              ? "Leave blank to keep the current webhook"
              : "https://discord.com/api/webhooks/…"
          }
        />
      </label>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Send workspace activity to Discord
      </Checkbox>
      <div className="flex items-center gap-2">
        <ErrorText error={save.error} />
        <div className="flex-1" />
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          Save
        </button>
      </div>
    </form>
  );
}

function TeamsSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const [webhook, setWebhook] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.teams.enabled));

  useEffect(() => {
    if (!data) return;
    setWebhook("");
    setEnabled(data.teams.enabled);
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      teamsWebhookUrl: webhook.trim() || undefined,
      teamsEnabled: enabled,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-medium">Teams</h2>
        <p className="mt-1 text-[12px] text-muted">
          Post new suggestions, status changes, and comments to a Teams channel. Paste the incoming
          webhook from Workflows, or a classic connector URL. It is encrypted. We never show it
          again.
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Webhook URL</span>
        <input
          className="input"
          type="password"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            data.teams.configured
              ? "Leave blank to keep the current webhook"
              : "https://….logic.azure.com/workflows/…"
          }
        />
      </label>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Send workspace activity to Teams
      </Checkbox>
      <div className="flex items-center gap-2">
        <ErrorText error={save.error} />
        <div className="flex-1" />
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          Save
        </button>
      </div>
    </form>
  );
}

function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(value) ? `#${value.toLowerCase()}` : null;
}

function CustomAccent({
  value,
  disabled,
  onSelect,
}: {
  value: string;
  disabled?: boolean;
  onSelect: (accent: string) => void;
}) {
  const presetHex = ACCENTS.find((color) => color.id === value)?.hex ?? "#ff2b87";
  const selected = isHexColor(value);
  const [hex, setHex] = useState(selected ? value : presetHex);

  useEffect(() => {
    setHex(
      isHexColor(value) ? value : (ACCENTS.find((color) => color.id === value)?.hex ?? "#ff2b87"),
    );
  }, [value]);

  const normalized = normalizeHex(hex);

  function apply() {
    if (normalized && normalized !== value) onSelect(normalized);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className={`relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border p-0.5 transition-colors ${
          selected ? "border-accent" : "border-line hover:border-muted"
        }`}
        style={
          selected
            ? { boxShadow: "0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent)" }
            : undefined
        }
      >
        <input
          type="color"
          value={normalized ?? presetHex}
          disabled={disabled}
          className="size-full cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
        />
        <span className="sr-only">Pick a custom accent color</span>
      </label>
      <span className="w-28">
        <input
          className="input h-8 font-mono text-[12px]"
          value={hex}
          maxLength={7}
          disabled={disabled}
          spellCheck={false}
          aria-label="Custom hex color"
          placeholder="#ff2b87"
          onChange={(e) => setHex(e.target.value.replace(/[^#0-9a-fA-F]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
      </span>
      <button
        type="button"
        className={`h-8 rounded-full px-3 text-[13px] transition-colors ${
          selected
            ? "bg-surface font-medium text-fg shadow-(--shadow)"
            : "bg-hover text-fg hover:bg-line"
        }`}
        disabled={disabled || !normalized || normalized === value}
        onClick={apply}
      >
        Custom
      </button>
    </div>
  );
}

function assignmentHint(mode: AssignmentMode) {
  if (mode === "off") return "Nobody can be assigned. The field stays hidden.";
  if (mode === "manual") return "Staff pick who takes a suggestion.";
  return "When a suggestion becomes Planned, the next staff member in line gets it.";
}

type BrandingImage = "logoUrl" | "logoDarkUrl" | "faviconUrl" | "shareImageUrl";

function ImageSlot({
  label,
  value,
  fallback,
  field,
  preview,
}: {
  label: string;
  value: string | null | undefined;
  fallback: string;
  field: BrandingImage;
  preview: (src: string) => ReactNode;
}) {
  const save = useSaveBranding();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      save.mutate({ [field]: url }, { onError: setError });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {preview(value || fallback)}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[12px] text-muted">{label}</span>
        <div className="flex items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pick(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn-quiet h-7 px-2.5"
            disabled={busy || save.isPending}
            onClick={() => input.current?.click()}
          >
            {busy ? "Uploading…" : value ? "Change" : "Add"}
          </button>
          {value && (
            <button
              type="button"
              className="btn-quiet h-7 px-2.5"
              disabled={save.isPending}
              onClick={() => save.mutate({ [field]: "" })}
            >
              Use default
            </button>
          )}
        </div>
      </div>
      <ErrorText error={error ?? save.error ?? null} />
    </div>
  );
}

function SectionHead({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-medium">{title}</h2>
      <p className="mt-1 text-[12px] text-muted">{children}</p>
    </div>
  );
}

function logoWell(well: string) {
  return (src: string) => (
    <span
      className={`inline-flex h-12 min-w-16 items-center justify-center rounded-xl px-3 ${well}`}
    >
      <img src={src} alt="" className="h-6 w-auto max-w-28 object-contain" />
    </span>
  );
}

function SiteDetails() {
  const { data } = useSettings();
  const save = useSaveBranding();
  const [name, setName] = useState(data?.siteName ?? "");
  const [description, setDescription] = useState(data?.siteDescription ?? "");
  const [saved, setSaved] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      { siteName: name, siteDescription: description },
      {
        onSuccess: () => {
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <SectionHead title="Name and description">
        Shown in the browser tab, search results, and link previews. Leave them empty to use the
        UserCue defaults.
      </SectionHead>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={SITE_LIMITS.name}
          placeholder={SITE_DEFAULTS.name}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Description</span>
        <textarea
          className="input h-auto min-h-20 resize-none rounded-2xl py-2.5 leading-5"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={SITE_LIMITS.description}
          placeholder={SITE_DEFAULTS.description}
          rows={3}
        />
      </label>
      <div className="flex items-center gap-2">
        <ErrorText error={save.error} />
        <div className="flex-1" />
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {saved && !save.error ? (
            <>
              <Check width={12} height={12} />
              Saved
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </form>
  );
}

function BrandingSettings() {
  const { data, isLoading } = useSettings();
  const save = useSaveBranding();

  if (isLoading || !data) return null;

  const siteName = data.siteName || SITE_DEFAULTS.name;

  return (
    <div className="flex flex-col gap-10">
      <SiteDetails />

      <section className="flex flex-col gap-3">
        <SectionHead title="Logo">
          The mark in the header, next to Feedback and Roadmap. Add one for light mode and one for
          dark. If dark is empty, the light image is used. PNG, JPEG, or SVG.
        </SectionHead>
        <ImageSlot
          label="Light"
          value={data.logoUrl}
          fallback={data.logoDarkUrl || "/usercue.svg"}
          field="logoUrl"
          preview={logoWell("bg-[#fffaf3]")}
        />
        <ImageSlot
          label="Dark"
          value={data.logoDarkUrl}
          fallback={data.logoUrl || "/usercue.svg"}
          field="logoDarkUrl"
          preview={logoWell("bg-[#080706]")}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead title="Browser icon">
          The small icon in the browser tab and bookmarks. Use a square image. SVG or PNG works
          best.
        </SectionHead>
        <ImageSlot
          label="Icon"
          value={data.faviconUrl}
          fallback={SITE_DEFAULTS.faviconUrl}
          field="faviconUrl"
          preview={(src) => (
            <span className="inline-flex h-12 w-40 items-center gap-2 rounded-xl bg-hover px-3">
              <img src={src} alt="" className="size-4 shrink-0 object-contain" />
              <span className="truncate text-[12px]">{siteName}</span>
            </span>
          )}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead title="Link preview">
          The image shown when someone shares a link to the board in chat or on social media. Posts
          and changelog entries get their own card. 1200 by 630 works best.
        </SectionHead>
        <ImageSlot
          label="Image"
          value={data.shareImageUrl}
          fallback={SITE_DEFAULTS.shareImageUrl}
          field="shareImageUrl"
          preview={(src) => (
            <span className="inline-flex aspect-[1200/630] w-40 overflow-hidden rounded-xl bg-hover">
              <img src={src} alt="" className="size-full object-cover" />
            </span>
          )}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead title="Color">
          The accent on buttons, links, and hearts. Pink is the UserCue default.
        </SectionHead>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((color) => {
            const selected = data.accent === color.id;
            return (
              <button
                key={color.id}
                type="button"
                aria-pressed={selected}
                disabled={save.isPending}
                onClick={() => save.mutate({ accent: color.id })}
                className={`inline-flex h-8 items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-[13px] transition-colors ${
                  selected
                    ? "bg-surface font-medium text-fg shadow-(--shadow)"
                    : "text-muted hover:bg-hover hover:text-fg"
                }`}
              >
                <span
                  className="size-5 rounded-full transition-shadow duration-500"
                  style={{
                    background: color.hex,
                    boxShadow: selected
                      ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${color.hex}`
                      : undefined,
                  }}
                />
                {color.label}
              </button>
            );
          })}
        </div>
        <CustomAccent
          value={data.accent}
          disabled={save.isPending}
          onSelect={(accent) => save.mutate({ accent })}
        />
      </section>
    </div>
  );
}

function GeneralSettings() {
  const { data: me } = useMe();
  const { data, isLoading } = useSettings();
  const save = useSaveSettings();
  const invite = useInviteStaff();
  const revoke = useRevokeInvite();
  const remove = useRemoveStaff();
  const [email, setEmail] = useState("");
  const [lastLink, setLastLink] = useState<string>();
  const [promoted, setPromoted] = useState<string>();
  const canSettings = can(me, "manage_settings");
  const canStaff = can(me, "manage_staff");

  if (isLoading || !data) return null;

  function toggleGuest(allowGuestFeedback: boolean) {
    save.mutate({ allowGuestFeedback });
  }

  function submitInvite(e: FormEvent) {
    e.preventDefault();
    invite.mutate(email, {
      onSuccess: (row) => {
        setEmail("");
        if ("promoted" in row && row.promoted) {
          setPromoted(row.name ?? email);
          setLastLink(undefined);
          return;
        }
        setPromoted(undefined);
        if ("url" in row) setLastLink(row.url);
      },
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {canSettings && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13px] font-medium">Feedback</h2>
            <p className="mt-1 text-[12px] text-muted">
              Guests can post with just a name. Turn this off to require a connected account before
              someone can share feedback.
            </p>
          </div>
          <Checkbox
            checked={data.allowGuestFeedback}
            disabled={save.isPending}
            onChange={toggleGuest}
          >
            Allow guests to post feedback without signing in
          </Checkbox>
        </section>
      )}

      {canSettings && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13px] font-medium">Changelog</h2>
            <p className="mt-1 text-[12px] text-muted">
              Staff write the updates. Comments and reactions are their own switches, and stay as
              you left them if you hide the changelog.
            </p>
          </div>
          <Checkbox
            checked={data.changelogEnabled}
            disabled={save.isPending}
            onChange={(changelogEnabled) => save.mutate({ changelogEnabled })}
          >
            Publish the changelog
          </Checkbox>
          <Checkbox
            checked={data.changelogComments}
            disabled={save.isPending}
            onChange={(changelogComments) => save.mutate({ changelogComments })}
          >
            Allow comments on updates
          </Checkbox>
          <Checkbox
            checked={data.changelogReactions}
            disabled={save.isPending}
            onChange={(changelogReactions) => save.mutate({ changelogReactions })}
          >
            Allow reactions on updates
          </Checkbox>
          {data.changelogEnabled && data.changelogRssUrl && (
            <div className="flex flex-col gap-2 pt-1">
              <CopyField label="RSS feed" value={data.changelogRssUrl} />
              <p className="px-1 text-[12px] text-muted">
                Only staff can see this link. Share the address with anyone who should subscribe.
              </p>
            </div>
          )}
        </section>
      )}

      {canSettings && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13px] font-medium">Assignment</h2>
            <p className="mt-1 text-[12px] text-muted">
              Decide if staff get put on a suggestion. Automatic hands it to the next person in line
              when something becomes Planned.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {ASSIGNMENT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate({ assignmentMode: mode })}
                className={`flex flex-col items-start gap-0.5 rounded-2xl px-3.5 py-3 text-left transition-colors ${
                  data.assignmentMode === mode
                    ? "bg-accent-soft text-fg"
                    : "bg-hover/60 text-muted hover:bg-hover hover:text-fg"
                }`}
              >
                <span className="text-[13px] font-medium text-fg">{ASSIGNMENT_LABELS[mode]}</span>
                <span className="text-[12px] text-muted">{assignmentHint(mode)}</span>
              </button>
            ))}
          </div>
          <ErrorText error={save.error} />
        </section>
      )}

      {canSettings && <ResendSettings />}

      {canSettings && <SmtpSettings />}

      {canSettings && <DiscordSettings />}

      {canSettings && <TeamsSettings />}

      {canStaff && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-[13px] font-medium">Staff</h2>
            <p className="mt-1 text-[12px] text-muted">
              Invite someone to the dashboard. They set their own password from the registration
              link.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {data.staff.map((person) => (
              <li key={person.id} className="flex items-center gap-2.5">
                <Avatar name={person.name} src={person.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{person.name}</p>
                  <p className="truncate text-[11px] text-faint">
                    {person.email}
                    {person.roleName ? ` · ${person.roleName}` : ""}
                  </p>
                </div>
                {person.id !== me?.user?.id && (
                  <button
                    type="button"
                    className="btn-quiet h-7 px-2.5"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm(`Remove ${person.name} from staff?`)) remove.mutate(person.id);
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={submitInvite} className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input"
              type="email"
              placeholder="staff@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary shrink-0" disabled={invite.isPending}>
              Invite
            </button>
          </form>
          <ErrorText error={invite.error ?? remove.error ?? revoke.error} />
          {promoted && (
            <p className="text-[12px] text-muted">
              {promoted} already had an account. They can now open the workspace.
            </p>
          )}
          {lastLink && (
            <CopyField
              label={
                invite.data && "emailSent" in invite.data && invite.data.emailSent
                  ? "Invite emailed. You can still copy the link"
                  : "Registration link"
              }
              value={lastLink}
            />
          )}

          {data.invites.length > 0 && (
            <div className="flex flex-col gap-3 border-t pt-4">
              <p className="text-[11px] font-medium tracking-[0.12em] text-faint uppercase">
                Pending invites
              </p>
              {data.invites.map((row) => (
                <div key={row.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px]">{row.email}</p>
                    <span className="text-[11px] text-faint">
                      {row.emailSent ? "Emailed · " : ""}
                      expires {timeAgo(row.expiresAt)}
                    </span>
                    <button
                      type="button"
                      className="btn-quiet h-7 px-2.5"
                      onClick={() => revoke.mutate(row.id)}
                    >
                      Revoke
                    </button>
                  </div>
                  <CopyField label="Registration link" value={row.url} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function AuthSettings() {
  const { data: providers, isLoading } = useProviders();
  const { data: settings } = useSettings();
  const save = useSaveSettings();

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Checkbox
          checked={settings?.oauthOnly ?? false}
          disabled={save.isPending}
          onChange={(checked) => save.mutate({ oauthOnly: checked })}
        >
          Require a connected account. Email and password stay off the login page.
        </Checkbox>
        <p className="pl-7 text-[12px] leading-5 text-muted">
          Link a method to your own account before you turn this on. Password sign-in stops for
          everyone, including staff.
        </p>
        <ErrorText error={save.error} />
      </div>
      <p className="text-[12px] text-muted">
        Client secrets are hashed and encrypted at rest. The raw key is never shown again.
      </p>
      {providers?.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
      {!isLoading && !providers?.length && (
        <p className="text-muted">No authentication providers are available.</p>
      )}
    </div>
  );
}

function ProviderCard({ provider }: { provider: AuthProvider }) {
  const save = useSaveProvider(provider.id);
  const remove = useDeleteProvider(provider.id);
  const [clientId, setClientId] = useState(provider.clientId);
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(provider.enabled);
  const [allowSignup, setAllowSignup] = useState(provider.allowSignup);

  useEffect(() => {
    setClientId(provider.clientId);
    setSecret("");
    setEnabled(provider.enabled);
    setAllowSignup(provider.allowSignup);
  }, [provider]);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      clientId,
      secret: secret.trim() || undefined,
      enabled,
      allowSignup,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-7 items-center justify-center text-fg">
          <ProviderIcon id={provider.id} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium">{provider.label}</h2>
          <p className="text-[11px] text-faint">
            {provider.configured
              ? enabled
                ? "Enabled"
                : "Saved, currently off"
              : "Not configured"}
          </p>
        </div>
        <a
          href={provider.console}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-fg"
        >
          Console
          <ArrowUpRight className="size-3 opacity-60" />
        </a>
      </div>

      {provider.hint && <p className="text-[12px] leading-5 text-muted">{provider.hint}</p>}

      <CopyField label={`Paste this into ${provider.redirectField}`} value={provider.redirectUrl} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Client ID</span>
          <input
            className="input"
            type="password"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Client secret</span>
          <input
            className="input"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={provider.configured ? "Keep current secret" : "Client secret"}
            required={!provider.configured}
          />
        </label>
      </div>

      <Checkbox checked={enabled} onChange={setEnabled}>
        Enable this method
      </Checkbox>
      <Checkbox checked={allowSignup} onChange={setAllowSignup}>
        <span className="text-muted">
          Allow new team accounts from {provider.label}. Leave off unless anyone with this login
          should join the dashboard.
        </span>
      </Checkbox>

      <div className="flex items-center gap-2">
        <ErrorText error={save.error ?? remove.error} />
        <div className="flex-1" />
        {provider.configured && (
          <button
            type="button"
            className="btn-quiet"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Remove ${provider.label} and delete its stored secret?`)) {
                remove.mutate();
              }
            }}
          >
            Remove
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {provider.configured ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

function UsersSettings() {
  const { data: me } = useMe();
  const { data, isLoading } = useWorkspaceUsers();
  const { data: roles } = useRoles();
  const update = useUpdateWorkspaceUser();
  const remove = useDeleteWorkspaceUser();

  if (isLoading || !data) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[13px] font-medium">Registered users</h2>
        <p className="mt-1 text-[12px] text-muted">
          Suspend someone to stop posts and comments. Deleting an account signs them out.
        </p>
      </div>

      {data.users.length === 0 && (
        <p className="text-[13px] text-muted">No registered users yet.</p>
      )}

      {data.users.length > 0 && (
        <ul className="card">
          {data.users.map((person) => {
            const self = person.id === me?.user?.id;
            const current = roles?.roles.find((role) => role.id === person.roleId);
            return (
              <li
                key={person.id}
                className={`flex items-center gap-3 border-b px-3.5 py-3 last:border-0 ${
                  person.suspended ? "opacity-70" : ""
                }`}
              >
                <Avatar name={person.name} src={person.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[13px] font-medium">{person.name}</span>
                    {self && (
                      <span className="inline-flex h-4 items-center rounded-full bg-hover px-1.5 text-[10px] font-medium text-muted">
                        You
                      </span>
                    )}
                    {person.suspended && (
                      <span className="inline-flex h-4 items-center rounded-full bg-rose-500/10 px-1.5 text-[10px] font-medium text-rose-500">
                        Suspended
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-faint">{person.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <RolePicker
                    name={person.name}
                    currentId={person.roleId}
                    currentName={current?.name ?? person.roleName}
                    currentIcon={current?.iconUrl}
                    roles={roles?.roles ?? []}
                    disabled={self || update.isPending}
                    onSelect={(roleId) => update.mutate({ id: person.id, roleId })}
                  />
                  {!self && (
                    <UserMore
                      name={person.name}
                      suspended={person.suspended}
                      busy={update.isPending || remove.isPending}
                      onSuspend={() =>
                        update.mutate({ id: person.id, suspended: !person.suspended })
                      }
                      onDelete={() => {
                        if (confirm(`Delete ${person.name}'s account? This cannot be undone.`)) {
                          remove.mutate(person.id);
                        }
                      }}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ErrorText error={update.error ?? remove.error} />
    </div>
  );
}

function Menu({
  align = "right",
  trigger,
  children,
}: {
  align?: "left" | "right";
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {trigger(open, () => setOpen((value) => !value))}
      {open && (
        <div
          role="menu"
          className={`menu absolute z-30 mt-1.5 min-w-40 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function RolePicker({
  name,
  currentId,
  currentName,
  currentIcon,
  roles,
  disabled,
  onSelect,
}: {
  name: string;
  currentId: number | null;
  currentName: string | null;
  currentIcon?: string | null;
  roles: { id: number; name: string; iconUrl: string | null }[];
  disabled?: boolean;
  onSelect: (roleId: number) => void;
}) {
  const label = currentName ?? "No role";
  const chip = (
    <span className="inline-flex h-7 max-w-36 items-center gap-1.5 rounded-full bg-hover px-2.5 text-[12px] text-muted">
      {currentIcon && (
        <img src={currentIcon} alt="" className="size-3.5 shrink-0 rounded-full object-cover" />
      )}
      <span className="truncate">{label}</span>
      {!disabled && <ChevronDown width={11} height={11} />}
    </span>
  );

  if (disabled || roles.length === 0) {
    return (
      <span className={disabled ? "opacity-60" : undefined} aria-label={`Role for ${name}`}>
        {chip}
      </span>
    );
  }

  return (
    <Menu
      trigger={(open, toggle) => (
        <button
          type="button"
          className="rounded-full outline-none hover:bg-hover"
          aria-label={`Role for ${name}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={toggle}
        >
          {chip}
        </button>
      )}
    >
      {(close) =>
        roles.map((role) => (
          <button
            key={role.id}
            type="button"
            role="menuitem"
            className="menu-item gap-2"
            onClick={() => {
              onSelect(role.id);
              close();
            }}
          >
            {role.iconUrl ? (
              <img
                src={role.iconUrl}
                alt=""
                className="size-4 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <span className="flex-1 truncate text-left">{role.name}</span>
            {role.id === currentId && <Check width={12} height={12} />}
          </button>
        ))
      }
    </Menu>
  );
}

function UserMore({
  name,
  suspended,
  busy,
  onSuspend,
  onDelete,
}: {
  name: string;
  suspended: boolean;
  busy?: boolean;
  onSuspend: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu
      trigger={(open, toggle) => (
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
          aria-label={`Actions for ${name}`}
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={busy}
          onClick={toggle}
        >
          <More />
        </button>
      )}
    >
      {(close) => (
        <>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              close();
              onSuspend();
            }}
          >
            {suspended ? "Restore" : "Suspend"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item gap-2 text-rose-500 hover:text-rose-500"
            onClick={() => {
              close();
              onDelete();
            }}
          >
            <Trash width={12} height={12} />
            Delete
          </button>
        </>
      )}
    </Menu>
  );
}

function moveRole(
  roles: { id: number }[],
  index: number,
  delta: number,
  save: (ids: number[]) => void,
) {
  const next = index + delta;
  if (next < 0 || next >= roles.length) return;
  const ids = roles.map((role) => role.id);
  const [id] = ids.splice(index, 1);
  if (id === undefined) return;
  ids.splice(next, 0, id);
  save(ids);
}

function RolesSettings() {
  const { data, isLoading } = useRoles();
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const reorder = useReorderRoles();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState<Permission[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (isLoading || !data) return null;

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, permissions: creating },
      {
        onSuccess: () => {
          setName("");
          setCreating([]);
        },
      },
    );
  }

  function toggle(role: { id: number; name: string }) {
    if (editing === role.id) {
      setEditing(null);
      return;
    }
    setEditing(role.id);
    setDraft(role.name);
  }

  function submitRename(e: FormEvent) {
    e.preventDefault();
    const role = data?.roles.find((item) => item.id === editing);
    const next = draft.trim();
    if (!role || !next || next === role.name) return;
    update.mutate({ id: role.id, name: next });
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[13px] font-medium">Roles</h2>
          <p className="mt-1 text-[12px] text-muted">
            Roles decide who can open the workspace and what they can change.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {data.roles.map((role, index) => {
            const open = editing === role.id;
            return (
              <li key={role.id} className="flex flex-col gap-3 border-b pb-4 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${role.name} up`}
                      className="inline-flex size-4 items-center justify-center text-faint hover:text-fg disabled:opacity-30"
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => moveRole(data.roles, index, -1, (ids) => reorder.mutate(ids))}
                    >
                      <ChevronDown width={12} height={12} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${role.name} down`}
                      className="inline-flex size-4 items-center justify-center text-faint hover:text-fg disabled:opacity-30"
                      disabled={index === data.roles.length - 1 || reorder.isPending}
                      onClick={() => moveRole(data.roles, index, 1, (ids) => reorder.mutate(ids))}
                    >
                      <ChevronDown width={12} height={12} />
                    </button>
                  </div>
                  <RoleIconPreview iconUrl={role.iconUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{role.name}</p>
                    <p className="text-[11px] text-faint">
                      {role.userCount} {role.userCount === 1 ? "user" : "users"}
                      {role.locked ? " · Permissions locked" : ""}
                    </p>
                  </div>
                  <RoleIconControl
                    role={role}
                    disabled={update.isPending}
                    onChange={(iconUrl) => update.mutate({ id: role.id, iconUrl })}
                  />
                  <button
                    type="button"
                    className="btn-quiet h-7 px-2.5"
                    onClick={() => toggle(role)}
                  >
                    {open ? "Close" : "Edit"}
                  </button>
                  {!role.locked && (
                    <button
                      type="button"
                      className="btn-quiet h-7 px-2.5"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete the ${role.name} role?`)) remove.mutate(role.id);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {open && (
                  <div className="flex flex-col gap-4">
                    <form onSubmit={submitRename} className="flex flex-wrap items-center gap-2">
                      <input
                        className="input h-8 max-w-[16rem] flex-1"
                        aria-label="Role name"
                        value={draft}
                        maxLength={40}
                        required
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="btn-quiet h-7 px-2.5"
                        disabled={update.isPending || !draft.trim() || draft.trim() === role.name}
                      >
                        Rename
                      </button>
                    </form>
                    <RolePermissions
                      catalog={data.catalog}
                      selected={role.permissions}
                      disabled={role.locked || update.isPending}
                      onChange={(permissions) => update.mutate({ id: role.id, permissions })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <ErrorText error={update.error ?? remove.error ?? reorder.error} />
      </section>

      <form onSubmit={submitCreate} className="flex flex-col gap-3">
        <div>
          <h2 className="text-[13px] font-medium">New role</h2>
          <p className="mt-1 text-[12px] text-muted">Name it, pick permissions, then create it.</p>
        </div>
        <input
          className="input"
          placeholder="Role name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
        />
        <RolePermissions catalog={data.catalog} selected={creating} onChange={setCreating} />
        <div className="flex items-center gap-2">
          <ErrorText error={create.error} />
          <div className="flex-1" />
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            Create role
          </button>
        </div>
      </form>
    </div>
  );
}

function RoleIconPreview({ iconUrl }: { iconUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [iconUrl]);

  if (!iconUrl || failed) {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-hover text-[11px] text-faint">
        —
      </span>
    );
  }
  return (
    <img
      src={iconUrl}
      alt=""
      onError={() => setFailed(true)}
      className="size-7 shrink-0 rounded-full object-cover"
    />
  );
}

function RoleIconControl({
  role,
  disabled,
  onChange,
}: {
  role: { iconUrl: string | null };
  disabled?: boolean;
  onChange: (iconUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn-quiet h-7 px-2.5"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : role.iconUrl ? "Change icon" : "Add icon"}
      </button>
      {role.iconUrl && (
        <button
          type="button"
          className="btn-quiet h-7 px-2.5"
          disabled={disabled || busy}
          onClick={() => onChange("")}
        >
          Remove icon
        </button>
      )}
      <ErrorText error={error ? new Error(error) : null} />
    </>
  );
}

function RolePermissions({
  catalog,
  selected,
  disabled,
  onChange,
}: {
  catalog: { id: Permission; label: string; description: string }[];
  selected: Permission[];
  disabled?: boolean;
  onChange: (permissions: Permission[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {catalog.map((item) => (
        <Checkbox
          key={item.id}
          checked={selected.includes(item.id)}
          disabled={disabled}
          onChange={(checked) =>
            onChange(
              checked
                ? [...selected, item.id]
                : selected.filter((permission) => permission !== item.id),
            )
          }
        >
          <span className="flex flex-col">
            <span>{item.label}</span>
            <span className="text-[12px] text-muted">{item.description}</span>
          </span>
        </Checkbox>
      ))}
    </div>
  );
}

function TagsSettings() {
  const { data: me } = useMe();
  const canSettings = can(me, "manage_settings");
  const { data: settings } = useSettings(canSettings);
  const save = useSaveSettings();
  const { data: tags = [], isLoading } = useTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("violet");

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ name, color }, { onSuccess: () => setName("") });
  }

  return (
    <div className="flex flex-col gap-8">
      {canSettings && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13px] font-medium">Who can tag</h2>
            <p className="mt-1 text-[12px] text-muted">
              Let people pick a tag when they post, such as a bug report or a suggestion. Require
              one when every suggestion needs a category.
            </p>
          </div>
          <Checkbox
            checked={settings?.customerTags ?? false}
            disabled={save.isPending}
            onChange={(checked) =>
              save.mutate(
                checked
                  ? { customerTags: true }
                  : { customerTags: false, customerTagsRequired: false },
              )
            }
          >
            Let people choose a tag on a new suggestion
          </Checkbox>
          <Checkbox
            checked={settings?.customerTagsRequired ?? false}
            disabled={save.isPending || (!isLoading && tags.length === 0)}
            onChange={(checked) =>
              save.mutate(
                checked
                  ? { customerTags: true, customerTagsRequired: true }
                  : { customerTagsRequired: false },
              )
            }
          >
            Require a tag before a suggestion can be posted
          </Checkbox>
          {!isLoading && tags.length === 0 && (
            <p className="text-[12px] text-faint">Add a tag before you can require one.</p>
          )}
          <ErrorText error={save.error} />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[13px] font-medium">Tags</h2>
          <p className="mt-1 text-[12px] text-muted">
            Name a tag and pick a color, then apply it to a suggestion so it is easier to spot.
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            className="input"
            placeholder="Tag name"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <ColorSwatches value={color} onChange={setColor} />
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary h-8 px-3" disabled={create.isPending}>
              <Plus width={12} height={12} />
              Add tag
            </button>
            <ErrorText error={create.error} />
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        {isLoading && <p className="text-[12px] text-muted">Loading tags…</p>}
        {!isLoading && tags.length === 0 && <p className="text-[12px] text-faint">No tags yet.</p>}
        {tags.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            pending={update.isPending || remove.isPending}
            error={update.variables?.id === tag.id ? update.error : null}
            onRename={(next) => update.mutate({ id: tag.id, name: next })}
            onColor={(next) => update.mutate({ id: tag.id, color: next })}
            onDelete={() => {
              if (confirm(`Delete the “${tag.name}” tag? It will come off every suggestion.`)) {
                remove.mutate(tag.id);
              }
            }}
          />
        ))}
      </section>
    </div>
  );
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: TagColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLORS.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.id}
            aria-pressed={selected}
            onClick={() => onChange(item.id)}
            className="inline-flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105"
            style={{
              background: item.hex,
              boxShadow: selected ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${item.hex}` : undefined,
            }}
          >
            {selected && <Check width={12} height={12} className="text-white" />}
          </button>
        );
      })}
    </div>
  );
}

function TagRow({
  tag,
  pending,
  error,
  onRename,
  onColor,
  onDelete,
}: {
  tag: { id: number; name: string; color: string };
  pending: boolean;
  error: Error | null;
  onRename: (name: string) => void;
  onColor: (color: TagColor) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [open, setOpen] = useState(false);
  const done = useRef(false);

  function save() {
    if (done.current) return;
    done.current = true;
    const next = name.trim();
    setEditing(false);
    if (!next || next === tag.name) {
      setName(tag.name);
      return;
    }
    onRename(next);
  }

  return (
    <div className="card flex flex-col gap-3 px-3 py-3">
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: tagColorHex(tag.color) }}
        />
        {editing ? (
          <input
            className="input h-8 flex-1"
            value={name}
            maxLength={24}
            autoFocus
            aria-label={`Rename ${tag.name}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                done.current = true;
                setName(tag.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
            onClick={() => {
              done.current = false;
              setName(tag.name);
              setEditing(true);
            }}
          >
            {tag.name}
          </button>
        )}
        <button
          type="button"
          className="btn-quiet h-7 px-2.5"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Color
        </button>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-full text-faint transition-colors hover:bg-hover hover:text-rose-500"
          aria-label={`Delete ${tag.name}`}
          disabled={pending}
          onClick={onDelete}
        >
          <Trash width={13} height={13} />
        </button>
      </div>
      {open && <ColorSwatches value={tag.color} onChange={onColor} />}
      {error && <ErrorText error={error} />}
    </div>
  );
}
