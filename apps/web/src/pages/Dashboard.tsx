import { type Status } from "@usercue/shared";
import { Fragment } from "react";
import { Link } from "wouter";
import { ArrowUp, Heart } from "../components/icons";
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
  const { data: doing } = usePosts({ category: "in_progress", sort: "new" });
  const canSeeUsers = can(me, "manage_users");
  const { data: people } = useWorkspaceUsers(canSeeUsers);

  const first = me?.user?.name.split(/\s+/)[0] ?? "there";
  const { statuses } = useWorkflow();
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
  const newest = (people?.users ?? []).slice(0, 5);
  const latest = (recent ?? []).slice(0, 7);
  const active = (doing ?? []).slice(0, 5);

  return (
    <section className="relative min-w-0 flex-1 overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_68%)]"
      />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pt-10 pb-14 md:px-10">
        <header>
          <p className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">
            {today.format(new Date())}
          </p>
          <h1 className="mt-2 text-[28px] leading-8 font-semibold tracking-tight">Hey, {first}.</h1>
          <p className="mt-2 max-w-md text-[14px] leading-6 text-muted">
            {headline(total, stages)}
          </p>
        </header>

        <HeartLane counts={tally} />

        <div
          className={`grid items-stretch gap-5 ${canSeeUsers ? "lg:grid-cols-[1.15fr_0.85fr]" : ""}`}
        >
          <Stage posts={active} />
          {canSeeUsers && <NewFaces people={newest} />}
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Fresh on the board</h2>
              <p className="mt-0.5 text-[12px] text-muted">Newest notes, stamps and all.</p>
            </div>
            <Link
              href="/admin/requests"
              className="text-[12px] font-medium text-accent-text transition-colors hover:text-accent"
            >
              Open the pile →
            </Link>
          </div>
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
        </section>
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

function HeartLane({ counts }: { counts: Record<Status, number> }) {
  const { statuses } = useWorkflow();
  return (
    <div className="card flex items-start overflow-x-auto px-3 py-4 sm:px-5">
      {statuses.map((item, i) => {
        const status = item.id;
        const n = counts[status] ?? 0;
        const live = item.category === "in_progress" && n > 0;
        return (
          <Fragment key={status}>
            {i > 0 && (
              <span
                aria-hidden
                className="-mx-6 mt-2.5 hidden h-px min-w-3 flex-1 bg-[repeating-linear-gradient(90deg,currentColor_0_4px,transparent_4px_8px)] text-faint/50 sm:block"
              />
            )}
            <Link
              href={`/admin/requests?status=${status}`}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1 py-0.5 text-center sm:w-[4.5rem] sm:flex-none"
            >
              <span className={live ? "animate-stop" : ""}>
                <StatusIcon status={status} size={16} filled={n > 0} />
              </span>
              <span className="text-[18px] leading-none font-semibold tabular-nums">{n}</span>
              <span className="max-w-full truncate text-[11px] text-muted">
                <StatusName status={status} />
              </span>
            </Link>
          </Fragment>
        );
      })}
    </div>
  );
}

function Stage({ posts }: { posts: Post[] }) {
  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex min-h-14 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">On stage</h2>
          <Link
            href="/admin/requests?status=in_progress"
            className="shrink-0 text-[12px] font-medium whitespace-nowrap text-accent-text hover:text-accent"
          >
            See the lot →
          </Link>
        </div>
        <p className="text-[12px] text-muted">Whatever you’re actually building.</p>
      </div>
      <div className="card flex min-h-44 flex-1 flex-col p-2">
        {posts.length === 0 ? (
          <Quiet
            title="Quiet on the floor."
            body="Grab something Open, give it a heart, and it’ll show up here."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/admin/requests/${post.id}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-hover"
                >
                  <span className="text-violet-500">
                    <Heart width={14} height={14} fill="currentColor" stroke="none" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {post.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-faint">{timeAgo(post.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NewFaces({
  people,
}: {
  people: {
    id: number;
    name: string;
    avatarUrl: string | null;
    roleName: string | null;
    createdAt: number;
  }[];
}) {
  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex min-h-14 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">New faces</h2>
          <Link
            href="/admin/settings/users"
            className="shrink-0 text-[12px] font-medium whitespace-nowrap text-accent-text hover:text-accent"
          >
            Everyone →
          </Link>
        </div>
        <p className="text-[12px] text-muted">Folks who just pulled up a chair.</p>
      </div>
      <div className="card flex min-h-44 flex-1 flex-col p-2">
        {people.length === 0 ? (
          <Quiet title="Empty house." body="The next person who signs in shows up right here." />
        ) : (
          <ul className="flex flex-col gap-1">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href="/admin/settings/users"
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-hover"
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
      </div>
    </section>
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
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="text-accent/70">
        <Heart width={22} height={22} />
      </span>
      <p className="text-[13px] font-medium">{title}</p>
      <p className="max-w-[16rem] text-[12px] leading-5 text-muted">{body}</p>
    </div>
  );
}
