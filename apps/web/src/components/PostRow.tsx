import { Link } from "wouter";
import type { Post } from "../lib/api";
import { shortDate } from "../lib/format";
import { useVote } from "../lib/queries";
import { Comment } from "./icons";
import { Avatar, RoleBadge, STATUS_DOT, TagChip, VoteButton } from "./ui";

interface PostRowProps {
  post: Post;
  href: string;
  active?: boolean;
  compact?: boolean;
  index?: number;
}

export function PostRow({ post, href, active = false, compact = false, index = 0 }: PostRowProps) {
  const vote = useVote();
  const toggle = () => vote.mutate(post.id);
  const delay = { animationDelay: `${Math.min(index, 12) * 35}ms` };

  if (compact) {
    return (
      <Link
        href={href}
        style={delay}
        className={`flex min-w-0 animate-in items-start gap-3 rounded-2xl py-3 pr-3.5 transition-colors ${
          active ? "bg-surface pl-3 shadow-[var(--shadow)]" : "pl-3.5 hover:bg-hover/80"
        }`}
      >
        {active && <span className="mt-1 h-7 w-1 shrink-0 rounded-full bg-accent" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{post.title}</div>
          {post.tags.length > 0 && (
            <div className="mt-1.5 flex w-full min-w-0 flex-wrap gap-1">
              {post.tags.slice(0, 3).map((tag) => (
                <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
              ))}
            </div>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Avatar name={post.authorName} src={post.authorAvatar} size="xs" />
            <span className="truncate">{post.authorName}</span>
            {post.authorRole && (
              <RoleBadge name={post.authorRole.name} iconUrl={post.authorRole.iconUrl} size="xs" />
            )}
            <span className="text-faint">·</span>
            <span className="shrink-0">{shortDate(post.createdAt)}</span>
            {post.status !== "open" && (
              <span className={`size-1.5 rounded-full ${STATUS_DOT[post.status]}`} />
            )}
            {post.commentCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-faint">
                <Comment width={11} height={11} />
                {post.commentCount}
              </span>
            )}
          </div>
        </div>
        <VoteButton
          compact
          postId={post.id}
          count={post.voteCount}
          voted={post.voted}
          onClick={toggle}
        />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      style={delay}
      className="card lift flex w-full min-w-0 animate-in items-center gap-3 px-3.5 py-3.5"
    >
      <VoteButton postId={post.id} count={post.voteCount} voted={post.voted} onClick={toggle} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{post.title}</div>
        {post.tags.length > 0 && (
          <div className="mt-1.5 flex w-full min-w-0 flex-wrap gap-1">
            {post.tags.slice(0, 3).map((tag) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Avatar name={post.authorName} src={post.authorAvatar} size="xs" />
          <span className="truncate">{post.authorName}</span>
          {post.authorRole && (
            <RoleBadge name={post.authorRole.name} iconUrl={post.authorRole.iconUrl} size="xs" />
          )}
          <span className="text-faint">·</span>
          <span>{shortDate(post.createdAt)}</span>
          {post.status !== "open" && (
            <>
              <span className="text-faint">·</span>
              <span className={`size-1.5 rounded-full ${STATUS_DOT[post.status]}`} />
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
