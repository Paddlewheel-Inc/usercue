import { TASK_STATUS_LABELS, WORK_LIMITS } from "@usercue/shared";
import { useState } from "react";
import { Link } from "wouter";
import type { TaskDetail } from "../lib/api";
import { useAddBlocker, useCreateTask, useRemoveBlocker, useTasks } from "../lib/workQueries";
import { AutoTextarea } from "./AutoTextarea";
import { Close, Plus, Search } from "./icons";
import { ErrorText } from "./ui";
import { TaskStatusIcon } from "./work";

const isResolved = (status: string) => status === "done" || status === "cancelled";

export function BlockedSection({
  task,
  onReason,
  onUnblock,
}: {
  task: TaskDetail;
  onReason: (reason: string) => void;
  onUnblock: () => void;
}) {
  const [reason, setReason] = useState(task.blockedReason);
  const remove = useRemoveBlocker();
  const total = task.blockedBy.length;
  const resolved = task.blockedBy.filter((item) => isResolved(item.status)).length;
  const cleared = total > 0 && resolved === total;

  return (
    <div className="mt-1 flex flex-col pt-2">
      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <span className="flex items-baseline gap-2 text-[12px] text-faint">
          Blocked by
          {total > 0 && (
            <span className="text-[11px] tabular-nums">
              {resolved}/{total}
            </span>
          )}
        </span>
        <button
          type="button"
          title="Mark unblocked"
          className="rounded-full px-2 py-0.5 text-[12px] text-muted transition-colors hover:bg-hover hover:text-fg"
          onClick={onUnblock}
        >
          Unblock
        </button>
      </div>

      <AutoTextarea
        aria-label="Why this task is blocked"
        placeholder="Why is it blocked?"
        value={reason}
        maxLength={WORK_LIMITS.blockedReason}
        className="min-h-8 w-full rounded-lg bg-transparent px-2 py-1 text-[13px] leading-5 outline-none transition-colors placeholder:text-faint hover:bg-hover/60 focus:bg-hover"
        onChange={(e) => setReason(e.target.value)}
        onBlur={() => {
          if (reason.trim() !== task.blockedReason) onReason(reason.trim());
        }}
      />

      {task.blockedBy.length > 0 && (
        <ul className="mt-1 flex flex-col">
          {task.blockedBy.map((item) => {
            const finished = isResolved(item.status);
            return (
              <li
                key={item.id}
                className="group flex min-h-8 items-center gap-2 rounded-lg pr-1 pl-2 hover:bg-hover/60"
              >
                <TaskStatusIcon status={item.status} />
                <Link
                  href={`/admin/tasks/${item.id}`}
                  title={`${item.title} · ${TASK_STATUS_LABELS[item.status]}`}
                  className={`min-w-0 flex-1 truncate text-[13px] ${
                    finished ? "text-faint line-through" : ""
                  }`}
                >
                  {item.title}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${item.title}`}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-rose-600 focus-visible:opacity-100"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: task.id, blockerId: item.id })}
                >
                  <Close width={12} height={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {cleared && (
        <button
          type="button"
          className="mt-1 flex h-8 items-center gap-2 rounded-lg px-2 text-left text-[13px] text-accent-text transition-colors hover:bg-hover/60"
          onClick={onUnblock}
        >
          Everything is done. Resume work
        </button>
      )}

      <AddBlocker task={task} />
    </div>
  );
}

function AddBlocker({ task }: { task: TaskDetail }) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const add = useAddBlocker();
  const create = useCreateTask();
  const { data: open } = useTasks({ status: "open" }, adding);
  const waiting = new Set(task.blockedBy.map((item) => item.id));
  const term = query.trim();
  const needle = term.toLowerCase();
  const candidates = (open ?? []).filter((item) => item.id !== task.id && !waiting.has(item.id));
  const matches = (
    needle ? candidates.filter((item) => item.title.toLowerCase().includes(needle)) : candidates
  ).slice(0, 6);
  const exact = candidates.some((item) => item.title.toLowerCase() === needle);
  const pending = add.isPending || create.isPending;

  function close() {
    setAdding(false);
    setQuery("");
    add.reset();
    create.reset();
  }

  function pick(blockerId: number) {
    add.mutate({ id: task.id, blockerId }, { onSuccess: close });
  }

  function createAndBlock() {
    create.mutate({ title: term }, { onSuccess: (created) => pick(created.id) });
  }

  if (!adding) {
    return (
      <button
        type="button"
        className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-muted transition-colors hover:bg-hover/60 hover:text-fg"
        onClick={() => setAdding(true)}
      >
        <Plus className="text-faint" />
        Add blocker
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
        <input
          className="input h-9 pl-9 text-[13px]"
          placeholder="Find or create a task"
          aria-label="Find a task this is waiting on"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        />
      </div>
      <ul className="flex flex-col">
        {matches.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-hover/60"
              disabled={pending}
              onClick={() => pick(item.id)}
            >
              <TaskStatusIcon status={item.status} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
            </button>
          </li>
        ))}
        {term && !exact && (
          <li>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-hover/60"
              disabled={pending}
              onClick={createAndBlock}
            >
              <Plus className="text-accent-text" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-accent-text">
                Create “{term}”
              </span>
            </button>
          </li>
        )}
        {matches.length === 0 && !term && (
          <li className="px-2 py-1.5 text-[12px] text-muted">
            No other open tasks. Type a title to create one.
          </li>
        )}
      </ul>
      <div className="flex items-center justify-between gap-3 px-1">
        <ErrorText error={add.error ?? create.error} />
        <button
          type="button"
          className="ml-auto rounded-full px-2.5 py-1 text-[12px] text-muted transition-colors hover:bg-hover hover:text-fg"
          onClick={close}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
