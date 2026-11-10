import {
  ASSIGNMENT_LABELS,
  ASSIGNMENT_MODES,
  type AssignmentMode,
  VOTE_LIMIT_MAX,
} from "@usercue/shared";
import { type FormEvent, useEffect, useState } from "react";
import { SectionHead } from "../../components/SectionHead";
import { Checkbox, CopyField, ErrorText } from "../../components/ui";
import { useSaveSettings, useSettings } from "../../lib/queries";

export function GeneralSettings() {
  const { data, isLoading } = useSettings();
  const save = useSaveSettings();

  if (isLoading || !data) return null;

  return (
    <div className="flex flex-col gap-10">
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
          onChange={(allowGuestFeedback) => save.mutate({ allowGuestFeedback })}
        >
          Allow guests to post feedback without signing in
        </Checkbox>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[13px] font-medium">Changelog</h2>
          <p className="mt-1 text-[12px] text-muted">
            Staff write the updates. Comments and reactions are their own switches, and stay as you
            left them if you hide the changelog.
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

      <TriageSettings />

      <VotingSettings />
    </div>
  );
}

function assignmentHint(mode: AssignmentMode) {
  if (mode === "off") return "Nobody can be assigned. The field stays hidden.";
  if (mode === "manual") return "Staff pick who takes a suggestion.";
  return "When a suggestion becomes Planned, the next staff member in line gets it.";
}

function TriageSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  if (!data) return null;
  const { triage } = data;
  const active = triage.boards.filter((board) => board.enabled).map((board) => board.slug);

  function toggleBoard(slug: string, on: boolean) {
    save.mutate({
      triageBoards: on ? [...active, slug] : active.filter((item) => item !== slug),
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHead title="Triage tools">
        Impact and effort scoring, a priority sort, and internal notes on each request. Only staff
        see them. Turn them off if your team does not triage this way.
      </SectionHead>
      <Checkbox
        checked={triage.enabled}
        disabled={save.isPending}
        onChange={(triageEnabled) => save.mutate({ triageEnabled })}
      >
        Show triage tools to staff
      </Checkbox>
      {triage.enabled && triage.boards.length > 1 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-hover/60 px-3.5 py-3">
          <p className="text-[12px] text-muted">Boards that use triage tools</p>
          {triage.boards.map((board) => (
            <Checkbox
              key={board.slug}
              checked={board.enabled}
              disabled={save.isPending}
              onChange={(on) => toggleBoard(board.slug, on)}
            >
              {board.name}
            </Checkbox>
          ))}
        </div>
      )}
      <ErrorText error={save.error} />
    </section>
  );
}

function VotingSettings() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const [limit, setLimit] = useState("0");

  useEffect(() => {
    if (data) setLimit(String(data.voteLimit));
  }, [data]);

  if (!data) return null;
  const parsed = Number(limit);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= VOTE_LIMIT_MAX;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ voteLimit: parsed });
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHead title="Voting">
        Limit how many open requests one person can back at once. Votes come back when a request
        ships or closes.
      </SectionHead>
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Votes per person (0 is unlimited)</span>
          <input
            className="input w-40"
            type="number"
            min={0}
            max={VOTE_LIMIT_MAX}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={save.isPending || !valid}>
          Save
        </button>
      </form>
      <ErrorText error={save.error} />
    </section>
  );
}
