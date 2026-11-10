import { type FormEvent, useEffect, useState } from "react";
import { SectionHead } from "../../components/SectionHead";
import { Checkbox, useToast } from "../../components/ui";
import { useSaveSettings, useSettings } from "../../lib/queries";

export function EmailSettings() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHead title="Email delivery">
        Staff invites, the weekly digest, and shipped alerts go out by email. Pick Resend or your
        own SMTP server.
      </SectionHead>
      <ResendSettings />
      <SmtpSettings />
    </div>
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
      <SectionHead title="Resend">
        Send invites, the weekly digest, and shipped alerts through Resend. Add an API key and a
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
        Send email with Resend
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
