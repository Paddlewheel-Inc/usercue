import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { ANCHOR_EVENT } from "../lib/anchor";
import { timeAgo } from "../lib/format";
import { useNotifications, useReadNotifications } from "../lib/queries";
import { Bell } from "./icons";
import { Avatar } from "./ui";

interface Spot {
  left: number;
  top?: number;
  bottom?: number;
}

const PANEL_WIDTH = 336;

function isLocalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function NotificationBell({ placement = "down" }: { placement?: "down" | "up" }) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { data } = useNotifications(true);
  const read = useReadNotifications();
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
    if (placement === "up") {
      setSpot({ left: 12, bottom: window.innerHeight - rect.top + 8 });
    } else {
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      setSpot({ left, top: rect.bottom + 12 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (panel.current?.contains(target) || button.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function visit(item: (typeof items)[number]) {
    setOpen(false);
    if (!item.read) read.mutate(item.id);
    if (!isLocalPath(item.path)) return;
    navigate(item.path);
    window.setTimeout(() => window.dispatchEvent(new Event(ANCHOR_EVENT)), 80);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        className={`relative inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
          open ? "bg-hover text-fg" : "text-muted hover:bg-hover hover:text-fg"
        }`}
      >
        <Bell width={16} height={16} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] leading-4 font-semibold text-white tabular-nums shadow-[0_0_0_2px_var(--bg)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open &&
        spot &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Notifications"
            style={{
              left: spot.left,
              top: spot.top,
              bottom: spot.bottom,
              width: Math.min(PANEL_WIDTH, window.innerWidth - 24),
            }}
            className="fixed z-50 animate-rise overflow-hidden rounded-2xl bg-bg shadow-[0_0_0_1px_var(--line),var(--shadow-lg)]"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-[13px] font-semibold tracking-tight">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  disabled={read.isPending}
                  className="rounded-full px-2 py-0.5 text-[12px] font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
                  onClick={() => read.mutate(undefined)}
                >
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 pt-3 pb-6 text-center text-[13px] text-muted">
                Nothing yet. You'll see pings here.
              </p>
            ) : (
              <ul className="flex max-h-[min(26rem,60dvh)] flex-col gap-0.5 overflow-y-auto px-1.5 pb-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => visit(item)}
                      className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-hover"
                    >
                      <Avatar name={item.actorName} src={item.actorAvatar} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-5">
                          <span className="font-medium">{item.actorName}</span>
                          <span className="text-muted">
                            {item.kind === "role" && item.roleName
                              ? " pinged "
                              : " mentioned you in "}
                          </span>
                          {item.kind === "role" && item.roleName && (
                            <>
                              <span className="rounded-md bg-accent-soft px-1 font-medium text-accent-text">
                                @{item.roleName}
                              </span>
                              <span className="text-muted"> in </span>
                            </>
                          )}
                          <span className="font-medium">{item.title}</span>
                        </span>
                        {item.excerpt && (
                          <span className="mt-0.5 line-clamp-2 block text-[12px] leading-4 text-muted">
                            {item.excerpt}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-faint">
                          {timeAgo(item.createdAt)}
                        </span>
                      </span>
                      {!item.read && (
                        <span
                          role="img"
                          aria-label="Unread"
                          className="mt-2 size-2 shrink-0 rounded-full bg-accent"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
