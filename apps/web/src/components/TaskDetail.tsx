import {
  type Health,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
  WORK_LIMITS,
} from "@usercue/shared";
import { useState } from "react";
import { Link } from "wouter";
import type { TaskActivity, TaskDetail as TaskDetailData } from "../lib/api";
import { dateTimeLabel, timeAgo } from "../lib/format";
import {
  type TaskInput,
  useDeleteTask,
  useDeleteTaskActivity,
  useLinkTaskPost,
  usePostTaskActivity,
  useTask,
  useTaskStaff,
  useUnlinkTaskPost,
  useUpdateTask,
} from "../lib/workQueries";
import { AutoTextarea } from "./AutoTextarea";
import { BlockedSection } from "./BlockedSection";
import { DatePicker } from "./DatePicker";
import { ChevronDown, ChevronLeft, Trash } from "./icons";
import { RequestLinks } from "./RequestLinks";
import { Select } from "./Select";
import { TaskMembers } from "./TaskMembers";
import { Avatar, Empty, useToast } from "./ui";
import {
  CommentComposer,
  HEALTH_CHOICES,
  HealthBadge,
  MemberStack,
  PropertyRow,
  SectionTitle,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TaskStatusIcon,
} from "./work";

export function TaskDetail({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const { data: task, isLoading, error } = useTask(id);
  if (isLoading) return <div className="min-h-40" aria-busy="true" />;
  if (error || !task) return <Empty title="Task not found">It may have been deleted.</Empty>;
  return <TaskBody key={task.id} task={task} onDeleted={onDeleted} />;
}

function TaskBody({ task, onDeleted }: { task: TaskDetailData; onDeleted: () => void }) {
  const toast = useToast();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const { data: staff = [] } = useTaskStaff();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  const patch = (changes: Partial<TaskInput>) =>
    update.mutate(
      { id: task.id, ...changes },
      { onError: (e) => toast({ message: e.message, tone: "error" }) },
    );

  const personOptions = (empty: string) => [
    {
      value: "0",
      label: empty,
      icon: <span className="size-5 shrink-0 rounded-full border border-dashed border-faint/60" />,
    },
    ...staff.map((person) => ({
      value: String(person.id),
      label: person.name,
      icon: <Avatar name={person.name} src={person.avatarUrl} size="sm" />,
    })),
  ];

  return (
    <article className="@container flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <nav className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
          <Link
            href="/admin/tasks"
            className="inline-flex items-center gap-1 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-hover hover:text-fg"
          >
            <ChevronLeft width={12} height={12} />
            Tasks
          </Link>
          <span className="text-faint">/</span>
          <span className="px-1 text-faint tabular-nums">#{task.id}</span>
        </nav>
        {task.canDelete && (
          <button
            type="button"
            aria-label="Delete task"
            title="Delete task"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600"
            disabled={remove.isPending}
            onClick={() => {
              if (!confirm("Delete this task?")) return;
              remove.mutate(task.id, { onSuccess: onDeleted });
            }}
          >
            <Trash />
          </button>
        )}
      </div>

      <div className="grid gap-x-12 gap-y-8 @2xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-2">
          <AutoTextarea
            aria-label="Task title"
            value={title}
            maxLength={WORK_LIMITS.taskTitle}
            className="-mx-2.5 w-[calc(100%+1.25rem)] rounded-xl bg-transparent px-2.5 py-1 text-[24px] leading-8 font-semibold tracking-tight outline-none transition-colors hover:bg-hover/60 focus:bg-hover"
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onBlur={() => {
              const next = title.trim();
              if (!next) setTitle(task.title);
              else if (next !== task.title) patch({ title: next });
            }}
          />
          <AutoTextarea
            aria-label="Description"
            placeholder="Add a description..."
            value={description}
            maxLength={WORK_LIMITS.taskDescription}
            className="-mx-2.5 min-h-14 w-[calc(100%+1.25rem)] rounded-xl bg-transparent px-2.5 py-2 text-[14px] leading-6 text-fg/90 outline-none transition-colors placeholder:text-faint hover:bg-hover/60 focus:bg-hover"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description.trim() !== task.description)
                patch({ description: description.trim() });
            }}
          />
        </div>

        <aside className="flex flex-col gap-3 @2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1">
          <div className="card flex flex-col p-2">
            <PropertyRow label="Status">
              <Select
                quiet
                label="Status"
                value={task.status}
                options={TASK_STATUS_OPTIONS}
                onChange={(status: TaskStatus) => patch({ status })}
              />
            </PropertyRow>
            <PropertyRow label="Priority">
              <Select
                quiet
                label="Priority"
                value={task.priority}
                options={TASK_PRIORITY_OPTIONS}
                onChange={(priority: TaskPriority) => patch({ priority })}
              />
            </PropertyRow>
            <PropertyRow label="Manager">
              <Select
                quiet
                label="Manager"
                value={String(task.manager?.id ?? 0)}
                options={personOptions("No manager")}
                onChange={(value) => patch({ managerId: Number(value) || null })}
              />
            </PropertyRow>
            <PropertyRow label="Due date">
              <DatePicker
                quiet
                label="Due date"
                value={task.dueDate ?? ""}
                tone={task.overdue ? "text-rose-500" : ""}
                onChange={(dueDate) => patch({ dueDate })}
              />
            </PropertyRow>
            <PropertyRow label="Health">
              <Select
                quiet
                label="Health"
                value={(task.health ?? "") as Health | ""}
                options={HEALTH_CHOICES}
                onChange={(health: Health | "") => patch({ health })}
              />
            </PropertyRow>
            {task.status === "blocked" && (
              <BlockedSection
                task={task}
                onReason={(blockedReason) => patch({ blockedReason })}
                onUnblock={() => patch({ status: "in_progress" })}
              />
            )}
            <TaskMembers task={task} staff={staff} />
          </div>
          <p className="px-2 text-[11px] leading-5 text-faint">
            Created by {task.creatorName}
            <br />
            {dateTimeLabel(task.createdAt)}
          </p>
        </aside>

        <div className="flex min-w-0 flex-col gap-8 @2xl:col-start-1">
          <Blocking task={task} />
          <Requests task={task} />
          <Activity task={task} />
        </div>
      </div>
    </article>
  );
}

function Blocking({ task }: { task: TaskDetailData }) {
  if (task.blocking.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="Blocking" count={task.blocking.length} />
      <ul className="card flex flex-col p-1.5">
        {task.blocking.map((item) => (
          <li key={item.id}>
            <Link
              href={`/admin/tasks/${item.id}`}
              className="flex h-10 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-hover"
            >
              <TaskStatusIcon status={item.status} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.title}</span>
              <MemberStack people={item.members} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Requests({ task }: { task: TaskDetailData }) {
  const link = useLinkTaskPost();
  const unlink = useUnlinkTaskPost();
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="Requests" count={task.posts.length} />
      <RequestLinks
        posts={task.posts}
        canEdit
        pending={link.isPending || unlink.isPending}
        error={link.error}
        onLink={(postId, done) => link.mutate({ id: task.id, postId }, { onSuccess: done })}
        onUnlink={(postId) => unlink.mutate({ id: task.id, postId })}
      />
    </section>
  );
}

function Activity({ task }: { task: TaskDetailData }) {
  const post = usePostTaskActivity();

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title="Activity" />
      <ol className="relative flex flex-col gap-4 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:bg-line">
        <li className="relative flex items-center gap-3 text-[12px] text-muted">
          <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-bg">
            <span className="size-1.5 rounded-full bg-faint" />
          </span>
          <span>
            <span className="font-medium text-fg">{task.creatorName}</span> created this task
          </span>
          <span className="text-faint">{timeAgo(task.createdAt)}</span>
        </li>
        {groupActivity(task.activity).map((segment, index) =>
          segment.kind === "run" ? (
            <ActivityRun key={`run-${index}`} taskId={task.id} items={segment.items} />
          ) : (
            <ActivityItem key={segment.item.id} taskId={task.id} item={segment.item} />
          ),
        )}
      </ol>
      <CommentComposer
        label="Add a comment"
        placeholder="Leave a comment..."
        status={task.status}
        health={(task.health ?? "") as Health | ""}
        pending={post.isPending}
        error={post.error}
        maxLength={WORK_LIMITS.taskActivity}
        onSubmit={(body, changes, done) =>
          post.mutate({ id: task.id, body, ...changes }, { onSuccess: done })
        }
      />
    </section>
  );
}

type ActivitySegment =
  | { kind: "item"; item: TaskActivity }
  | { kind: "run"; items: TaskActivity[] };

const COLLAPSE_FROM = 3;
const KEEP_LATEST = 2;

function groupActivity(items: TaskActivity[]): ActivitySegment[] {
  const segments: ActivitySegment[] = [];
  let run: TaskActivity[] = [];

  function flush(trailing: boolean) {
    const keep = trailing ? KEEP_LATEST : 0;
    const hidden = run.length - keep;
    if (hidden >= COLLAPSE_FROM) {
      segments.push({ kind: "run", items: run.slice(0, hidden) });
      for (const item of run.slice(hidden)) segments.push({ kind: "item", item });
    } else {
      for (const item of run) segments.push({ kind: "item", item });
    }
    run = [];
  }

  for (const item of items) {
    if (item.kind === "comment") {
      flush(false);
      segments.push({ kind: "item", item });
    } else {
      run.push(item);
    }
  }
  flush(true);
  return segments;
}

function ActivityRun({ taskId, items }: { taskId: number; items: TaskActivity[] }) {
  const [open, setOpen] = useState(false);
  const until = items.at(-1)?.createdAt;

  return (
    <>
      <li className="relative flex items-center gap-3 text-[12px] text-muted">
        <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-bg">
          <span className="size-1.5 rounded-full bg-faint" />
        </span>
        <button
          type="button"
          aria-expanded={open}
          className="-ml-2 inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-left transition-colors hover:bg-fg/[0.06] hover:text-fg"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="font-medium text-fg">
            {open ? "Hide" : "Show"} {items.length} updates
          </span>
          <ChevronDown
            width={12}
            height={12}
            className={`text-faint transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {!open && until && <span className="text-faint">up to {timeAgo(until)}</span>}
      </li>
      {open && items.map((item) => <ActivityItem key={item.id} taskId={taskId} item={item} />)}
    </>
  );
}

function ActivityItem({ taskId, item }: { taskId: number; item: TaskActivity }) {
  const remove = useDeleteTaskActivity();

  if (item.kind === "status") {
    const status = item.value as TaskStatus;
    return (
      <li className="relative flex items-center gap-3 text-[12px] text-muted">
        <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-bg">
          <TaskStatusIcon status={status} size={13} />
        </span>
        <span>
          <span className="font-medium text-fg">{item.authorName}</span> moved this to{" "}
          <span className="font-medium text-fg">{TASK_STATUS_LABELS[status] ?? item.value}</span>
        </span>
        <span className="text-faint">{timeAgo(item.createdAt)}</span>
      </li>
    );
  }

  if (item.kind === "blocker") {
    const added = item.value === "add";
    return (
      <li className="relative flex items-center gap-3 text-[12px] text-muted">
        <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-bg">
          <TaskStatusIcon status="blocked" size={13} />
        </span>
        <span className="min-w-0">
          <span className="font-medium text-fg">{item.authorName}</span>{" "}
          {added ? "marked this as blocked by" : "removed the blocker"}{" "}
          <span className="font-medium text-fg">{item.body}</span>
        </span>
        <span className="shrink-0 text-faint">{timeAgo(item.createdAt)}</span>
      </li>
    );
  }

  if (item.kind === "member") {
    const added = item.value === "add";
    return (
      <li className="relative flex items-center gap-3 text-[12px] text-muted">
        <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-bg">
          <span className="size-1.5 rounded-full bg-faint" />
        </span>
        <span>
          <span className="font-medium text-fg">{item.authorName}</span>{" "}
          {added ? "added" : "removed"} <span className="font-medium text-fg">{item.body}</span>{" "}
          {added ? "to this task" : "from this task"}
        </span>
        <span className="text-faint">{timeAgo(item.createdAt)}</span>
      </li>
    );
  }

  return (
    <li className="relative flex gap-3">
      <span className="z-10 shrink-0 rounded-full bg-bg">
        <Avatar name={item.authorName} src={item.authorAvatar} size="md" />
      </span>
      <div className="card min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-medium">{item.authorName}</span>
          <span className="text-faint" title={dateTimeLabel(item.createdAt)}>
            {timeAgo(item.createdAt)}
          </span>
          {item.health && <HealthBadge health={item.health as Health} compact />}
          {item.canDelete && (
            <button
              type="button"
              aria-label="Delete update"
              className="ml-auto text-faint transition-colors hover:text-rose-600"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: taskId, activityId: item.id })}
            >
              <Trash width={13} height={13} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[13px] leading-6 break-words whitespace-pre-wrap">{item.body}</p>
      </div>
    </li>
  );
}
