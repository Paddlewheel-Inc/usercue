import type { TaskDetail } from "../lib/api";
import { useAddMember, useRemoveMember } from "../lib/workQueries";
import { Close, Plus } from "./icons";
import { Select } from "./Select";
import { Avatar, ErrorText, useToast } from "./ui";

interface Person {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export function TaskMembers({ task, staff }: { task: TaskDetail; staff: Person[] }) {
  const toast = useToast();
  const add = useAddMember();
  const remove = useRemoveMember();

  const onError = (e: Error) => toast({ message: e.message, tone: "error" });
  const memberIds = new Set(task.members.map((member) => member.id));
  const addable = staff.filter((person) => !memberIds.has(person.id));

  const options = [
    {
      value: "",
      label: "Add member",
      icon: <Plus width={14} height={14} className="shrink-0 text-faint" />,
    },
    ...addable.map((person) => ({
      value: String(person.id),
      label: person.name,
      icon: <Avatar name={person.name} src={person.avatarUrl} size="sm" />,
    })),
  ];

  return (
    <div className="mt-1 flex flex-col pt-2">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[12px] text-faint">Members</span>
        {task.members.length > 0 && (
          <span className="text-[11px] text-faint tabular-nums">{task.members.length}</span>
        )}
      </div>

      {task.members.length === 0 && (
        <p className="px-2 pb-1 text-[12px] text-faint">
          Nobody yet. Add the people working on this.
        </p>
      )}
      {task.members.length > 0 && (
        <ul className="flex flex-col">
          {task.members.map((member) => (
            <li
              key={member.id}
              className="group flex min-h-8 items-center gap-2 rounded-lg px-2 text-[13px] hover:bg-hover/60"
            >
              <Avatar name={member.name} src={member.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate">{member.name}</span>
              <button
                type="button"
                aria-label={`Remove ${member.name}`}
                title="Remove"
                disabled={remove.isPending}
                className="inline-flex size-6 items-center justify-center rounded-full text-faint opacity-0 transition hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => remove.mutate({ id: task.id, userId: member.id }, { onError })}
              >
                <Close width={12} height={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {addable.length === 0 && task.members.length > 0 && (
        <p className="px-2 pt-1 pb-2 text-[12px] text-faint">Everyone on staff is on this task.</p>
      )}
      {addable.length > 0 && (
        <Select
          quiet
          label="Add member"
          value=""
          options={options}
          onChange={(value) => {
            if (value) add.mutate({ id: task.id, userId: Number(value) }, { onError });
          }}
        />
      )}
      <ErrorText error={add.error} />
    </div>
  );
}
