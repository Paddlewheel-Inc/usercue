import { STATUS_LABELS, type Status } from "@usercue/shared";
import { Link } from "wouter";
import { Plus } from "../components/icons";
import { Avatar, STATUS_DOT, TagChip, VoteButton } from "../components/ui";
import type { Post } from "../lib/api";
import { excerpt } from "../lib/format";
import { usePosts, useVote } from "../lib/queries";

const LANES: { status: Status; hint: string }[] = [
  { status: "planned", hint: "What we're doing next" },
  { status: "in_progress", hint: "In motion right now" },
  { status: "complete", hint: "Recently shipped" },
];

function hueFor(name: string): number {
  return [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
}

function Card({ post, index }: { post: Post; index: number }) {
  const vote = useVote();
  const preview = excerpt(post.body);

  return (
    <Link
      href={`/post/${post.id}`}
      style={{ animationDelay: `${index * 40}ms` }}
      className="flex min-w-0 animate-in flex-col gap-2.5 rounded-2xl bg-surface/70 p-4 transition-colors hover:bg-surface"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span
            className="size-3.5 shrink-0 rounded-full"
            style={{ background: `hsl(${hueFor(post.boardName)} 45% 52%)` }}
          />
          <span className="truncate">{post.boardName}</span>
        </span>
        <VoteButton
          compact
          postId={post.id}
          count={post.voteCount}
          voted={post.voted}
          onClick={() => vote.mutate(post.id)}
        />
      </div>
      <span className="text-[13px] leading-5 font-medium">{post.title}</span>
      {post.tags.length > 0 && (
        <span className="flex min-w-0 flex-wrap gap-1">
          {post.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
          ))}
        </span>
      )}
      {preview && <p className="line-clamp-2 text-xs leading-5 text-muted">{preview}</p>}
      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
        <Avatar name={post.authorName} src={post.authorAvatar} size="xs" />
        <span className="truncate">{post.authorName}</span>
      </span>
    </Link>
  );
}

function Lane({ status, hint }: (typeof LANES)[number]) {
  const { data: posts = [] } = usePosts({ status });

  return (
    <section className="flex min-w-0 flex-col rounded-[1.5rem] bg-hover/55 p-3">
      <header className="mb-3 flex items-baseline justify-between gap-2 px-2 pt-1">
        <div>
          <h2 className="flex items-center gap-2 text-[13px] font-medium">
            <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABELS[status]}
            <span className="text-faint tabular-nums">{posts.length}</span>
          </h2>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
      </header>
      <div className="flex flex-col gap-2.5">
        {posts.map((post, i) => (
          <Card key={post.id} post={post} index={i} />
        ))}
        {posts.length === 0 && (
          <p className="px-2 py-10 text-center text-xs text-faint">Nothing in this lane yet</p>
        )}
      </div>
    </section>
  );
}

export function Roadmap() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Roadmap</h2>
          <p className="mt-1 text-muted">See what the community is stepping towards.</p>
        </div>
        <Link href="/?new=1" className="btn-primary">
          <Plus /> New
        </Link>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-3">
        {LANES.map((lane) => (
          <Lane key={lane.status} {...lane} />
        ))}
      </div>
    </div>
  );
}
