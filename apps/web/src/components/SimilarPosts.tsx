import { SIMILAR_MIN_LENGTH } from "@usercue/shared";
import { useDeferredValue } from "react";
import { Link } from "wouter";
import { useSimilarPosts } from "../lib/queries";
import { StatusIcon } from "./WorkflowIcon";

export function SimilarPosts({ text }: { text: string }) {
  const query = useDeferredValue(text.trim());
  const { data } = useSimilarPosts(query);
  const posts = query.length >= SIMILAR_MIN_LENGTH ? (data?.posts ?? []) : [];
  if (posts.length === 0) return null;

  return (
    <div className="mx-4 mb-3 flex animate-rise flex-col gap-0.5 rounded-2xl bg-hover/60 p-1.5">
      <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-muted">
        Already suggested? Vote on it instead.
      </p>
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/post/${post.id}`}
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors hover:bg-hover"
        >
          <StatusIcon status={post.status} />
          <span className="min-w-0 flex-1 truncate">{post.title}</span>
          <span className="text-[12px] text-faint tabular-nums">{post.voteCount}</span>
        </Link>
      ))}
    </div>
  );
}
