import { type FormEvent, useEffect, useState } from "react";
import { SectionHead } from "../../components/SectionHead";
import { Checkbox, ErrorText } from "../../components/ui";
import { useSaveSettings, useSettings } from "../../lib/queries";

export function ChatSettings() {
  return (
    <div className="flex flex-col gap-10">
      <SlackSettings />
      <DiscordSettings />
      <TeamsSettings />
    </div>
  );
}

function SlackSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const [webhook, setWebhook] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data) return;
    setWebhook("");
    setEnabled(data.slack.enabled);
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ slackWebhookUrl: webhook.trim() || undefined, slackEnabled: enabled });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <SectionHead title="Slack">
        Post new suggestions, status changes, and comments to a Slack channel. Create an incoming
        webhook for the channel and paste its URL. It is encrypted and never shown again.
      </SectionHead>
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
            data.slack.configured
              ? "Leave blank to keep the current webhook"
              : "https://hooks.slack.com/services/…"
          }
        />
      </label>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Send workspace activity to Slack
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
      <SectionHead title="Discord">
        Post new suggestions, status changes, and comments to a Discord channel. Paste the webhook
        URL from the channel&apos;s Integrations settings. It is encrypted. We never show it again.
      </SectionHead>
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
      <SectionHead title="Teams">
        Post new suggestions, status changes, and comments to a Teams channel. Paste the incoming
        webhook from Workflows, or a classic connector URL. It is encrypted. We never show it again.
      </SectionHead>
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
