import {
  type FormEvent,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import {
  Gear,
  Heart,
  Inbox,
  LogOut,
  Menu,
  Pen,
  Plus,
  Roadmap,
  Search,
  Trash,
} from "../components/icons";
import { NotificationBell } from "../components/NotificationBell";
import { PostDetail } from "../components/PostDetail";
import { PostRow } from "../components/PostRow";
import { Logo } from "../components/PublicLayout";
import { RequestFilters } from "../components/RequestFilters";
import { ThemeToggle } from "../components/ThemeToggle";
import { Avatar, Empty, RoleBadge } from "../components/ui";
import { StatusIcon, StatusName } from "../components/WorkflowIcon";
import { type Filter, filterHref, filterQuery, isNarrowed, parseFilter } from "../lib/adminFilter";
import {
  can,
  useAuth,
  useBoards,
  useCounts,
  useCreateBoard,
  useDeleteBoard,
  useDeleteView,
  useMe,
  usePosts,
  useRenameBoard,
  useSavedViews,
} from "../lib/queries";
import { useWorkflow } from "../lib/workflow";

const href = filterHref;

function hueFor(name: string): number {
  return [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
}

function SidebarLink({
  to,
  active,
  children,
  count,
  className = "",
}: {
  to: string;
  active: boolean;
  children: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <Link
      href={to}
      className={`flex h-8 shrink-0 items-center gap-2.5 rounded-xl px-2.5 text-[13px] transition-colors ${className} ${
        active
          ? "bg-accent-soft font-medium text-accent-text"
          : "text-muted hover:bg-hover hover:text-fg"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{children}</span>
      {count !== undefined && (
        <span
          className={`w-7 shrink-0 text-right text-[11px] tabular-nums ${
            active ? "text-accent-text/70" : "text-faint"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="flex flex-col gap-0.5">
      <p className="px-2.5 pt-4 pb-1.5 text-[11px] font-medium text-faint">{title}</p>
      {children}
    </nav>
  );
}

function Sidebar({
  filter,
  settings = false,
  dashboard = false,
  open = false,
  onClose,
}: {
  filter: Filter;
  settings?: boolean;
  dashboard?: boolean;
  open?: boolean;
  onClose?: () => void;
}) {
  const { data: me } = useMe();
  const { data: boards = [] } = useBoards();
  const { statuses } = useWorkflow();
  const { data: counts } = useCounts(filter.board);
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  const { data: views = [] } = useSavedViews();
  const activeQuery = filterQuery(filter);
  const activeView = views.find((view) => view.query === activeQuery);
  const allActive = !dashboard && !settings && !filter.status && !activeView && !activeQuery;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) onClose?.();
      }}
      className={`${
        open ? "flex translate-x-0" : "hidden md:flex"
      } fixed inset-y-0 left-0 z-50 w-64 shrink-0 flex-col bg-surface shadow-[var(--shadow-lg)] transition-transform md:static md:z-auto md:translate-x-0 md:shadow-none`}
    >
      <Link href="/" aria-label="Usercue" className="flex h-14 shrink-0 items-center px-5">
        <Logo wordmark={false} />
      </Link>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3 pb-3">
        <SidebarLink to="/admin" active={dashboard}>
          <Heart
            className={dashboard ? "text-accent" : "text-faint"}
            fill={dashboard ? "currentColor" : "none"}
            stroke={dashboard ? "none" : "currentColor"}
          />
          Overview
        </SidebarLink>

        <Section title="The pile">
          <SidebarLink to={href({ board: filter.board })} active={allActive} count={total}>
            <Inbox className={allActive ? "text-accent" : "text-faint"} /> All
          </SidebarLink>
          {statuses.map((item) => {
            const status = item.id;
            const n = counts?.[status] ?? 0;
            const on = !dashboard && !settings && filter.status === status;
            return (
              <SidebarLink
                key={status}
                to={href({ board: filter.board, status })}
                active={on}
                count={n}
              >
                <StatusIcon status={status} filled={n > 0} />
                {item.name}
              </SidebarLink>
            );
          })}
        </Section>

        <ViewsNav views={views} activeId={dashboard || settings ? undefined : activeView?.id} />

        <BoardsNav filter={filter} boards={boards} muted={dashboard || settings} />

        <Section title="The shop">
          <SidebarLink to="/roadmap" active={false}>
            <Roadmap className="text-faint" /> Roadmap
          </SidebarLink>
          {(can(me, "dashboard") ||
            can(me, "manage_settings") ||
            can(me, "manage_branding") ||
            can(me, "manage_posts") ||
            can(me, "manage_staff") ||
            can(me, "manage_users") ||
            can(me, "manage_roles")) && (
            <SidebarLink to="/admin/settings" active={settings}>
              <Gear className={settings ? "text-accent" : "text-faint"} /> Settings
            </SidebarLink>
          )}
        </Section>
      </div>

      <div className="flex shrink-0 flex-col gap-1 p-3">
        <ThemeToggle
          labeled
          className="flex h-8 w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg"
        />
        <div className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <Avatar name={me?.user?.name ?? "?"} src={me?.user?.avatarUrl} size="sm" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{me?.user?.name}</span>
          {me?.user?.staff && me.user.roleName && (
            <RoleBadge name={me.user.roleName} iconUrl={me.user.roleIcon} size="xs" />
          )}
          <NotificationBell placement="up" />
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-full text-faint transition-colors hover:bg-hover hover:text-fg"
            aria-label="Sign out"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/") })}
          >
            <LogOut />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ViewsNav({
  views,
  activeId,
}: {
  views: { id: number; name: string; query: string }[];
  activeId?: number;
}) {
  const remove = useDeleteView();
  if (views.length === 0) return null;

  return (
    <Section title="Views">
      {views.map((view) => (
        <div key={view.id} className="group relative">
          <SidebarLink
            to={`/admin/requests?${view.query}`}
            active={view.id === activeId}
            className="pr-8"
          >
            <span className="truncate">{view.name}</span>
          </SidebarLink>
          <button
            type="button"
            aria-label={`Delete ${view.name}`}
            disabled={remove.isPending}
            className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600 focus-visible:opacity-100"
            onClick={() => {
              if (confirm(`Delete the ${view.name} view?`)) remove.mutate(view.id);
            }}
          >
            <Trash width={12} height={12} />
          </button>
        </div>
      ))}
    </Section>
  );
}

function BoardRow({
  board,
  active,
  href,
  canRename,
}: {
  board: { slug: string; name: string };
  active: boolean;
  href: string;
  canRename: boolean;
}) {
  const rename = useRenameBoard();
  const remove = useDeleteBoard();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(board.name);
  const done = useRef(false);

  function save() {
    if (done.current) return;
    done.current = true;
    const next = value.trim();
    setEditing(false);
    if (!next || next === board.name) {
      setValue(board.name);
      return;
    }
    rename.mutate({ slug: board.slug, name: next }, { onError: () => setValue(board.name) });
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          className="input h-8"
          value={value}
          maxLength={40}
          autoFocus
          aria-label={`Rename ${board.name}`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              done.current = true;
              setValue(board.name);
              setEditing(false);
            }
          }}
        />
      </form>
    );
  }

  return (
    <div className="group relative">
      <SidebarLink to={href} active={active} className={canRename ? "pr-8" : ""}>
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: `hsl(${hueFor(board.name)} 45% 52%)` }}
        />
        <span className="truncate">{board.name}</span>
      </SidebarLink>
      {canRename && (
        <div
          className={`absolute top-1/2 right-1.5 flex -translate-y-1/2 rounded-full transition-opacity focus-within:opacity-100 ${
            active ? "text-accent-text/70" : "text-faint opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            type="button"
            aria-label={`Rename ${board.name}`}
            className="inline-flex size-6 items-center justify-center rounded-full hover:bg-hover hover:text-fg"
            onClick={() => {
              done.current = false;
              setValue(board.name);
              setEditing(true);
            }}
          >
            <Pen width={12} height={12} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${board.name}`}
            className="inline-flex size-6 items-center justify-center rounded-full hover:bg-rose-500/10 hover:text-rose-600"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Delete the ${board.name} board and all its requests?`))
                remove.mutate(board.slug);
            }}
          >
            <Trash width={12} height={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function BoardsNav({
  filter,
  boards,
  muted = false,
}: {
  filter: Filter;
  boards: { slug: string; name: string }[];
  muted?: boolean;
}) {
  const { data: me } = useMe();
  const create = useCreateBoard();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const allowCreate = can(me, "manage_boards");

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(name, {
      onSuccess: () => {
        setName("");
        setAdding(false);
      },
    });
  }

  return (
    <Section title="Boards">
      {boards.map((b) => (
        <BoardRow
          key={b.slug}
          board={b}
          active={!muted && filter.board === b.slug}
          href={href({ status: filter.status, board: b.slug })}
          canRename={allowCreate}
        />
      ))}
      {allowCreate && adding ? (
        <form onSubmit={submit} className="px-1 pt-1">
          <input
            className="input h-8"
            placeholder="Board name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            required
            onBlur={() => {
              if (!name.trim()) setAdding(false);
            }}
          />
        </form>
      ) : allowCreate ? (
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg"
          onClick={() => setAdding(true)}
        >
          <Plus className="text-faint" /> New board
        </button>
      ) : null}
    </Section>
  );
}

function RequestList({ filter, selected }: { filter: Filter; selected?: number }) {
  const [, navigate] = useLocation();
  const q = useDeferredValue(filter.q?.trim() ?? "");
  const { data: posts, isLoading } = usePosts({
    ...filter,
    sort: filter.sort ?? "new",
    q: q || undefined,
  });
  const { data: counts } = useCounts(filter.board);
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  const shown = isNarrowed(filter)
    ? posts?.length
    : filter.status
      ? counts?.[filter.status]
      : total;

  function change(patch: Partial<Filter>) {
    navigate(href({ ...filter, ...patch }, selected), { replace: true });
  }

  return (
    <section
      className={`w-full min-w-0 shrink-0 flex-col md:flex md:w-96 ${selected ? "hidden" : "flex"}`}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-5">
        <h2 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight">
          {filter.status ? <StatusName status={filter.status} /> : "Requests"}
          {shown !== undefined && (
            <span className="text-[13px] font-medium text-faint tabular-nums">{shown}</span>
          )}
        </h2>
      </header>
      <div className="flex flex-col gap-2 px-4 pb-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            className="input pl-8"
            placeholder="Search requests…"
            value={filter.q ?? ""}
            onChange={(e) => change({ q: e.target.value || undefined })}
          />
        </div>
        <RequestFilters filter={filter} onChange={change} />
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {posts?.map((post, i) => (
          <PostRow
            key={post.id}
            post={post}
            href={href(filter, post.id)}
            active={post.id === selected}
            compact
            index={i}
          />
        ))}
        {!isLoading && posts?.length === 0 && <Empty title="No requests" />}
      </div>
    </section>
  );
}

export function AdminShell({
  children,
  settings = false,
  dashboard = false,
}: {
  children: ReactNode;
  settings?: boolean;
  dashboard?: boolean;
}) {
  const filter = parseFilter(useSearch());
  const [location] = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 md:hidden">
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg"
          aria-label="Open navigation"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          <Menu />
        </button>
        <Link href="/" className="flex items-center">
          <Logo compact wordmark={false} />
        </Link>
      </header>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {navOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}
        <Sidebar
          filter={filter}
          settings={settings}
          dashboard={dashboard}
          open={navOpen}
          onClose={() => setNavOpen(false)}
        />
        {children}
      </div>
    </div>
  );
}

export function Admin() {
  const params = useParams<{ id?: string }>();
  const filter = parseFilter(useSearch());
  const [, navigate] = useLocation();
  const selected = params.id ? Number(params.id) : undefined;

  return (
    <AdminShell>
      <RequestList filter={filter} selected={selected} />
      <section
        className={`min-w-0 flex-1 overflow-y-auto ${selected ? "block" : "hidden md:block"}`}
      >
        {selected ? (
          <div className="mx-auto max-w-3xl px-5 py-7 sm:px-8 sm:py-10">
            <Link
              href={href(filter)}
              className="mb-4 inline-block text-muted hover:text-fg md:hidden"
            >
              ← Back
            </Link>
            <PostDetail key={selected} id={selected} onDeleted={() => navigate(href(filter))} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Empty title="Select a request">
              Pick something from the list to triage, reply, or ship it.
            </Empty>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
