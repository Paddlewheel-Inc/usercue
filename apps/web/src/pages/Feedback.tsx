import { type Sort, type Status } from "@usercue/shared";
import { useDeferredValue, useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import { Search } from "../components/icons";
import { PostForm } from "../components/PostForm";
import { PostRow } from "../components/PostRow";
import { Empty } from "../components/ui";
import { useBoards, useCounts, usePosts } from "../lib/queries";
import { useWorkflow } from "../lib/workflow";

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
];

export function Feedback() {
  const { statuses } = useWorkflow();
  const params = useParams<{ board?: string }>();
  const { data: boards = [] } = useBoards();
  const [sort, setSort] = useState<Sort>("top");
  const [status, setStatus] = useState<Status | undefined>();
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());

  const compose = new URLSearchParams(useSearch()).has("new");
  const board = params.board ?? boards[0]?.slug;
  const { data: counts } = useCounts(board);
  const { data: posts, isLoading } = usePosts({ board, status, sort, q: q || undefined });

  return (
    <div className="flex flex-col gap-6">
      {board && <PostForm board={board} defaultOpen={compose} />}

      <div className="flex flex-col gap-3">
        {boards.length > 1 && (
          <nav className="flex flex-wrap gap-1">
            {boards.map((b) => (
              <Link
                key={b.slug}
                href={`/board/${b.slug}`}
                className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] transition-colors ${
                  b.slug === board
                    ? "bg-surface font-medium text-fg shadow-[var(--shadow)]"
                    : "text-muted hover:bg-hover/70 hover:text-fg"
                }`}
              >
                {b.name}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Filter active={!status} onClick={() => setStatus(undefined)}>
            All
          </Filter>
          {statuses
            .filter((s) => s.category !== "closed")
            .map((item) => {
              const s = item.id;
              return (
                <Filter
                  key={s}
                  active={status === s}
                  onClick={() => setStatus(status === s ? undefined : s)}
                  count={counts?.[s]}
                >
                  {item.name}
                </Filter>
              );
            })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
            <input
              className="input pl-9"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex rounded-full bg-hover/80 p-0.5">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSort(o.value)}
                className={`h-8 rounded-full px-3.5 text-[13px] transition-colors ${
                  sort === o.value ? "bg-surface text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {posts?.map((post, i) => (
          <PostRow key={post.id} post={post} href={`/post/${post.id}`} index={i} />
        ))}
        {!isLoading && posts?.length === 0 && (
          <Empty title={q ? "No matches" : "Nothing here yet"}>
            {q ? "Try a different search." : "Be the first to share an idea."}
          </Empty>
        )}
      </div>
    </div>
  );
}

function Filter({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] transition-colors ${
        active ? "bg-accent text-white" : "text-muted hover:bg-hover hover:text-fg"
      }`}
    >
      {children}
      {count ? (
        <span className={`ml-1 ${active ? "text-white/70" : "text-faint"}`}>{count}</span>
      ) : null}
    </button>
  );
}
