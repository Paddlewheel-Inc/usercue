import type { Sort } from "@usercue/shared";
import { type FormEvent, useState } from "react";
import { type Filter, filterQuery } from "../lib/adminFilter";
import { useMe, useSavedViews, useSaveView, useSettings, useTags } from "../lib/queries";
import { Select } from "./Select";
import { ErrorText } from "./ui";

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "top", label: "Most votes" },
  { value: "priority", label: "Priority score" },
];

const MIN_VOTE_OPTIONS = ["", "3", "5", "10", "25", "50"].map((value) => ({
  value,
  label: value ? `${value}+ votes` : "Any votes",
}));

export function RequestFilters({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (patch: Partial<Filter>) => void;
}) {
  const { data: tags = [] } = useTags();
  const { data: settings } = useSettings();
  const { data: me } = useMe();
  const sorts = me?.triageBoards.length
    ? SORT_OPTIONS
    : SORT_OPTIONS.filter((o) => o.value !== "priority");
  const staff = settings?.staff ?? [];
  const tagOptions = [
    { value: "", label: "Any tag" },
    ...tags.map((tag) => ({ value: String(tag.id), label: tag.name })),
  ];
  const assigneeOptions = [
    { value: "", label: "Anyone" },
    { value: "none", label: "Unassigned" },
    ...staff.map((person) => ({ value: String(person.id), label: person.name })),
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        label="Sort by"
        value={filter.sort ?? "new"}
        options={sorts}
        onChange={(sort) => onChange({ sort })}
      />
      <Select
        label="Minimum votes"
        value={filter.minVotes ?? ""}
        options={MIN_VOTE_OPTIONS}
        onChange={(minVotes) => onChange({ minVotes: minVotes || undefined })}
      />
      <Select
        label="Tag"
        value={filter.tag ?? ""}
        options={tagOptions}
        onChange={(tag) => onChange({ tag: tag || undefined })}
      />
      <Select
        label="Assignee"
        value={filter.assignee ?? ""}
        options={assigneeOptions}
        onChange={(assignee) => onChange({ assignee: assignee || undefined })}
      />
      <SaveView filter={filter} />
    </div>
  );
}

function SaveView({ filter }: { filter: Filter }) {
  const { data: views = [] } = useSavedViews();
  const save = useSaveView();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const query = filterQuery(filter);
  if (!query || views.some((view) => view.query === query)) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      { name, query },
      {
        onSuccess: () => {
          setName("");
          setNaming(false);
        },
      },
    );
  }

  if (!naming) {
    return (
      <button type="button" className="btn-ghost col-span-2 h-8" onClick={() => setNaming(true)}>
        Save this view
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="col-span-2 flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          className="input h-8"
          placeholder="View name"
          value={name}
          maxLength={40}
          autoFocus
          required
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-primary h-8" disabled={save.isPending}>
          Save
        </button>
        <button type="button" className="btn-quiet h-8" onClick={() => setNaming(false)}>
          Cancel
        </button>
      </div>
      <ErrorText error={save.error} />
    </form>
  );
}
