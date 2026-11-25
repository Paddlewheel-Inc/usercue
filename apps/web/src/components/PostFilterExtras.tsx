import { tagColorHex } from "@usercue/shared";
import { usePostAuthors, useTags } from "../lib/queries";
import { Select } from "./Select";

export interface ExtraFilters {
  tag?: string;
  tagMode?: "any" | "all";
  author?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export function PostFilterExtras({
  filter,
  onChange,
  board,
  authorAsText = false,
  compact = false,
}: {
  filter: ExtraFilters;
  onChange: (patch: Partial<ExtraFilters>) => void;
  board?: string;
  authorAsText?: boolean;
  compact?: boolean;
}) {
  const { data: tags = [] } = useTags();
  const { data: authors = [] } = usePostAuthors(board);
  const selected = filter.tag?.split(",").filter(Boolean) ?? [];
  const authorOptions = [
    { value: "", label: "Any author" },
    { value: "none", label: "Guest posts" },
    ...authors
      .filter((author) => author.id !== null)
      .map((author) => ({ value: String(author.id), label: author.name })),
  ];

  function toggleTag(id: number) {
    const value = String(id);
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange({ tag: next.length ? next.join(",") : undefined });
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => {
            const active = selected.includes(String(tag.id));
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(tag.id)}
                className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors ${
                  active
                    ? "border-accent bg-accent/10 text-fg"
                    : "border-line text-muted hover:border-fg/30 hover:text-fg"
                }`}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: tagColorHex(tag.color) }}
                />
                {tag.name}
              </button>
            );
          })}
          {selected.length > 1 && (
            <button
              type="button"
              onClick={() => onChange({ tagMode: filter.tagMode === "all" ? "any" : "all" })}
              title="Require every selected tag instead of any one"
              className="inline-flex h-6 items-center rounded-full border border-line px-2 text-[11px] text-muted transition-colors hover:text-fg"
            >
              Match {filter.tagMode === "all" ? "all" : "any"}
            </button>
          )}
        </div>
      )}
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-3"}`}>
        {authorAsText ? (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-faint">Author</span>
            <input
              className="input h-8"
              placeholder="Author name"
              maxLength={60}
              value={filter.author ?? ""}
              onChange={(event) => onChange({ author: event.target.value || undefined })}
            />
          </label>
        ) : (
          <Select
            label="Author"
            value={filter.author ?? ""}
            options={authorOptions}
            onChange={(author) => onChange({ author: author || undefined })}
          />
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-faint">From</span>
          <input
            type="date"
            className="input h-8"
            max={filter.createdBefore || undefined}
            value={filter.createdAfter ?? ""}
            onChange={(event) => onChange({ createdAfter: event.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-faint">To</span>
          <input
            type="date"
            className="input h-8"
            min={filter.createdAfter || undefined}
            value={filter.createdBefore ?? ""}
            onChange={(event) => onChange({ createdBefore: event.target.value || undefined })}
          />
        </label>
      </div>
    </div>
  );
}
