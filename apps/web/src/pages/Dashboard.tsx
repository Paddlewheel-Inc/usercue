import type { Status } from "@usercue/shared";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUp, Comment, Heart } from "../components/icons";
import { Avatar, TagChip } from "../components/ui";
import { StatusIcon, StatusName } from "../components/WorkflowIcon";
import type { Post } from "../lib/api";
import { excerpt, timeAgo } from "../lib/format";
import { can, useCounts, useMe, usePosts, useWorkspaceUsers } from "../lib/queries";
import { useWorkflow } from "../lib/workflow";
import { AdminShell } from "./Admin";

const today = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

export function Dashboard() {
  return (
    <AdminShell dashboard>
      <DashboardHome />
    </AdminShell>
  );
}

function DashboardHome() {
  const { data: me } = useMe();
  const { data: counts } = useCounts();
  const { data: recent } = usePosts({ sort: "new" });
  const { data: popular } = usePosts({ sort: "top" });
  const { data: doing } = usePosts({ category: "in_progress", sort: "new" });
  const canSeeUsers = can(me, "manage_users");
  const { data: people } = useWorkspaceUsers(canSeeUsers);
  const { statuses } = useWorkflow();

  const first = me?.user?.name.split(/\s+/)[0] ?? "there";
  const tally = counts ?? {};
  const total = Object.values(tally).reduce((sum, count) => sum + count, 0);
  const stages = Object.fromEntries(
    ["open", "planned", "in_progress", "complete", "closed"].map((category) => [
      category,
      statuses
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + (tally[item.id] ?? 0), 0),
    ]),
  );
  const categoryOf = (status: string) => statuses.find((item) => item.id === status)?.category;
  const wanted = (popular ?? [])
    .filter((post) => ["open", "planned"].includes(categoryOf(post.status) ?? "open"))
    .slice(0, 5);
  const latest = (recent ?? []).slice(0, 6);
  const active = (doing ?? []).slice(0, 5);
  const newest = (people?.users ?? []).slice(0, 5);

  return (
    <section className="relative min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-10 pb-14 md:px-10">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">
              {today.format(new Date())}
            </p>
            <h1 className="mt-2 text-[28px] leading-8 font-semibold tracking-tight">
              Hey, {first}.
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-6 text-muted">
              {headline(total, stages)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/changelog" className="btn-ghost">
              Changelog
            </Link>
            <Link href="/admin/requests" className="btn-primary">
              Open the pile
            </Link>
          </div>
        </header>

        <Pipeline counts={tally} total={total} />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <Panel
              title="Most wanted"
              hint="Open and planned requests with the most votes."
              href="/admin/requests"
              action="See all"
            >
              {wanted.length === 0 ? (
                <Quiet
                  title="Nothing’s being asked for yet."
                  body="Once people start voting, the favorites climb to the top here."
                />
              ) : (
                <ul className="card flex flex-col p-1.5">
                  {wanted.map((post) => (
                    <WantedRow key={post.id} post={post} />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Fresh on the board"
              hint="The newest requests, as they come in."
              href="/admin/requests"
              action="Open the pile"
            >
              {latest.length === 0 ? (
                <Quiet
                  title="The board is a blank page."
                  body="Soon as someone writes in, it lands here like a little ticket."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {latest.map((post) => (
                    <Ticket key={post.id} post={post} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            {me?.user && <Yours userId={me.user.id} />}

            <Panel
              title="On stage"
              hint="Whatever you’re actually building."
              href="/admin/requests?status=in_progress"
              action="See all"
            >
              {active.length === 0 ? (
                <Quiet
                  title="Quiet on the floor."
                  body="Move something to In Progress and it shows up here."
                />
              ) : (
                <ul className="card flex flex-col p-1.5">
                  {active.map((post) => (
                    <PostRow key={post.id} post={post} />
                  ))}
                </ul>
              )}
            </Panel>

            {canSeeUsers && (
              <Panel
                title="New faces"
                hint="Folks who just pulled up a chair."
                href="/admin/settings/users"
                action="Everyone"
              >
                {newest.length === 0 ? (
                  <Quiet
                    title="Empty house."
                    body="The next person who signs in shows up right here."
                  />
                ) : (
                  <ul className="card flex flex-col p-1.5">
                    {newest.map((person) => (
                      <li key={person.id}>
                        <Link
                          href="/admin/settings/users"
                          className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-hover"
                        >
                          <Avatar name={person.name} src={person.avatarUrl} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">{person.name}</p>
                            <p className="truncate text-[11px] text-faint">
                              {person.roleName ?? "Member"} · {timeAgo(person.createdAt)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function headline(total: number, counts: Record<Status, number>) {
  if (total === 0) return "Nobody’s written in yet. The board’s all yours.";
  if ((counts.in_progress ?? 0) > 0) {
    return `${counts.in_progress} in motion, ${counts.open} still waiting for a cue.`;
  }
  if ((counts.open ?? 0) > 0)
    return `${total} notes on the board. A few are waiting to be picked up.`;
  return `${total} notes on the board. Go poke around.`;
}

function Panel({
  title,
  hint,
  href,
  action,
  children,
}: {
  title: string;
  hint: string;
  href: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{hint}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 text-[12px] font-medium whitespace-nowrap text-accent-text transition-colors hover:text-accent"
        >
          {action} →
        </Link>
      </div>
      {children}
    </section>
  );
}

function Pipeline({ counts, total }: { counts: Record<Status, number>; total: number }) {
  const { statuses } = useWorkflow();
  const filled = statuses.filter((item) => (counts[item.id] ?? 0) > 0);

  return (
    <div className="card flex flex-col gap-5 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] leading-none font-semibold tracking-tight tabular-nums">
            {total}
          </span>
          <span className="text-[13px] text-muted">
            {total === 1 ? "request" : "requests"} in the pile
          </span>
        </div>
        <Link
          href="/admin/requests"
          className="text-[12px] font-medium text-accent-text transition-colors hover:text-accent"
        >
          View all →
        </Link>
      </div>

      <div
        role="img"
        aria-label="Requests by status"
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-hover"
      >
        {filled.map((item) => (
          <span
            key={item.id}
            className="min-w-1.5 rounded-full"
            style={{ flex: `${counts[item.id]} 1 0`, background: item.color }}
          />
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-1">
        {statuses.map((item) => {
          const n = counts[item.id] ?? 0;
          const share = total > 0 ? Math.round((n / total) * 100) : 0;
          const live = item.category === "in_progress" && n > 0;
          return (
            <Link
              key={item.id}
              href={`/admin/requests?status=${item.id}`}
              className="flex min-w-0 flex-col gap-2 rounded-2xl px-3 py-2.5 transition-colors hover:bg-hover"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
                <span className={live ? "animate-stop" : ""}>
                  <StatusIcon status={item.id} size={14} filled={n > 0} />
                </span>
                <span className="truncate">
                  <StatusName status={item.id} />
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[22px] leading-none font-semibold tabular-nums">{n}</span>
                <span className="text-[11px] text-faint tabular-nums">{share}%</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Yours({ userId }: { userId: number }) {
  const { statuses } = useWorkflow();
  const { data } = usePosts({ assignee: String(userId), sort: "new" });
  const mine = (data ?? [])
    .filter((post) => {
      const category = statuses.find((item) => item.id === post.status)?.category;
      return category !== "complete" && category !== "closed";
    })
    .slice(0, 5);

  if (mine.length === 0) return null;

  return (
    <Panel
      title="Assigned to you"
      hint="Yours to move forward."
      href={`/admin/requests?assignee=${userId}`}
      action="See all"
    >
      <ul className="card flex flex-col p-1.5">
        {mine.map((post) => (
          <PostRow key={post.id} post={post} />
        ))}
      </ul>
    </Panel>
  );
}

function PostRow({ post }: { post: Post }) {
  return (
    <li>
      <Link
        href={`/admin/requests/${post.id}`}
        className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-hover"
      >
        <StatusIcon status={post.status} size={14} filled />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{post.title}</span>
        {post.assignee ? (
          <Avatar name={post.assignee.name} src={post.assignee.avatarUrl} size="xs" />
        ) : (
          <span className="shrink-0 text-[11px] text-faint">{timeAgo(post.createdAt)}</span>
        )}
      </Link>
    </li>
  );
}

function WantedRow({ post }: { post: Post }) {
  return (
    <li>
      <Link
        href={`/admin/requests/${post.id}`}
        className="flex items-center gap-3.5 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-hover"
      >
        <span className="flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-hover text-muted">
          <ArrowUp width={11} height={11} />
          <span className="text-[14px] leading-none font-semibold text-fg tabular-nums">
            {post.voteCount}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{post.title}</p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-faint">
            <StatusIcon status={post.status} size={11} />
            <span className="shrink-0">
              <StatusName status={post.status} />
            </span>
            <span>·</span>
            <span className="truncate">{post.boardName}</span>
            <span>·</span>
            <span className="shrink-0">{timeAgo(post.createdAt)}</span>
          </p>
        </div>
        {post.commentCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-faint tabular-nums">
            <Comment width={12} height={12} />
            {post.commentCount}
          </span>
        )}
      </Link>
    </li>
  );
}

function Ticket({ post }: { post: Post }) {
  const preview = excerpt(post.body, 110);

  return (
    <li>
      <Link
        href={`/admin/requests/${post.id}`}
        className="card lift flex h-full flex-col gap-3 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <StatusIcon status={post.status} size={12} />
            <StatusName status={post.status} />
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-hover px-2 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
            <ArrowUp width={11} height={11} />
            {post.voteCount}
          </span>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[14px] leading-5 font-semibold tracking-tight">
            {post.title}
          </p>
          {post.tags.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1">
              {post.tags.slice(0, 3).map((tag) => (
                <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
              ))}
            </div>
          )}
          {preview && (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted">{preview}</p>
          )}
        </div>
        <p className="mt-auto flex items-center gap-1.5 text-[11px] text-faint">
          <Avatar name={post.authorName} src={post.authorAvatar} size="xs" />
          <span className="truncate">{post.authorName}</span>
          <span>·</span>
          <span className="shrink-0">{timeAgo(post.createdAt)}</span>
        </p>
      </Link>
    </li>
  );
}

function Quiet({ title, body }: { title: string; body: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-8 text-center">
      <span className="text-accent/70">
        <Heart width={20} height={20} />
      </span>
      <p className="text-[13px] font-medium">{title}</p>
      <p className="max-w-[16rem] text-[12px] leading-5 text-muted">{body}</p>
    </div>
  );
}
