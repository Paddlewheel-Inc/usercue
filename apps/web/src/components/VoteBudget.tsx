import { useVoteBudget } from "../lib/queries";

export function VoteBudget() {
  const { data } = useVoteBudget();
  if (!data || data.limit === 0) return null;
  const left = Math.max(0, data.limit - data.used);

  return (
    <p className="px-1 text-[12px] text-muted">
      {left} of {data.limit} votes left. Votes come back when a request ships or closes.
    </p>
  );
}
