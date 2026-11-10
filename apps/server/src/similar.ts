import { searchTerms, similarThreshold } from "@usercue/shared";
import { db } from "./db";

const RESULT_LIMIT = 5;

interface SimilarRow {
  id: number;
  title: string;
  status: string;
  vote_count: number;
  board: string;
  hits: number;
}

const findSimilar = db.query<SimilarRow>(
  `SELECT p.id, p.title, p.status, p.vote_count, b.slug AS board,
          (SELECT COUNT(*)::int
           FROM unnest(string_to_array($terms::text, ',')) AS t(term)
           WHERE to_tsvector('english', p.title || ' ' || p.body) @@ to_tsquery('english', t.term || ':*')) AS hits
   FROM posts p
   JOIN boards b ON b.id = p.board_id
   WHERE to_tsvector('english', p.title || ' ' || p.body) @@ to_tsquery('english', $any)
   ORDER BY hits DESC, p.vote_count DESC, p.id DESC
   LIMIT 20`,
);

export async function similarPosts(text: string) {
  const terms = searchTerms(text);
  if (terms.length === 0) return [];
  const rows = await findSimilar.all({
    terms: terms.join(","),
    any: terms.map((term) => `${term}:*`).join(" | "),
  });
  const threshold = similarThreshold(terms.length);
  return rows
    .filter((row) => row.hits >= threshold)
    .slice(0, RESULT_LIMIT)
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      voteCount: row.vote_count,
      board: row.board,
    }));
}
