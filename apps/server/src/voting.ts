import { db } from "./db";
import { voteLimit } from "./workspace";

const countActiveVotes = db.query<{ n: number }>(
  `SELECT COUNT(*)::int AS n
   FROM votes v
   JOIN posts p ON p.id = v.post_id
   JOIN workflow_statuses s ON s.id = p.status
   WHERE s.category IN ('open', 'planned', 'in_progress')
     AND (v.voter_id = $voter OR ($user::int IS NOT NULL AND v.user_id = $user::int))`,
);

export async function voteBudget(voterId: string, userId: number | null) {
  const limit = await voteLimit();
  if (limit === 0) return { limit, used: 0 };
  const row = await countActiveVotes.get({ voter: voterId, user: userId });
  return { limit, used: row?.n ?? 0 };
}

export async function hasVotesLeft(voterId: string, userId: number | null) {
  const { limit, used } = await voteBudget(voterId, userId);
  return limit === 0 || used < limit;
}
