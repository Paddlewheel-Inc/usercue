import { LIMITS, STATUS_LABELS, STATUSES, type Status, tagColorHex } from "@usercue/shared";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Comment } from "../lib/api";
import { getSavedName, saveName, timeAgo } from "../lib/format";
import {
  can,
  useAddComment,
  useAuthMethods,
  useDeleteComment,
  useDeletePost,
  useMe,
  usePost,
  useSettings,
  useTags,
  useUpdatePost,
  useVote,
} from "../lib/queries";
import { Editor } from "./Editor";
import {
  Check,
  Heart,
  More,
  Plus,
  StatusClosed,
  StatusComplete,
  StatusOpen,
  StatusPlanned,
  StatusProgress,
  Trash,
} from "./icons";
import { OAuthButtons } from "./OAuthButtons";
import { RichText } from "./RichText";
import {
  Avatar,
  Empty,
  ErrorText,
  RoleBadge,
  ShareButton,
  STATUS_INK,
  StatusBadge,
  TagChip,
  VoteButton,
} from "./ui";

const STATUS_ICONS = {
  open: StatusOpen,
  planned: StatusPlanned,
  in_progress: StatusProgress,
  complete: StatusComplete,
  closed: StatusClosed,
} as const;

interface PostDetailProps {
  id: number;
  onDeleted?: () => void;
}

export function PostDetail({ id, onDeleted }: PostDetailProps) {
  const { data: post, isLoading } = usePost(id);
  const { data: me } = useMe();
  const vote = useVote();
  const update = useUpdatePost(id);
  const remove = useDeletePost(id);

  if (isLoading) return null;
  if (!post) return <Empty title="Post not found" />;

  const canTriage = can(me, "manage_posts");

  return (
    <article className="flex animate-in items-start gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] leading-7 font-semibold tracking-tight">{post.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
              <Avatar name={post.authorName} src={post.authorAvatar} size="sm" />
              <span className="text-fg">{post.authorName}</span>
              {post.authorRole && (
                <RoleBadge name={post.authorRole.name} iconUrl={post.authorRole.iconUrl} />
              )}
              <span className="text-faint">·</span>
              <span>{timeAgo(post.createdAt)}</span>
            </p>
            <PostTags
              tags={post.tags}
              canTriage={canTriage}
              onChange={(tagIds) => update.mutate({ tagIds })}
            />
          </div>
          <div className="md:hidden">
            <VoteButton
              count={post.voteCount}
              voted={post.voted}
              onClick={() => vote.mutate(post.id)}
            />
          </div>
        </header>

        {post.body && (
          <div className="rounded-2xl bg-hover/60 px-4 py-3">
            <RichText html={post.body} />
          </div>
        )}

        <PostActions
          postId={post.id}
          status={post.status}
          boardName={post.boardName}
          assignee={post.assignee}
          canTriage={canTriage}
          onStatus={(status) => update.mutate({ status })}
          onAssign={(assigneeId) => update.mutate({ assigneeId })}
          onDelete={() => {
            if (confirm("Delete this post and all its comments?")) {
              remove.mutate(undefined, { onSuccess: onDeleted });
            }
          }}
        />

        <div className="md:hidden">
          <StatusRoad current={post.status} />
        </div>

        <ActivityLog history={post.history ?? []} />

        <section className="flex flex-col gap-5 border-t pt-6">
          <h2 className="text-[13px] font-medium">
            Comments
            <span className="ml-2 text-faint tabular-nums">{post.comments.length}</span>
          </h2>

          <CommentThread postId={id} comments={post.comments} />
        </section>
      </div>

      <aside className="sticky top-20 hidden w-40 shrink-0 flex-col items-center gap-6 md:flex">
        <VoteButton
          count={post.voteCount}
          voted={post.voted}
          onClick={() => vote.mutate(post.id)}
        />
        <StatusRoad current={post.status} />
      </aside>
    </article>
  );
}

const ROAD: Status[] = ["open", "planned", "in_progress", "complete"];
const CLOSED_ROAD: Status[] = ["open", "planned", "in_progress", "closed"];

type StatusStop = {
  id: number;
  status: Status;
  actorName: string;
  actorAvatar: string | null;
  createdAt: number;
};

type Assignee = { id: number; name: string; avatarUrl: string | null };

function StatusRoad({ current }: { current: Status }) {
  const stops = current === "closed" ? CLOSED_ROAD : ROAD;
  const found = stops.indexOf(current);
  const currentIndex = found === -1 ? 0 : found;

  return (
    <ol className="flex flex-col" aria-label="Status">
      {stops.map((status, i) => {
        const reached = i <= currentIndex;
        const active = status === current;
        const last = i === stops.length - 1;
        return (
          <li key={status} className="relative flex gap-2.5 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={`absolute top-5 bottom-0 left-2.25 w-0.5 bg-[repeating-linear-gradient(180deg,currentColor_0_4px,transparent_4px_9px)] ${
                  i < currentIndex ? "text-fg/30" : "text-faint/40"
                }`}
              />
            )}
            <div className="relative z-10 flex size-5 shrink-0 items-center justify-center bg-bg">
              <StopHeart status={status} active={active} reached={reached} />
            </div>
            <p
              className={`min-w-0 pt-px text-[11px] leading-4 font-medium ${
                active ? "text-fg" : reached ? "text-muted" : "text-faint"
              }`}
            >
              {STATUS_LABELS[status]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function ActivityLog({ history }: { history: StatusStop[] }) {
  const events = history.filter((item, i) => !(i === 0 && item.status === "open"));
  if (events.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {events.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5">
          <Avatar name={item.actorName} src={item.actorAvatar} size="sm" />
          <p className="min-w-0 pt-0.5 text-[13px] leading-5 text-muted">
            <span className="font-medium text-fg">{item.actorName}</span>
            {` updated this status to ${STATUS_LABELS[item.status]}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

function StopHeart({
  status,
  active,
  reached,
}: {
  status: Status;
  active: boolean;
  reached: boolean;
}) {
  const color = STATUS_INK[status];
  if (active) {
    return (
      <span className={`relative flex size-5 items-center justify-center ${color}`}>
        <Heart className="animate-stop" width={14} height={14} fill="currentColor" stroke="none" />
      </span>
    );
  }
  if (reached) {
    return <Heart className={color} width={14} height={14} fill="currentColor" stroke="none" />;
  }
  return <Heart className={`${color} opacity-40`} width={14} height={14} />;
}

function AssigneeControl({
  assignee,
  canTriage,
  onAssign,
}: {
  assignee: Assignee | null;
  canTriage: boolean;
  onAssign: (assigneeId: number | null) => void;
}) {
  const { data: me } = useMe();
  const mode = me?.assignmentMode ?? "off";
  const { data: settings } = useSettings(mode !== "off" && canTriage);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const staff = settings?.staff ?? [];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (mode === "off") return null;

  const label = assignee ? (
    <span className="inline-flex items-center gap-1.5">
      <Avatar name={assignee.name} src={assignee.avatarUrl} size="xs" />
      <span className="max-w-32 truncate">{assignee.name}</span>
    </span>
  ) : (
    <span>Unassigned</span>
  );

  if (!canTriage) {
    return <span className="chip text-muted">{label}</span>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="chip text-muted hover:bg-hover hover:text-fg"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && (
        <div role="menu" className="menu absolute left-0 z-30 mt-1.5 w-48">
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              onAssign(null);
              setOpen(false);
            }}
          >
            Unassigned
          </button>
          {staff.map((person) => (
            <button
              key={person.id}
              type="button"
              role="menuitem"
              className="menu-item gap-2"
              onClick={() => {
                onAssign(person.id);
                setOpen(false);
              }}
            >
              <Avatar name={person.name} src={person.avatarUrl} size="xs" />
              <span className="min-w-0 flex-1 truncate text-left">{person.name}</span>
              {assignee?.id === person.id && <Check width={12} height={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PostActions({
  postId,
  status,
  boardName,
  assignee,
  canTriage,
  onStatus,
  onAssign,
  onDelete,
}: {
  postId: number;
  status: Status;
  boardName: string;
  assignee: Assignee | null;
  canTriage: boolean;
  onStatus: (status: Status) => void;
  onAssign: (assigneeId: number | null) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} />
      <span className="text-xs text-faint">{boardName}</span>
      <ShareButton url={`${window.location.origin}/post/${postId}`} />
      <AssigneeControl assignee={assignee} canTriage={canTriage} onAssign={onAssign} />
      {canTriage && (
        <div className="relative" ref={ref}>
          <button
            type="button"
            className="btn-quiet size-7 p-0"
            aria-label="More actions"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((value) => !value)}
          >
            <More />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-2 w-52 origin-top-right animate-rise overflow-hidden rounded-2xl bg-bg shadow-[0_0_0_1px_var(--line),var(--shadow)]"
            >
              <div className="px-2.5 pt-2.5 pb-1.5">
                <p className="px-2 pb-1.5 text-[10px] font-medium tracking-wide text-faint uppercase">
                  Status
                </p>
                <div className="flex flex-col gap-0.5">
                  {STATUSES.map((item) => {
                    const Icon = STATUS_ICONS[item];
                    const selected = item === status;
                    return (
                      <button
                        key={item}
                        type="button"
                        role="menuitem"
                        className={`flex h-8 w-full items-center gap-2.5 rounded-xl px-2 text-[13px] transition-colors ${
                          selected
                            ? "bg-hover text-fg"
                            : "text-muted hover:bg-hover hover:text-fg"
                        }`}
                        onClick={() => {
                          onStatus(item);
                          setOpen(false);
                        }}
                      >
                        <Icon width={14} height={14} className={STATUS_INK[item]} />
                        <span className="flex-1 text-left">{STATUS_LABELS[item]}</span>
                        {selected && <Check width={12} height={12} className="text-fg" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-[var(--line)] px-2.5 py-2">
                <button
                  type="button"
                  role="menuitem"
                  className="flex h-8 w-full items-center gap-2.5 rounded-xl px-2 text-[13px] text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                  onClick={() => {
                    setOpen(false);
                    onDelete();
                  }}
                >
                  <Trash width={14} height={14} />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function byTime(a: Comment, b: Comment) {
  return Number(a.createdAt) - Number(b.createdAt) || a.id - b.id;
}

function CommentThread({ postId, comments }: { postId: number; comments: Comment[] }) {
  const [reply, setReply] = useState<{ id: number; name: string } | null>(null);
  const roots = comments.filter((comment) => comment.parentId == null).sort(byTime);

  return (
    <>
      {comments.length === 0 && (
        <p className="text-xs text-faint">No comments yet. Start the thread.</p>
      )}

      <ul className="flex flex-col gap-5">
        {roots.map((comment) => (
          <CommentNode
            key={comment.id}
            comment={comment}
            depth={0}
            comments={comments}
            postId={postId}
            reply={reply}
            onReply={setReply}
          />
        ))}
      </ul>

      <CommentForm postId={postId} />
    </>
  );
}

function CommentNode({
  comment,
  depth,
  comments,
  postId,
  reply,
  onReply,
}: {
  comment: Comment;
  depth: number;
  comments: Comment[];
  postId: number;
  reply: { id: number; name: string } | null;
  onReply: (reply: { id: number; name: string } | null) => void;
}) {
  const replies = comments.filter((item) => item.parentId === comment.id).sort(byTime);
  const open = reply?.id === comment.id;

  return (
    <li className="flex flex-col gap-3">
      <CommentItem
        postId={postId}
        comment={comment}
        hasReplies={replies.length > 0}
        active={open}
        onReply={() => onReply(open ? null : { id: comment.id, name: comment.authorName })}
      />
      {open && reply && (
        <CommentForm
          postId={postId}
          parentId={comment.id}
          placeholder={`Reply to ${reply.name}`}
          submitLabel="Reply"
          autoFocus
          onCancel={() => onReply(null)}
        />
      )}
      {replies.length > 0 && (
        <ul
          className={`flex flex-col gap-3 border-l border-line pl-3 ${depth < 4 ? "ml-5 sm:ml-8" : ""}`}
        >
          {replies.map((item) => (
            <CommentNode
              key={item.id}
              comment={item}
              depth={depth + 1}
              comments={comments}
              postId={postId}
              reply={reply}
              onReply={onReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CommentItem({
  postId,
  comment,
  hasReplies,
  active,
  onReply,
}: {
  postId: number;
  comment: Comment;
  hasReplies: boolean;
  active: boolean;
  onReply: () => void;
}) {
  const { data: me } = useMe();
  const remove = useDeleteComment(postId);
  const staff = Boolean(me?.user?.staff && !me.user.suspended);

  return (
    <div className="flex gap-3">
      <Avatar
        name={comment.authorName}
        src={comment.authorAvatar}
        team={comment.isTeam}
        size="md"
      />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-medium">{comment.authorName}</span>
          {comment.authorRole && (
            <RoleBadge name={comment.authorRole.name} iconUrl={comment.authorRole.iconUrl} />
          )}
          <span className="text-[12px] text-faint">{timeAgo(comment.createdAt)}</span>
          <button
            type="button"
            aria-expanded={active}
            className={`rounded-full px-2 py-0.5 text-[12px] font-medium transition-colors ${
              active ? "bg-accent-soft text-accent-text" : "bg-hover text-fg hover:bg-line"
            }`}
            onClick={onReply}
          >
            Reply
          </button>
          {staff && (
            <button
              type="button"
              className="rounded-full bg-hover px-2 py-0.5 text-[12px] font-medium text-fg transition-colors hover:bg-line"
              disabled={remove.isPending}
              onClick={() => {
                const message = hasReplies
                  ? "Delete this comment and its replies?"
                  : "Delete this comment?";
                if (confirm(message)) remove.mutate(comment.id);
              }}
            >
              Delete
            </button>
          )}
        </p>
        <div className="mt-1">
          <RichText html={comment.body} />
        </div>
        <ErrorText error={remove.error} />
      </div>
    </div>
  );
}

function PostTags({
  tags,
  canTriage,
  onChange,
}: {
  tags: { id: number; name: string; color: string }[];
  canTriage: boolean;
  onChange: (tagIds: number[]) => void;
}) {
  const { data: allTags = [] } = useTags(canTriage);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (tags.length === 0 && !canTriage) return null;

  function toggle(tagId: number) {
    const ids = tags.map((tag) => tag.id);
    onChange(ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]);
  }

  return (
    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip key={tag.id} name={tag.name} color={tag.color} />
      ))}
      {canTriage && (
        <div className="relative" ref={ref}>
          <button
            type="button"
            className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((value) => !value)}
          >
            <Plus width={11} height={11} />
            Tag
          </button>
          {open && (
            <div role="menu" className="menu absolute top-full left-0 z-30 mt-1.5 w-52">
              {allTags.length === 0 ? (
                <p className="px-3 py-2.5 text-[12px] leading-5 text-muted">
                  No tags yet. Add them in Settings.
                </p>
              ) : (
                allTags.map((tag) => {
                  const selected = tags.some((item) => item.id === tag.id);
                  const full = tags.length >= 8 && !selected;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={selected}
                      disabled={full}
                      className="menu-item gap-2 disabled:opacity-40"
                      onClick={() => toggle(tag.id)}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: tagColorHex(tag.color) }}
                      />
                      <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                      {selected && <Check width={12} height={12} />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentForm({
  postId,
  parentId,
  placeholder = "Write a comment…  @ someone, or # a suggestion",
  submitLabel = "Comment",
  autoFocus = false,
  onCancel,
}: {
  postId: number;
  parentId?: number;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const { data: me } = useMe();
  const { data: methods } = useAuthMethods();
  const add = useAddComment(postId);
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState("");
  const [name, setName] = useState(getSavedName);
  const user = me?.user;
  const identity = me?.identity;
  const guest = !user && !identity;
  const allowGuest = me?.allowGuestFeedback !== false;
  const mustSignIn = guest && !allowGuest;
  const suspended = Boolean(user?.suspended);

  useEffect(() => {
    if (autoFocus) formRef.current?.scrollIntoView({ block: "nearest" });
  }, [autoFocus]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const author = guest ? name.trim() : undefined;
    if (author) saveName(author);
    add.mutate(
      { body, name: author, parentId },
      {
        onSuccess: () => {
          setBody("");
          onCancel?.();
        },
      },
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="card px-3 pt-2.5 pb-2">
      <Editor
        value={body}
        onChange={setBody}
        placeholder={placeholder}
        maxLength={LIMITS.comment}
        mentions
        people
        excludeId={postId}
        autoFocus={autoFocus}
      />
      {mustSignIn && (
        <div className="mt-2 flex flex-col gap-2">
          {methods?.providers.length ? (
            <OAuthButtons next="board" />
          ) : (
            <p className="text-[12px] text-muted">Sign in is required to comment.</p>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        {guest && allowGuest && (
          <input
            className="input max-w-36"
            placeholder="Your name"
            value={name}
            maxLength={LIMITS.name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        {(user || identity) && (
          <span className="inline-flex items-center gap-1.5 px-1 text-[13px] text-muted">
            <Avatar name={user?.name ?? identity?.name ?? ""} src={user?.avatarUrl} size="xs" />
            {user?.name ?? identity?.name}
          </span>
        )}
        <div className="flex-1" />
        {suspended && <p className="text-xs text-rose-500">Your account has been suspended.</p>}
        <ErrorText error={add.error} />
        {onCancel && (
          <button type="button" className="btn-quiet h-7 px-2.5" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn-primary h-7 px-2.5"
          disabled={add.isPending || !body || mustSignIn || suspended}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
