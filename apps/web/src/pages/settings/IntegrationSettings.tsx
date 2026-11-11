import {
  WEBHOOK_EVENT_IDS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_LIMITS,
  type WebhookEvent,
} from "@usercue/shared";
import { type FormEvent, useEffect, useState } from "react";
import { SectionHead } from "../../components/SectionHead";
import { Select } from "../../components/Select";
import { Checkbox, CopyField, ErrorText } from "../../components/ui";
import type { Webhook } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import {
  useBoards,
  useCreateWebhook,
  useDeleteWebhook,
  useSaveSettings,
  useSettings,
  useTestWebhook,
  useUpdateWebhook,
  useWebhooks,
} from "../../lib/queries";
import { ImportSettings } from "./ImportSettings";

export function IntegrationSettings() {
  return (
    <div className="flex flex-col gap-10">
      <WebhookSettings />
      <InboundSettings />
      <AiSettings />
      <EmbedSettings />
      <ImportSettings />
    </div>
  );
}

function AiSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.ai.enabled);
    setBaseUrl(data.ai.baseUrl ?? "");
    setModel(data.ai.model ?? "");
    setApiKey("");
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      aiEnabled: enabled,
      aiBaseUrl: baseUrl,
      aiModel: model,
      aiApiKey: apiKey.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <SectionHead title="AI assist">
        Summarize long threads, suggest tags, and draft changelog entries. Bring your own key for
        any OpenAI-compatible provider, including a local model. Post text is sent to the provider
        you choose.
      </SectionHead>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Base URL</span>
        <input
          className="input"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          spellCheck={false}
          placeholder="https://api.openai.com/v1"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Model</span>
        <input
          className="input"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          spellCheck={false}
          placeholder="gpt-4o-mini"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">API key</span>
        <input
          className="input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            data.ai.keyHash ? "Leave blank to keep the current key" : "Optional for local models"
          }
        />
      </label>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Turn on AI assist for your team
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

function WebhookSettings() {
  const { data: hooks = [] } = useWebhooks();
  const create = useCreateWebhook();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([...WEBHOOK_EVENT_IDS]);
  const [secret, setSecret] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, url, events },
      {
        onSuccess: (created) => {
          setSecret(created.secret);
          setName("");
          setUrl("");
        },
      },
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title="Webhooks">
        Send events to your own systems, Zapier, or Make. Each delivery is signed with HMAC-SHA256
        so you can verify it came from here.
      </SectionHead>

      {secret && (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft px-3.5 py-3">
          <CopyField label="Signing secret" value={secret} />
          <p className="px-1 text-[12px] text-muted">
            Copy it now. We store only a hash, so it will not be shown again.
          </p>
        </div>
      )}

      {hooks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {hooks.map((hook) => (
            <WebhookRow key={hook.id} hook={hook} />
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-hover/60 p-3.5">
        <p className="text-[13px] font-medium">Add a webhook</p>
        <input
          className="input"
          placeholder="Name"
          value={name}
          maxLength={WEBHOOK_LIMITS.name}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          type="url"
          placeholder="https://example.com/hooks/usercue"
          value={url}
          maxLength={WEBHOOK_LIMITS.url}
          required
          onChange={(e) => setUrl(e.target.value)}
        />
        <EventPicker events={events} onChange={setEvents} />
        <div className="flex items-center gap-2">
          <ErrorText error={create.error} />
          <div className="flex-1" />
          <button
            type="submit"
            className="btn-primary"
            disabled={create.isPending || events.length === 0}
          >
            Add webhook
          </button>
        </div>
      </form>
    </section>
  );
}

function EventPicker({
  events,
  onChange,
}: {
  events: WebhookEvent[];
  onChange: (events: WebhookEvent[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {WEBHOOK_EVENT_IDS.map((event) => (
        <Checkbox
          key={event}
          checked={events.includes(event)}
          onChange={(on) =>
            onChange(on ? [...events, event] : events.filter((item) => item !== event))
          }
        >
          {WEBHOOK_EVENT_LABELS[event]}
        </Checkbox>
      ))}
    </div>
  );
}

function WebhookRow({ hook }: { hook: Webhook }) {
  const update = useUpdateWebhook();
  const remove = useDeleteWebhook();
  const test = useTestWebhook();
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>(hook.events);
  const failed = hook.lastError !== null;

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl bg-hover/60 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{hook.name}</p>
          <p className="truncate text-[12px] text-muted">{hook.urlPreview}</p>
        </div>
        <button
          type="button"
          className="btn-quiet h-7 px-2.5"
          disabled={test.isPending}
          onClick={() => test.mutate(hook.id)}
        >
          {test.isPending ? "Sending…" : "Send test"}
        </button>
        <button
          type="button"
          className="btn-quiet h-7 px-2.5"
          onClick={() => setEditing((open) => !open)}
        >
          Events
        </button>
        <button
          type="button"
          className="btn-quiet h-7 bg-rose-500/10 px-2.5 text-rose-500 hover:bg-rose-500/15"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`Remove the ${hook.name} webhook?`)) remove.mutate(hook.id);
          }}
        >
          Remove
        </button>
      </div>

      <Checkbox
        checked={hook.enabled}
        disabled={update.isPending}
        onChange={(enabled) => update.mutate({ id: hook.id, enabled })}
      >
        Active
      </Checkbox>

      {editing && (
        <div className="flex flex-col gap-2.5 border-t pt-3">
          <EventPicker events={events} onChange={setEvents} />
          <button
            type="button"
            className="btn-primary h-8 w-fit"
            disabled={update.isPending || events.length === 0}
            onClick={() =>
              update.mutate({ id: hook.id, events }, { onSuccess: () => setEditing(false) })
            }
          >
            Save events
          </button>
        </div>
      )}

      <p className={`text-[11px] ${failed ? "text-rose-500" : "text-faint"}`}>
        {hook.lastDeliveryAt === null
          ? "Never delivered"
          : failed
            ? `Last delivery failed ${timeAgo(hook.lastDeliveryAt)}: ${hook.lastError}`
            : `Last delivered ${timeAgo(hook.lastDeliveryAt)} (HTTP ${hook.lastStatus})`}
      </p>
      {test.data && (
        <p className={`text-[12px] ${test.data.ok ? "text-muted" : "text-rose-500"}`}>
          {test.data.ok ? `Test delivered (HTTP ${test.data.status}).` : test.data.message}
        </p>
      )}
      <ErrorText error={update.error ?? remove.error ?? test.error} />
    </li>
  );
}

function EmbedSettings() {
  const { data: boards = [] } = useBoards();
  const [board, setBoard] = useState("");
  const origin = window.location.origin;
  const boardAttr = board ? ` data-board="${board}"` : "";
  const options = [
    { value: "", label: "First board" },
    ...boards.map((item) => ({ value: item.slug, label: item.name })),
  ];

  return (
    <section className="flex flex-col gap-3">
      <SectionHead title="Embed">
        Put feedback on your own site. The widget adds a floating button that opens your board.
        Inline embeds place the board, roadmap, or changelog right on the page.
      </SectionHead>
      <Select label="Board" value={board} options={options} onChange={setBoard} />
      <CopyField
        label="Feedback widget"
        value={`<script src="${origin}/api/embed.js"${boardAttr} defer></script>`}
      />
      <CopyField
        label="Inline board"
        value={`<div data-usercue-embed="feedback"${boardAttr}></div>`}
      />
      <CopyField label="Inline roadmap" value={`<div data-usercue-embed="roadmap"></div>`} />
      <CopyField label="Inline changelog" value={`<div data-usercue-embed="changelog"></div>`} />
      <CopyField
        label="Script for inline embeds only"
        value={`<script src="${origin}/api/embed.js" data-widget="off" defer></script>`}
      />
    </section>
  );
}

function isLocalUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function InboundSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.inbound.enabled);
    setSecret("");
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ inboundEnabled: enabled, inboundSecret: secret.trim() || undefined });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <SectionHead title="Email in">
        Turn emails into feedback. Customers write to an address on your domain and the message
        becomes a request. Receiving is handled by Resend.
      </SectionHead>
      {!data.inbound.resendReady && (
        <p className="rounded-2xl bg-hover/60 px-3.5 py-3 text-[12px] text-muted">
          Add your Resend API key and from address under Notifications first. The key needs full
          access, because it is used to read the incoming message.
        </p>
      )}
      {isLocalUrl(data.inbound.url) && (
        <p className="rounded-2xl bg-hover/60 px-3.5 py-3 text-[12px] text-muted">
          Resend cannot reach this address from the internet. Set <code>PUBLIC_URL</code> to your
          public domain, or use a tunnel while testing.
        </p>
      )}
      <ol className="flex list-decimal flex-col gap-1.5 pl-8 text-[12px] leading-5 text-muted">
        <li>In Resend, add a domain and turn on receiving, then add the MX records it shows.</li>
        <li>
          Under Webhooks, add the endpoint below and subscribe to the <code>email.received</code>{" "}
          event.
        </li>
        <li>Copy the endpoint&apos;s signing secret and paste it here.</li>
        <li>
          Mail to <code>board-slug@your-domain</code> lands on that board. Anything else goes to
          your first board.
        </li>
      </ol>
      <CopyField label="Webhook endpoint" value={data.inbound.url} />
      {data.inbound.enabled && (
        <p className="flex items-start gap-2 px-1 text-[12px] leading-5 text-muted">
          <span
            aria-hidden
            className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
              data.inbound.last
                ? data.inbound.last.ok
                  ? "bg-emerald-500"
                  : "bg-rose-500"
                : "bg-faint"
            }`}
          />
          {data.inbound.last
            ? `${data.inbound.last.message} ${timeAgo(data.inbound.last.at)}.`
            : "No email has reached UserCue since the server started."}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] text-muted">Signing secret</span>
        <input
          className="input"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            data.inbound.configured ? "Leave blank to keep the current secret" : "whsec_…"
          }
        />
      </label>
      <Checkbox checked={enabled} onChange={setEnabled}>
        Accept feedback by email
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
