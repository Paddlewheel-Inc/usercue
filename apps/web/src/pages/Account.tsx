import { type FormEvent, useEffect, useRef, useState } from "react";
import { Check } from "../components/icons";
import { ProviderIcon } from "../components/OAuthButtons";
import { Avatar, Checkbox, ErrorText } from "../components/ui";
import { uploadImage } from "../lib/api";
import {
  useAuthMethods,
  useLinkedAccounts,
  useMe,
  useUnlinkAccount,
  useUpdateProfile,
} from "../lib/queries";

export function Account() {
  const { data: me } = useMe();
  const save = useUpdateProfile();
  const user = me?.user;
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  if (!user) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = password.trim();
    save.mutate(
      {
        name,
        password: next || undefined,
        currentPassword: user?.hasPassword && next ? currentPassword : undefined,
      },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setPassword("");
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Settings</h1>
          <p className="mt-1.5 text-muted">Your name and photo are shown on posts and comments.</p>
        </div>

        <PhotoField />

        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={60}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Email</span>
          <input
            className="input"
            value={user.email}
            readOnly
            placeholder="Not shared by this sign-in"
          />
        </label>

        {user.hasPassword && (
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-[11px] text-muted">Current password</span>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Required to set a new one"
              required={password.trim().length > 0}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">
            {user.hasPassword ? "New password" : "Set a password"}
          </span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            placeholder={
              user.hasPassword ? "Leave blank to keep it" : "Optional, at least 8 characters"
            }
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
      <EmailPreferences />
      <ConnectedAccounts />
    </div>
  );
}

function EmailPreferences() {
  const { data: me } = useMe();
  const save = useUpdateProfile();
  const user = me?.user;
  if (!user?.email) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-medium">Email</h2>
        <p className="mt-1 text-[12px] text-muted">Choose what lands in your inbox.</p>
      </div>
      <Checkbox
        checked={user.emailUpdates}
        disabled={save.isPending}
        onChange={(emailUpdates) => save.mutate({ emailUpdates })}
      >
        Mentions, and updates when a request I voted on ships
      </Checkbox>
      {user.staff && (
        <Checkbox
          checked={user.emailDigest}
          disabled={save.isPending}
          onChange={(emailDigest) => save.mutate({ emailDigest })}
        >
          Weekly digest of new requests and activity
        </Checkbox>
      )}
      <ErrorText error={save.error} />
    </section>
  );
}

function PhotoField() {
  const { data: me } = useMe();
  const save = useUpdateProfile();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const user = me?.user;
  if (!user) return null;

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const avatarUrl = await uploadImage(file);
      save.mutate({ avatarUrl }, { onError: (err) => setError(err) });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar name={user.name} src={user.avatarUrl} size="lg" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
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
            className="btn-ghost"
            disabled={busy || save.isPending}
            onClick={() => input.current?.click()}
          >
            {busy ? "Uploading…" : "Change photo"}
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              className="btn-quiet bg-rose-500/10 text-rose-500 hover:bg-rose-500/15"
              disabled={busy || save.isPending}
              onClick={() => {
                setError(null);
                save.mutate({ avatarUrl: "" }, { onError: (err) => setError(err) });
              }}
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted">JPEG, PNG, or SVG. Up to 1.5 MB.</p>
        <ErrorText error={error ?? save.error} />
      </div>
    </div>
  );
}

function ConnectedAccounts() {
  const { data: methods } = useAuthMethods();
  const { data: links } = useLinkedAccounts();
  const unlink = useUnlinkAccount();
  const linked = new Map((links?.accounts ?? []).map((account) => [account.id, account]));
  const enabled = methods?.providers ?? [];
  const rows = [
    ...enabled.map((provider) => ({ id: provider.id, label: provider.label })),
    ...[...linked.values()].filter(
      (account) => !enabled.some((provider) => provider.id === account.id),
    ),
  ];

  if (!rows.length) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-medium">Connected accounts</h2>
        <p className="mt-1 text-[12px] text-muted">
          Link a sign-in method and you can use it to get into this same account.
        </p>
      </div>
      {rows.map((provider) => {
        const connected = linked.has(provider.id);
        return (
          <div key={provider.id} className="flex items-center gap-2.5">
            <span className="inline-flex size-7 items-center justify-center text-fg">
              <ProviderIcon id={provider.id} />
            </span>
            <span className="min-w-0 flex-1 text-[13px]">{provider.label}</span>
            {connected ? (
              <button
                type="button"
                className="btn-quiet"
                disabled={unlink.isPending}
                onClick={() => {
                  if (confirm(`Remove ${provider.label} from this account?`)) {
                    unlink.mutate(provider.id);
                  }
                }}
              >
                Remove
              </button>
            ) : (
              <a href={`/api/auth/oauth/${provider.id}?next=link`} className="btn-ghost h-8">
                Link
              </a>
            )}
          </div>
        );
      })}
      <ErrorText error={unlink.error} />
    </section>
  );
}
