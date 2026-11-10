import { type FormEvent, useState } from "react";
import { Avatar, CopyField, ErrorText } from "../../components/ui";
import { timeAgo } from "../../lib/format";
import {
  useInviteStaff,
  useMe,
  useRemoveStaff,
  useRevokeInvite,
  useSettings,
} from "../../lib/queries";

export function StaffSettings() {
  const { data: me } = useMe();
  const { data, isLoading } = useSettings();
  const invite = useInviteStaff();
  const revoke = useRevokeInvite();
  const remove = useRemoveStaff();
  const [email, setEmail] = useState("");
  const [lastLink, setLastLink] = useState<string>();
  const [promoted, setPromoted] = useState<string>();

  if (isLoading || !data) return null;

  const seats = data.plan.limits.find((limit) => limit.key === "staffSeats");
  const seatsFull = Boolean(seats?.reached);

  function submitInvite(e: FormEvent) {
    e.preventDefault();
    invite.mutate(email, {
      onSuccess: (row) => {
        setEmail("");
        if ("promoted" in row && row.promoted) {
          setPromoted(row.name ?? email);
          setLastLink(undefined);
          return;
        }
        setPromoted(undefined);
        if ("url" in row) setLastLink(row.url);
      },
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[13px] font-medium">Staff</h2>
        <p className="mt-1 text-[12px] text-muted">
          Invite someone to the dashboard. They set their own password from the registration link.
        </p>
        {seats && seats.max !== null && (
          <p className="mt-1 text-[12px] text-faint">
            {seats.used} of {seats.max} {seats.unit} used on the {data.plan.label} plan. Pending
            invites count toward this.
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {data.staff.map((person) => (
          <li key={person.id} className="flex items-center gap-2.5">
            <Avatar name={person.name} src={person.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{person.name}</p>
              <p className="truncate text-[11px] text-faint">
                {person.email}
                {person.roleName ? ` · ${person.roleName}` : ""}
              </p>
            </div>
            {person.id !== me?.user?.id && (
              <button
                type="button"
                className="btn-quiet h-7 px-2.5"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(`Remove ${person.name} from staff?`)) remove.mutate(person.id);
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {seatsFull && seats && seats.max !== null && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-5">
          <p className="font-medium">
            This instance has reached its limit of {seats.max} staff users.
          </p>
          <p className="mt-0.5 text-muted">
            The {data.plan.label} plan includes {seats.max} {seats.unit}. Upgrade this instance to
            Pro, or get an additional instance, from your UserCue account to invite more people.
            Revoking a pending invite also frees a seat.
          </p>
        </div>
      )}

      <form onSubmit={submitInvite} className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input"
          type="email"
          placeholder="staff@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={seatsFull}
          required
        />
        <button
          type="submit"
          className="btn-primary shrink-0"
          disabled={invite.isPending || seatsFull}
        >
          Invite
        </button>
      </form>
      <ErrorText error={invite.error ?? remove.error ?? revoke.error} />
      {promoted && (
        <p className="text-[12px] text-muted">
          {promoted} already had an account. They can now open the workspace.
        </p>
      )}
      {lastLink && (
        <CopyField
          label={
            invite.data && "emailSent" in invite.data && invite.data.emailSent
              ? "Invite emailed. You can still copy the link"
              : "Registration link"
          }
          value={lastLink}
        />
      )}

      {data.invites.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-[11px] font-medium tracking-[0.12em] text-faint uppercase">
            Pending invites
          </p>
          {data.invites.map((row) => (
            <div key={row.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[13px]">{row.email}</p>
                <span className="text-[11px] text-faint">
                  {row.emailSent ? "Emailed · " : ""}
                  expires {timeAgo(row.expiresAt)}
                </span>
                <button
                  type="button"
                  className="btn-quiet h-7 px-2.5"
                  onClick={() => revoke.mutate(row.id)}
                >
                  Revoke
                </button>
              </div>
              <CopyField label="Registration link" value={row.url} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
