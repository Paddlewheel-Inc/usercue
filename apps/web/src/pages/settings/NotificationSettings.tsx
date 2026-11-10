import { type FormEvent, useEffect, useState } from "react";
import { SectionHead } from "../../components/SectionHead";
import { Select } from "../../components/Select";
import { Checkbox, ErrorText } from "../../components/ui";
import { useSaveSettings, useSettings } from "../../lib/queries";
import { ChatSettings } from "./ChatSettings";
import { EmailSettings } from "./EmailSettings";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
  (label, index) => ({ value: String(index + 1), label }),
);
const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00 UTC`,
}));

export function NotificationSettings() {
  return (
    <div className="flex flex-col gap-10">
      <EmailSettings />
      <VoterAlerts />
      <DigestSettings />
      <ChatSettings />
    </div>
  );
}

function VoterAlerts() {
  const { data } = useSettings();
  const save = useSaveSettings();
  if (!data) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHead title="Voter alerts">
        Let people know when something they backed makes progress.
      </SectionHead>
      <Checkbox
        checked={data.notifyVoters}
        disabled={save.isPending}
        onChange={(notifyVoters) => save.mutate({ notifyVoters })}
      >
        Tell voters when a request they backed ships
      </Checkbox>
      <ErrorText error={save.error} />
    </section>
  );
}

function DigestSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState("1");
  const [hour, setHour] = useState("9");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.digest.enabled);
    setDay(String(data.digest.day));
    setHour(String(data.digest.hour));
  }, [data]);

  if (!data) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ digestEnabled: enabled, digestDay: Number(day), digestHour: Number(hour) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <SectionHead title="Weekly digest">
        Email your team a summary of new requests, top votes, and shipped work. Each person can opt
        out from their account page.
      </SectionHead>
      {!data.digest.ready && (
        <p className="rounded-2xl bg-hover/60 px-3.5 py-3 text-[12px] text-muted">
          The digest needs outgoing email (see Email delivery above) and the PUBLIC_URL environment
          variable.
        </p>
      )}
      <Checkbox checked={enabled} onChange={setEnabled}>
        Send the weekly digest
      </Checkbox>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Day" value={day} options={DAYS} disabled={!enabled} onChange={setDay} />
        <Select label="Time" value={hour} options={HOURS} disabled={!enabled} onChange={setHour} />
      </div>
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
