import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth, useMe } from "../lib/queries";
import { useTheme } from "../lib/theme";
import { ArrowUpRight, Close, Menu } from "./icons";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./ui";

const LOGO = "/usercue.svg";
const REPO = "https://github.com/Paddlewheel-Inc/usercue";
const PADDLEWHEEL = "https://paddlewheel.org";
const DOCS = "https://docs.usercue.app";
const CHROME = "max-w-[1080px]";

function NavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const [location] = useLocation();
  const current =
    href === "/"
      ? !location.startsWith("/roadmap") && !location.startsWith("/changelog")
      : location === href || location.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] transition-colors ${className} ${
        current
          ? "bg-surface font-medium text-fg shadow-[var(--shadow)]"
          : "text-muted hover:bg-hover/70 hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

export function Logo({
  compact = false,
  wordmark = true,
  brand = false,
}: {
  compact?: boolean;
  wordmark?: boolean;
  brand?: boolean;
}) {
  const { data: me } = useMe();
  const [theme] = useTheme();
  const custom = theme === "dark" ? me?.logoDarkUrl || me?.logoUrl : me?.logoUrl || me?.logoDarkUrl;
  const src = brand ? LOGO : custom || LOGO;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight">
      <img
        src={src}
        alt={wordmark ? "" : "UserCue"}
        className={
          compact ? "h-5 w-auto max-w-28 object-contain" : "h-6 w-auto max-w-32 object-contain"
        }
      />
      {wordmark ? "UserCue" : null}
    </span>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) {
  const className =
    "inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-fg";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
        <ArrowUpRight className="size-3 opacity-60" />
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-faint uppercase">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function Footer() {
  const { data: me } = useMe();

  return (
    <footer className="mt-auto border-t border-line">
      <div
        className={`mx-auto grid grid-cols-2 gap-x-8 gap-y-10 px-5 py-14 min-[720px]:grid-cols-4 ${CHROME}`}
      >
        <div className="col-span-2 flex max-w-xs flex-col gap-3 min-[720px]:col-span-1">
          <Link href="/" className="w-fit">
            <Logo brand wordmark={false} />
          </Link>
          <p className="text-[13px] leading-5 text-muted">
            Suggestions, votes, and a public roadmap.
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-5 text-muted">
            a
            <a
              href={PADDLEWHEEL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex transition-opacity hover:opacity-70"
            >
              <img src="/paddlewheel.svg" alt="Paddlewheel" className="paddlewheel-mark" />
            </a>
            product
          </p>
          <p className="text-[12px] leading-5 text-faint">
            {new Date().getFullYear()} UserCue by{" "}
            <a
              href={PADDLEWHEEL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-fg"
            >
              Paddlewheel Inc.
            </a>
          </p>
        </div>
        <FooterCol title="Product">
          <li>
            <FooterLink href="/">Feedback</FooterLink>
          </li>
          <li>
            <FooterLink href="/roadmap">Roadmap</FooterLink>
          </li>
          {me?.changelogEnabled && (
            <li>
              <FooterLink href="/changelog">Changelog</FooterLink>
            </li>
          )}
        </FooterCol>
        <FooterCol title="Developers">
          <li>
            <FooterLink href={REPO} external>
              GitHub
            </FooterLink>
          </li>
          <li>
            <FooterLink href={DOCS} external>
              Documentation
            </FooterLink>
          </li>
        </FooterCol>
        <FooterCol title="Guides">
          <li>
            <FooterLink href={`${DOCS}/quickstart`} external>
              Quickstart
            </FooterLink>
          </li>
          <li>
            <FooterLink href={`${DOCS}/settings`} external>
              Settings
            </FooterLink>
          </li>
          <li>
            <FooterLink href={`${DOCS}/oauth`} external>
              OAuth
            </FooterLink>
          </li>
        </FooterCol>
      </div>
    </footer>
  );
}

function AccountMenu() {
  const { data: me } = useMe();
  const { logout } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = me?.user;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex size-8 items-center justify-center rounded-full transition-[box-shadow,transform] duration-200 ${
          open
            ? "scale-[1.04] shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--accent)]"
            : "hover:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--line)]"
        }`}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-1/2 z-30 mt-3.5 w-52 origin-top -translate-x-1/2 animate-rise overflow-hidden rounded-2xl bg-bg shadow-[0_0_0_1px_var(--line),var(--shadow)]"
        >
          <div className="relative px-3 pt-3 pb-2.5 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-[radial-gradient(90%_100%_at_50%_0%,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_72%)]"
            />
            <p className="relative truncate text-[12px] font-medium tracking-tight text-fg">
              {user.name}
            </p>
            <p className="relative truncate text-[10px] text-faint">{user.email}</p>
          </div>
          <div className="flex flex-col gap-1 px-2.5 pb-2.5">
            {user.staff && (
              <Link
                href="/admin"
                role="menuitem"
                className="inline-flex h-7 w-full items-center justify-center rounded-full bg-hover text-[12px] font-medium text-fg transition-colors hover:bg-line"
                onClick={() => setOpen(false)}
              >
                Workspace
              </Link>
            )}
            <Link
              href="/account"
              role="menuitem"
              className="inline-flex h-7 w-full items-center justify-center rounded-full bg-hover text-[12px] font-medium text-fg transition-colors hover:bg-line"
              onClick={() => setOpen(false)}
            >
              Account
            </Link>
            <button
              type="button"
              role="menuitem"
              className="inline-flex h-7 items-center justify-center rounded-full text-[11px] text-faint transition-colors hover:bg-hover hover:text-muted"
              onClick={() => {
                setOpen(false);
                logout.mutate(undefined, { onSuccess: () => navigate("/") });
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { data: me } = useMe();
  const oauthError = new URLSearchParams(useSearch()).get("error");
  const widthClass = wide ? CHROME : "max-w-[720px]";
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const showChangelog = Boolean(me?.changelogEnabled || me?.user?.staff);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-20 bg-bg/75 backdrop-blur-md">
        <div className={`mx-auto flex h-14 w-full items-center gap-3 px-5 sm:gap-6 ${CHROME}`}>
          <Link href="/">
            <Logo compact wordmark={false} />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink href="/">Feedback</NavLink>
            <NavLink href="/roadmap">Roadmap</NavLink>
            {showChangelog && <NavLink href="/changelog">Changelog</NavLink>}
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          {me?.user ? (
            <>
              <NotificationBell />
              <AccountMenu />
            </>
          ) : (
            <Link
              href="/signin"
              className="hidden h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg sm:inline-flex"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg sm:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <Close /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <nav className={`mx-auto flex w-full flex-col gap-1 px-5 pb-4 sm:hidden ${CHROME}`}>
            <NavLink href="/" className="h-9 text-[14px]">
              Feedback
            </NavLink>
            <NavLink href="/roadmap" className="h-9 text-[14px]">
              Roadmap
            </NavLink>
            {showChangelog && (
              <NavLink href="/changelog" className="h-9 text-[14px]">
                Changelog
              </NavLink>
            )}
            {!me?.user && (
              <NavLink href="/signin" className="h-9 text-[14px]">
                Sign in
              </NavLink>
            )}
          </nav>
        )}
      </header>
      {oauthError && (
        <p className={`mx-auto w-full px-5 pt-4 text-center text-xs text-rose-500 ${CHROME}`}>
          {oauthError}
        </p>
      )}
      <main className={`mx-auto w-full min-w-0 flex-1 px-5 pt-8 pb-16 ${widthClass}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
