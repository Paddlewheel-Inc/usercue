import {
  DEFAULT_WORKFLOW,
  STATUS_LABELS,
  STATUSES,
  WORKFLOW_ICON_GROUPS,
  WORKFLOW_ICON_LABELS,
  type WorkflowStatus,
} from "@usercue/shared";
import { type FormEvent, useState } from "react";
import { Check, Plus } from "../components/icons";
import { ErrorText } from "../components/ui";
import { WorkflowGlyph } from "../components/WorkflowIcon";
import { useSaveWorkflow, useWorkflow } from "../lib/workflow";

const COLORS = [
  "#a8a29e",
  "#eab308",
  "#fb923c",
  "#fb7185",
  "#a78bfa",
  "#60a5fa",
  "#2dd4bf",
  "#4ade80",
];

function StatusEditor({ status, onClose }: { status?: WorkflowStatus; onClose: () => void }) {
  const save = useSaveWorkflow();
  const [name, setName] = useState(status?.name ?? "");
  const [icon, setIcon] = useState(status?.icon ?? "circle");
  const [color, setColor] = useState(status?.color ?? "#eab308");
  const [category, setCategory] = useState(status?.category ?? "planned");
  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(
      { id: status?.id, name: name.trim(), icon, color, category },
      { onSuccess: onClose },
    );
  }
  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <WorkflowGlyph icon={icon} color={color} size={18} />
        {name.trim() || "New status"}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] text-muted">Name</span>
        <input
          autoFocus
          className="input"
          value={name}
          maxLength={40}
          required
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. In review"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[11px] text-muted">Icon</legend>
        {WORKFLOW_ICON_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <span className="text-[10px] font-medium text-faint">{group.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {group.icons.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={WORKFLOW_ICON_LABELS[item]}
                  aria-pressed={icon === item}
                  title={WORKFLOW_ICON_LABELS[item]}
                  onClick={() => setIcon(item)}
                  className={`inline-flex size-9 items-center justify-center rounded-xl border transition-colors ${icon === item ? "border-accent-text/50 bg-accent-soft" : "border-transparent bg-hover/60 hover:bg-hover"}`}
                >
                  <WorkflowGlyph icon={item} color={color} size={18} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[11px] text-muted">Color</legend>
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              aria-label={`Use ${item}`}
              aria-pressed={color === item}
              onClick={() => setColor(item)}
              className="inline-flex size-7 items-center justify-center rounded-full border border-line"
              style={{ background: item }}
            >
              {color === item && <Check className="text-black/75" width={13} height={13} />}
            </button>
          ))}
          <label className="inline-flex items-center gap-2 text-[11px] text-muted">
            <input
              type="color"
              aria-label="Custom status color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-7 cursor-pointer overflow-hidden rounded-lg border border-line bg-transparent p-0.5"
            />
            Custom
          </label>
        </div>
      </fieldset>
      {!status && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted">Stage</span>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as WorkflowStatus["category"])}
          >
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABELS[item]}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted">
            Groups this status on the roadmap. Planned statuses also follow your assignment
            settings.
          </span>
        </label>
      )}
      <ErrorText error={save.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" type="submit" disabled={save.isPending || !name.trim()}>
          {save.isPending ? "Saving…" : status ? "Save status" : "Add status"}
        </button>
      </div>
    </form>
  );
}

export function WorkflowSettings() {
  const { statuses, isLoading, error } = useWorkflow();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[13px] font-medium">The pile, your way</h2>
        <p className="mt-1 text-[12px] text-muted">
          Give each step a name, color, and a little character. Your icons appear wherever a status
          is shown.
        </p>
      </div>
      <ErrorText error={error} />
      {!isLoading && (
        <div className="flex flex-col gap-1">
          {statuses.map((status) => (
            <div key={status.id}>
              <button
                type="button"
                onClick={() => setEditing(status.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-hover"
                aria-label={`Edit ${status.name}`}
              >
                <span className="inline-flex size-8 items-center justify-center rounded-xl bg-hover/70">
                  <WorkflowGlyph icon={status.icon} color={status.color} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{status.name}</span>
                  <span className="block text-[11px] text-muted">
                    {DEFAULT_WORKFLOW.find((item) => item.id === status.category)?.name} stage
                  </span>
                </span>
                <span className="text-[12px] text-muted">Edit</span>
              </button>
              {editing === status.id && (
                <StatusEditor key={status.id} status={status} onClose={() => setEditing(null)} />
              )}
            </div>
          ))}
        </div>
      )}
      {editing === "new" ? (
        <StatusEditor key="new" onClose={() => setEditing(null)} />
      ) : (
        <button type="button" className="btn-quiet self-start" onClick={() => setEditing("new")}>
          <Plus /> Add status
        </button>
      )}
    </section>
  );
}
