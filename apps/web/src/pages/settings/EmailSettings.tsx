import { type FormEvent, useEffect, useState } from "react";
import { SectionHead } from "../../components/SectionHead";
import { Checkbox, ErrorText, useToast } from "../../components/ui";
import { timeAgo } from "../../lib/format";
import { useMe, useSaveSettings, useSettings, useTestEmail } from "../../lib/queries";

export function EmailSettings() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHead title="Email delivery">
        Staff invites, the weekly digest, and shipped alerts go out by email. Pick Postbound or your
        own SMTP server.
      </SectionHead>
      <PostboundSettings />
      <SmtpSettings />
      <TestEmail />
    </div>
  );
}

function PostboundSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const [from, setFrom] = useState(data?.postbound.from ?? "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.postbound.enabled));

  useEffect(() => {
    if (!data) return;
    setFrom(data.postbound.from ?? "");
    setApiKey("");
    setEnabled(data.postbound.enabled);
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      {
        postboundFrom: from,
        postboundApiKey: apiKey.trim() || undefined,
        postboundEnabled: enabled,
      },
      {
        onSuccess: () => toast({ message: "Postbound settings saved." }),
        onError: (error) => toast({ message: error.message, tone: "error" }),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <SectionHead title="Postbound">
        Send invites, the weekly digest, and shipped alerts through Postbound. Add an API key and a
        from address. The key is hashed and encrypted. We never show it again.
      </SectionHead>
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
            data.postbound.keyHash || data.postbound.fromEnv
              ? "Leave blank to keep the current key"
              : "pb_…"
          }
        />
        {!data.postbound.keyHash && data.postbound.fromEnv && (
          <p className="px-1 text-[11px] text-faint">Using the key from the environment.</p>
        )}
      </label>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Send email with Postbound
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
      <SectionHead title="SMTP">
        Or use your own SMTP server. The password is encrypted and never shown again.
      </SectionHead>
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
        Send email with SMTP
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

function TestEmail() {
  const { data: me } = useMe();
  const { data } = useSettings();
  const test = useTestEmail();
  const toast = useToast();

  if (!data) return null;
  const last = data.emailTest;

  function send() {
    test.mutate(undefined, {
      onSuccess: () => toast({ message: `Test email sent to ${me?.user?.email}.` }),
      onError: (error) => toast({ message: error.message, tone: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHead title="Test email">
        Send a test message to {me?.user?.email || "your account email"} using the email provider
        that is turned on.
      </SectionHead>
      {!data.postbound.enabled && !data.smtp.enabled && (
        <p className="px-1 text-[12px] text-muted">Turn on Postbound or SMTP first.</p>
      )}
      {last && (
        <p className="flex items-start gap-2 px-1 text-[12px] leading-5 text-muted">
          <span
            aria-hidden
            className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
              last.ok ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          {last.ok
            ? `Sent to ${last.to} ${timeAgo(last.at)}.`
            : `Failed: ${last.message} ${timeAgo(last.at)}.`}
        </p>
      )}
      <ErrorText error={test.error} />
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <button
          type="button"
          className="btn-primary"
          disabled={test.isPending || !me?.user?.email}
          onClick={send}
        >
          {test.isPending ? "Sending…" : "Send test email"}
        </button>
      </div>
    </div>
  );
}
