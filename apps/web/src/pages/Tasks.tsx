import { TASK_STATUS_LABELS, type TaskStatus } from "@usercue/shared";
import { type FormEvent, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Plus, Tasks as TasksIcon } from "../components/icons";
import { TaskDetail } from "../components/TaskDetail";
import { ErrorText } from "../components/ui";
import { Segmented, TaskRow, TaskStatusIcon } from "../components/work";
import { useMe } from "../lib/queries";
import { type TaskFilters, useCreateTask, useTasks } from "../lib/workQueries";
import { AdminShell } from "./Admin";

type Scope = "mine" | "everyone" | "unowned";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "mine", label: "Mine" },
  { value: "everyone", label: "Everyone" },
  { value: "unowned", label: "Unowned" },
];

const GROUP_ORDER: TaskStatus[] = ["in_progress", "blocked", "todo", "done", "cancelled"];

function filtersFor(scope: Scope, finished: boolean): TaskFilters {
  return {
    person: scope === "mine" ? "me" : scope === "unowned" ? "none" : undefined,
    status: finished ? undefined : "open",
  };
}

export function Tasks() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const selected = params.id ? Number(params.id) : undefined;
  const [scope, setScope] = useState<Scope>("mine");
  const [finished, setFinished] = useState(false);

  return (
    <AdminShell work="tasks">
      <TaskList
        scope={scope}
        finished={finished}
        selected={selected}
        onScope={setScope}
        onFinished={setFinished}
      />
      <section
        className={`min-w-0 flex-1 overflow-y-auto ${selected ? "block" : "hidden md:block"}`}
      >
        {selected ? (
          <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
            <TaskDetail key={selected} id={selected} onDeleted={() => navigate("/admin/tasks")} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-hover text-faint">
              <TasksIcon width={20} height={20} />
            </span>
            <div>
              <p className="text-[14px] font-medium">Select a task</p>
              <p className="mt-1 max-w-[16rem] text-[13px] leading-5 text-muted">
                Open one to change its status, reassign it, or post an update.
              </p>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function TaskList({
  scope,
  finished,
  selected,
  onScope,
  onFinished,
}: {
  scope: Scope;
  finished: boolean;
  selected?: number;
  onScope: (scope: Scope) => void;
  onFinished: (finished: boolean) => void;
}) {
  const { data: me } = useMe();
  const [, navigate] = useLocation();
  const { data: tasks, isLoading } = useTasks(filtersFor(scope, finished));
  const create = useCreateTask();
  const [title, setTitle] = useState("");

  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: (tasks ?? []).filter((task) => task.status === status),
  })).filter((group) => group.items.length > 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = title.trim();
    if (!text) return;
    create.mutate(
      { title: text, memberIds: scope === "mine" && me?.user ? [me.user.id] : [] },
      {
        onSuccess: (task) => {
          setTitle("");
          navigate(`/admin/tasks/${task.id}`);
        },
      },
    );
  }

  return (
    <section
      className={`w-full min-w-0 shrink-0 flex-col md:flex md:w-96 ${selected ? "hidden" : "flex"}`}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-5">
        <h2 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight">
          Tasks
          {tasks && (
            <span className="text-[13px] font-medium text-faint tabular-nums">{tasks.length}</span>
          )}
        </h2>
        <button
          type="button"
          aria-pressed={finished}
          onClick={() => onFinished(!finished)}
          className={`h-7 rounded-full px-3 text-[12px] transition-colors ${
            finished
              ? "bg-accent-soft font-medium text-accent-text"
              : "text-muted hover:bg-hover hover:text-fg"
          }`}
        >
          {finished ? "Showing finished" : "Show finished"}
        </button>
      </header>

      <div className="flex flex-col gap-2.5 px-4 pb-3">
        <Segmented label="Scope" value={scope} options={SCOPES} onChange={onScope} />
        <form onSubmit={submit} className="flex flex-col gap-1">
          <div className="relative">
            <Plus className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
            <input
              className="input pl-9"
              placeholder="Add a task and press enter"
              aria-label="New task"
              value={title}
              maxLength={140}
              onChange={(e) => setTitle(e.target.value)}
              disabled={create.isPending}
            />
          </div>
          <ErrorText error={create.error} />
        </form>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pt-1 pb-6">
        {groups.map((group) => (
          <div key={group.status} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 px-3 pb-1.5 text-[12px] font-medium text-muted">
              <TaskStatusIcon status={group.status} size={13} />
              {TASK_STATUS_LABELS[group.status]}
              <span className="text-faint tabular-nums">{group.items.length}</span>
            </div>
            {group.items.map((task) => (
              <TaskRow key={task.id} task={task} active={task.id === selected} />
            ))}
          </div>
        ))}
        {!isLoading && groups.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
            <p className="text-[13px] font-medium">
              {scope === "mine" ? "Nothing on your plate" : "No tasks here"}
            </p>
            <p className="max-w-[15rem] text-[12px] leading-5 text-muted">
              {scope === "mine"
                ? "Add a task above, or check Everyone to see what the team is up to."
                : "Add one above to get started."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
