import { PRIORITY_LEVELS, type PriorityLevel } from "@usercue/shared";
import { useState } from "react";
import type { PostDetail } from "../lib/api";
import { timeAgo } from "../lib/format";
import {
  useAddNote,
  useAiSummary,
  useAiTags,
  useDeleteNote,
  useMe,
  usePostTriage,
  useTags,
  useUpdatePost,
} from "../lib/queries";
import { Select } from "./Select";
import { ErrorText } from "./ui";

const LEVEL_NAMES: Record<PriorityLevel, string> = {
  1: "Very low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Very high",
};
const LEVEL_OPTIONS = [
  { value: "", label: "Not set" },
  ...PRIORITY_LEVELS.map((level) => ({ value: String(level), label: LEVEL_NAMES[level] })),
];

const parseLevel = (value: string): PriorityLevel | null =>
  PRIORITY_LEVELS.find((level) => String(level) === value) ?? null;

export function TriagePanel({ post }: { post: PostDetail }) {
  const { data: me } = useMe();
  const scoring = me?.triageBoards.includes(post.board) ?? false;
  const assist = me?.aiEnabled ?? false;
  if (!scoring && !assist) return null;

  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-hover/60 p-4">
      <header className="flex items-center gap-2">
        <h2 className="text-[13px] font-medium">Team only</h2>
        <span className="chip text-muted">Not visible to the public</span>
      </header>
      {scoring && <Scoring post={post} />}
      {assist && <AiAssist post={post} />}
    </section>
  );
}

function Scoring({ post }: { post: PostDetail }) {
  const { data: triage } = usePostTriage(post.id, true);
  const update = useUpdatePost(post.id);
  if (!triage) return null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Impact</span>
          <Select
            label="Impact"
            value={triage.impact === null ? "" : String(triage.impact)}
            options={LEVEL_OPTIONS}
            onChange={(value) => update.mutate({ impact: parseLevel(value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] text-muted">Effort</span>
          <Select
            label="Effort"
            value={triage.effort === null ? "" : String(triage.effort)}
            options={LEVEL_OPTIONS}
            onChange={(value) => update.mutate({ effort: parseLevel(value) })}
          />
        </div>
        <div className="flex h-9 items-center gap-2 px-1">
          <span className="text-[11px] text-muted">Score</span>
          <span className="text-[15px] font-semibold tabular-nums">{triage.score ?? "–"}</span>
        </div>
      </div>
      <ErrorText error={update.error} />
      <Notes postId={post.id} notes={triage.notes} />
    </>
  );
}

function AiAssist({ post }: { post: PostDetail }) {
  const summary = useAiSummary();
  const suggest = useAiTags();
  const update = useUpdatePost(post.id);
  const { data: tags = [] } = useTags(true);
  const suggested = suggest.data?.tagIds ?? [];
  const names = tags.filter((tag) => suggested.includes(tag.id));
  const current = post.tags.map((tag) => tag.id);
  const fresh = suggested.filter((id) => !current.includes(id));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="px-1 text-[11px] text-muted">AI assist</p>
        <button
          type="button"
          className="btn-ghost h-7 px-2.5"
          disabled={summary.isPending}
          onClick={() => summary.mutate(post.id)}
        >
          {summary.isPending ? "Summarizing…" : "Summarize thread"}
        </button>
        <button
          type="button"
          className="btn-ghost h-7 px-2.5"
          disabled={suggest.isPending}
          onClick={() => suggest.mutate(post.id)}
        >
          {suggest.isPending ? "Thinking…" : "Suggest tags"}
        </button>
      </div>
      {summary.data && (
        <p className="rounded-xl bg-bg px-3 py-2 text-[13px] leading-5 whitespace-pre-line">
          {summary.data.summary}
        </p>
      )}
      {suggest.data && (
        <div className="flex flex-wrap items-center gap-1.5">
          {names.length === 0 ? (
            <span className="px-1 text-[12px] text-muted">No matching tags.</span>
          ) : (
            names.map((tag) => (
              <span key={tag.id} className="chip">
                {tag.name}
              </span>
            ))
          )}
          {fresh.length > 0 && (
            <button
              type="button"
              className="btn-primary h-7 px-2.5"
              disabled={update.isPending}
              onClick={() => update.mutate({ tagIds: [...current, ...fresh].slice(0, 8) })}
            >
              Apply
            </button>
          )}
        </div>
      )}
      <ErrorText error={summary.error ?? suggest.error} />
    </div>
  );
}

function Notes({
  postId,
  notes,
}: {
  postId: number;
  notes: { id: number; authorName: string; body: string; createdAt: number; canDelete: boolean }[];
}) {
  const add = useAddNote(postId);
  const remove = useDeleteNote(postId);
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-2.5">
      <p className="px-1 text-[11px] text-muted">Internal notes</p>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-bg px-3 py-2">
              <p className="flex items-center gap-2 text-[12px]">
                <span className="font-medium">{note.authorName}</span>
                <span className="text-faint">{timeAgo(note.createdAt)}</span>
                <span className="flex-1" />
                {note.canDelete && (
                  <button
                    type="button"
                    className="text-faint transition-colors hover:text-rose-500"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(note.id)}
                  >
                    Delete
                  </button>
                )}
              </p>
              <p className="mt-1 text-[13px] leading-5 whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(body, { onSuccess: () => setBody("") });
        }}
      >
        <textarea
          className="input field-sizing-content max-h-40 min-h-9 flex-1 resize-none rounded-2xl py-2"
          rows={1}
          placeholder="Add a note for the team…"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={add.isPending || !body.trim()}>
          Add
        </button>
      </form>
      <ErrorText error={add.error ?? remove.error} />
    </div>
  );
}
