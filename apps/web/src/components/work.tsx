import {
  HEALTH_META,
  HEALTH_VALUES,
  type Health,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@usercue/shared";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "wouter";
import type { Task } from "../lib/api";
import { AutoTextarea } from "./AutoTextarea";
import { Select } from "./Select";
import { Avatar, ErrorText } from "./ui";

const DUE = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export function dueLabel(date: string): string {
  return DUE.format(new Date(`${date}T00:00:00`));
}

const STATUS_TONE: Record<TaskStatus, string> = {
  todo: "text-faint",
  in_progress: "text-amber-500",
  blocked: "text-rose-500",
  done: "text-accent",
  cancelled: "text-faint",
};

export function TaskStatusIcon({ status, size = 14 }: { status: TaskStatus; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${STATUS_TONE[status]}`}
    >
      <circle cx="8" cy="8" r="5.75" />
      {status === "in_progress" && <path d="M8 4.25a3.75 3.75 0 0 1 0 7.5z" fill="currentColor" />}
      {status === "blocked" && <path d="M5.5 8h5" />}
      {status === "done" && (
        <>
          <circle cx="8" cy="8" r="5.75" fill="currentColor" />
          <path d="m5.5 8.2 1.7 1.7 3.3-3.6" stroke="var(--bg)" />
        </>
      )}
      {status === "cancelled" && <path d="m6 6 4 4M10 6l-4 4" />}
    </svg>
  );
}

const PRIORITY_BARS: Record<TaskPriority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export function PriorityMark({
  priority,
  showEmpty = false,
}: {
  priority: TaskPriority;
  showEmpty?: boolean;
}) {
  const bars = PRIORITY_BARS[priority];
  if (bars === 0 && !showEmpty) return null;
  return (
    <span
      role="img"
      aria-label={`${TASK_PRIORITY_LABELS[priority]} priority`}
      className={`flex h-3.5 shrink-0 items-end gap-px ${priority === "urgent" ? "text-rose-500" : "text-muted"}`}
    >
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className="w-[3px] rounded-[1px] bg-current"
          style={{ height: `${level * 25}%`, opacity: level <= bars ? 1 : 0.22 }}
        />
      ))}
    </span>
  );
}

export function HealthDot({ health }: { health: Health }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: HEALTH_META[health].hex }}
    />
  );
}

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
  icon: <TaskStatusIcon status={value} />,
}));
export const TASK_PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({
  value,
  label: value === "none" ? "No priority" : TASK_PRIORITY_LABELS[value],
  icon: <PriorityMark priority={value} showEmpty />,
}));
export const HEALTH_OPTIONS = HEALTH_VALUES.map((value) => ({
  value,
  label: HEALTH_META[value].label,
  icon: <HealthDot health={value} />,
}));

export function MemberStack({
  people,
  max = 3,
}: {
  people: { id: number; name: string; avatarUrl: string | null }[];
  max?: number;
}) {
  if (people.length === 0) {
    return <span className="size-5 shrink-0 rounded-full border border-dashed border-faint/50" />;
  }
  return (
    <span className="flex shrink-0 -space-x-1.5" title={people.map((p) => p.name).join(", ")}>
      {people.slice(0, max).map((person) => (
        <span key={person.id} className="rounded-full ring-2 ring-surface">
          <Avatar name={person.name} src={person.avatarUrl} size="sm" />
        </span>
      ))}
      {people.length > max && (
        <span className="z-10 inline-flex size-5 items-center justify-center rounded-full bg-hover text-[9px] text-muted ring-2 ring-surface">
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export const HEALTH_CHOICES: { value: Health | ""; label: string; icon: ReactNode }[] = [
  {
    value: "",
    label: "No health",
    icon: <span className="size-2 shrink-0 rounded-full border border-faint" />,
  },
  ...HEALTH_OPTIONS,
];

export function HealthBadge({ health, compact = false }: { health: Health; compact?: boolean }) {
  const meta = HEALTH_META[health];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ${
        compact ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]"
      }`}
      style={{ background: `${meta.hex}1f`, color: meta.hex }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.hex }} />
      {meta.label}
    </span>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-hover p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`h-7 flex-1 rounded-full px-3 text-[12px] transition-[background-color,color,box-shadow] ${
            option.value === value
              ? "bg-surface font-medium text-fg shadow-[var(--shadow)]"
              : "text-muted hover:text-fg"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-[12px] text-faint">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SectionTitle({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-[13px] font-semibold tracking-tight">
        {title}
        {count !== undefined && (
          <span className="text-[12px] font-medium text-faint tabular-nums">{count}</span>
        )}
      </h2>
      {children}
    </div>
  );
}

export function TaskRow({ task, active = false }: { task: Task; active?: boolean }) {
  const finished = task.status === "done" || task.status === "cancelled";
  return (
    <Link
      href={`/admin/tasks/${task.id}`}
      className={`flex h-10 items-center gap-3 rounded-xl px-3 transition-colors ${
        active ? "bg-hover" : "hover:bg-hover"
      }`}
    >
      <TaskStatusIcon status={task.status} />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          finished ? "text-faint line-through" : "font-medium"
        }`}
      >
        {task.title}
      </span>
      {task.openBlockers > 0 && (
        <span className="hidden shrink-0 text-[11px] font-medium text-rose-500 sm:inline">
          Waiting on {task.openBlockers}
        </span>
      )}
      {task.health && <HealthBadge health={task.health as Health} compact />}
      <PriorityMark priority={task.priority} />
      {task.dueDate && (
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            task.overdue ? "font-medium text-rose-500" : "text-faint"
          }`}
        >
          {dueLabel(task.dueDate)}
        </span>
      )}
      <MemberStack people={task.members} />
    </Link>
  );
}

export function CommentComposer({
  label,
  placeholder,
  status,
  health,
  pending,
  error,
  maxLength,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  status: TaskStatus;
  health: Health | "";
  pending: boolean;
  error: Error | null;
  maxLength: number;
  onSubmit: (
    body: string,
    changes: { status?: TaskStatus; health?: Health | "" },
    done: () => void,
  ) => void;
}) {
  const [body, setBody] = useState("");
  const [nextStatus, setNextStatus] = useState<TaskStatus | null>(null);
  const [nextHealth, setNextHealth] = useState<Health | "" | null>(null);
  const shownStatus = nextStatus ?? status;
  const shownHealth = nextHealth ?? health;
  const ready = body.trim().length > 0 && !pending;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!ready) return;
    const changes: { status?: TaskStatus; health?: Health | "" } = {};
    if (nextStatus !== null && nextStatus !== status) changes.status = nextStatus;
    if (nextHealth !== null && nextHealth !== health) changes.health = nextHealth;
    onSubmit(body.trim(), changes, () => {
      setBody("");
      setNextStatus(null);
      setNextHealth(null);
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col p-2">
      <AutoTextarea
        aria-label={label}
        placeholder={placeholder}
        value={body}
        maxLength={maxLength}
        className="min-h-14 w-full bg-transparent px-2.5 py-2 text-[13px] leading-6 outline-none placeholder:text-faint"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex min-w-0 items-center gap-1">
          <div className="w-36">
            <Select
              quiet
              label="Status"
              value={shownStatus}
              options={TASK_STATUS_OPTIONS}
              onChange={(value: TaskStatus) => setNextStatus(value)}
            />
          </div>
          <div className="w-36">
            <Select
              quiet
              label="Health"
              value={shownHealth}
              options={HEALTH_CHOICES}
              onChange={(value: Health | "") => setNextHealth(value)}
            />
          </div>
        </div>
        <button type="submit" className="btn-primary h-8" disabled={!ready}>
          Comment
        </button>
      </div>
      {error && (
        <div className="px-2.5 pt-1.5 pb-1">
          <ErrorText error={error} />
        </div>
      )}
    </form>
  );
}
