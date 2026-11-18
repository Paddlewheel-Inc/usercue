import { useDeferredValue, useState } from "react";
import { Link } from "wouter";
import { usePosts } from "../lib/queries";
import { Search } from "./icons";
import { ErrorText } from "./ui";
import { StatusIcon } from "./WorkflowIcon";

interface LinkedPost {
  id: number;
  title: string;
  status: string;
  votes: number;
  boardName: string;
}

export function RequestLinks({
  posts,
  canEdit,
  pending,
  error,
  onLink,
  onUnlink,
}: {
  posts: LinkedPost[];
  canEdit: boolean;
  pending: boolean;
  error: Error | null;
  onLink: (postId: number, done: () => void) => void;
  onUnlink: (postId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim());
  const { data: results } = usePosts({ q: search || undefined, sort: "new" });
  const linked = new Set(posts.map((post) => post.id));
  const matches = search ? (results ?? []).filter((post) => !linked.has(post.id)).slice(0, 6) : [];

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
            <input
              className="input pl-9"
              placeholder="Search requests to link"
              aria-label="Search requests to link"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {matches.length > 0 && (
            <ul className="card flex flex-col p-1.5">
              {matches.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-hover"
                    disabled={pending}
                    onClick={() => onLink(post.id, () => setQuery(""))}
                  >
                    <StatusIcon status={post.status} size={14} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{post.title}</span>
                    <span className="shrink-0 text-[11px] font-medium text-accent-text">Link</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ErrorText error={error} />
        </div>
      )}
      {posts.length > 0 && (
        <ul className="card flex flex-col p-1.5">
          {posts.map((post) => (
            <li key={post.id} className="group flex items-center">
              <Link
                href={`/admin/requests/${post.id}`}
                className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-hover"
              >
                <StatusIcon status={post.status} size={14} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {post.title}
                </span>
                <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
                  {post.votes} {post.votes === 1 ? "vote" : "votes"} · {post.boardName}
                </span>
              </Link>
              {canEdit && (
                <button
                  type="button"
                  className="mr-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] text-faint opacity-0 transition-[opacity,color] group-hover:opacity-100 hover:text-rose-600 focus-visible:opacity-100"
                  disabled={pending}
                  onClick={() => onUnlink(post.id)}
                >
                  Unlink
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
