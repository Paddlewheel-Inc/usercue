import { STATUS_LABELS, STATUSES, type Status } from "@usercue/shared";
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
import { ThemeToggle } from "../components/ThemeToggle";
import { Avatar, Empty, RoleBadge, STATUS_INK } from "../components/ui";
import {
  can,
  useAuth,
  useBoards,
  useCounts,
  useCreateBoard,
  useDeleteBoard,
  useMe,
  usePosts,
  useRenameBoard,
} from "../lib/queries";

interface Filter {
  status?: Status;
  board?: string;
}

function parseFilter(search: string): Filter {
  const params = new URLSearchParams(search);
  const status = params.get("status");
  return {
    status: STATUSES.find((s) => s === status),
    board: params.get("board") ?? undefined,
  };
}

function href({ status, board }: Filter, id?: number) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (board) params.set("board", board);
  const query = params.toString();
  return `/admin/requests${id ? `/${id}` : ""}${query ? `?${query}` : ""}`;
}

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
      className={`flex h-8 shrink-0 items-center gap-2.5 rounded-full px-2.5 text-[13px] transition-colors ${className} ${
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
  const { data: counts } = useCounts(filter.board);
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  const allActive = !dashboard && !settings && !filter.status;

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
      } fixed inset-y-0 left-0 z-50 w-[16.5rem] shrink-0 flex-col p-3 transition-transform md:static md:z-auto md:translate-x-0`}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[1.75rem] bg-surface px-3 pt-5 pb-3 shadow-[var(--shadow)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-[1.75rem] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_72%)]"
        />

        <Link href="/" aria-label="Usercue" className="relative mb-5 flex justify-center pt-1">
          <span className="scale-125">
            <Logo wordmark={false} />
          </span>
        </Link>

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
          {STATUSES.map((status) => {
            const n = counts?.[status] ?? 0;
            const on = !dashboard && !settings && filter.status === status;
            return (
              <SidebarLink
                key={status}
                to={href({ board: filter.board, status })}
                active={on}
                count={n}
              >
                <span className={STATUS_INK[status]}>
                  <Heart
                    width={13}
                    height={13}
                    fill={n > 0 ? "currentColor" : "none"}
                    stroke={n > 0 ? "none" : "currentColor"}
                  />
                </span>
                {STATUS_LABELS[status]}
              </SidebarLink>
            );
          })}
        </Section>

        <BoardsNav filter={filter} boards={boards} muted={dashboard || settings} />

        <Section title="The shop">
          <SidebarLink to="/roadmap" active={false}>
            <Roadmap className="text-faint" /> Roadmap
          </SidebarLink>
          {(can(me, "manage_settings") ||
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

        <div className="relative mt-auto flex flex-col gap-1 pt-3">
          <ThemeToggle labeled />
          <div className="flex items-center gap-2 rounded-full px-2 py-1.5">
            <Avatar name={me?.user?.name ?? "?"} src={me?.user?.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
              {me?.user?.name}
            </span>
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
      </div>
    </aside>
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
          className="flex h-8 w-full items-center gap-2.5 rounded-full px-2.5 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg"
          onClick={() => setAdding(true)}
        >
          <Plus className="text-faint" /> New board
        </button>
      ) : null}
    </Section>
  );
}

function RequestList({ filter, selected }: { filter: Filter; selected?: number }) {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const { data: posts, isLoading } = usePosts({
    ...filter,
    sort: "new",
    q: q || undefined,
  });
  const { data: counts } = useCounts(filter.board);
  const shown = filter.status
    ? counts?.[filter.status]
    : counts
      ? Object.values(counts).reduce((a, b) => a + b, 0)
      : undefined;

  return (
    <section
      className={`w-full min-w-0 shrink-0 flex-col md:flex md:w-96 ${selected ? "hidden" : "flex"}`}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-5">
        <h2 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight">
          {filter.status ? STATUS_LABELS[filter.status] : "Requests"}
          {shown !== undefined && (
            <span className="text-[13px] font-medium text-faint tabular-nums">{shown}</span>
          )}
        </h2>
      </header>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            className="input pl-8"
            placeholder="Search requests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
