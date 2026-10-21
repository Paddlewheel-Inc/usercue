import { STATUS_LABELS, type Status, tagColorHex } from "@usercue/shared";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { ArrowUp, Check, Copy } from "./icons";

export const STATUS_DOT: Record<Status, string> = {
  open: "bg-stone-400",
  planned: "bg-sky-400",
  in_progress: "bg-violet-400",
  complete: "bg-emerald-400",
  closed: "bg-rose-400",
};

export const STATUS_INK: Record<Status, string> = {
  open: "text-stone-400",
  planned: "text-sky-500",
  in_progress: "text-violet-500",
  complete: "text-emerald-500",
  closed: "text-rose-400",
};

export function TagChip({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`chip min-w-0 max-w-full overflow-hidden ${size === "sm" ? "h-5 px-1.5 text-[10px]" : ""}`}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: tagColorHex(color) }} />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="chip text-muted">
      <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

interface VoteButtonProps {
  count: number;
  voted: boolean;
  onClick: () => void;
  compact?: boolean;
}

export function VoteButton({ count, voted, onClick, compact = false }: VoteButtonProps) {
  return (
    <button
      key={voted ? "on" : "off"}
      type="button"
      aria-pressed={voted}
      aria-label={voted ? "Remove vote" : "Upvote"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={
        compact
          ? `inline-flex shrink-0 items-center gap-0.5 text-[12px] font-medium tabular-nums transition-colors ${
              voted ? "text-accent" : "text-muted hover:text-accent"
            }`
          : `group/vote inline-flex w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[12px] leading-none font-semibold tabular-nums transition-[transform,background-color,color,box-shadow] duration-150 active:scale-95 ${
              voted
                ? "animate-pop bg-accent-soft text-accent"
                : "bg-surface text-muted shadow-[var(--shadow)] hover:text-accent"
            }`
      }
    >
      <ArrowUp
        width={compact ? 12 : 13}
        height={compact ? 12 : 13}
        strokeWidth={2.25}
        className={
          compact
            ? undefined
            : "transition-transform duration-200 group-hover/vote:-translate-y-0.5"
        }
      />
      {count}
    </button>
  );
}

const AVATAR_SIZES = {
  xs: "size-4 text-[8px]",
  sm: "size-5 text-[9px]",
  md: "size-6 text-[10px]",
  lg: "size-12 text-sm",
} as const;

function hueFor(name: string): number {
  return [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
}

export function Avatar({
  name,
  src,
  team = false,
  size = "md",
}: {
  name: string;
  src?: string | null;
  team?: boolean;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const className = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white ${AVATAR_SIZES[size]} ${
    team ? "ring-1 ring-accent ring-offset-1 ring-offset-surface" : ""
  }`;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        title={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <span title={name} style={{ background: `hsl(${hueFor(name)} 45% 48%)` }} className={className}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function RoleBadge({
  name,
  iconUrl,
  size = "md",
}: {
  name: string;
  iconUrl?: string | null;
  size?: "xs" | "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [iconUrl]);
  const chip = {
    xs: "h-3.5 gap-0.5",
    sm: "h-4 gap-1",
    md: "h-4 gap-1",
  }[size];
  const iconSize = {
    xs: "size-3.5",
    sm: "size-4",
    md: "size-4",
  }[size];

  return (
    <span className={`inline-flex min-w-0 items-center ${chip}`}>
      {iconUrl && !failed && (
        <img
          src={iconUrl}
          alt=""
          title={name}
          width={iconSize === "size-3.5" ? 14 : 16}
          height={iconSize === "size-3.5" ? 14 : 16}
          onError={() => setFailed(true)}
          className={`shrink-0 ${iconSize} object-cover`}
        />
      )}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-20 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      {children && <p className="max-w-xs text-muted">{children}</p>}
    </div>
  );
}

export function ErrorText({ error }: { error: Error | null }) {
  return error ? <p className="text-xs text-rose-500">{error.message}</p> : null;
}

type Toast = { id: number; message: string; tone: "success" | "error" };
type ToastInput = { message: string; tone?: Toast["tone"] };
const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((toast: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [
      ...current,
      { id, message: toast.message, tone: toast.tone ?? "success" },
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`rounded-2xl px-4 py-3 text-[13px] shadow-[var(--shadow)] ${
              toast.tone === "error" ? "bg-rose-500 text-white" : "bg-fg text-bg"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`relative flex items-start gap-2.5 text-[13px] select-none ${
        disabled ? "pointer-events-none opacity-40" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        className="peer absolute top-0 left-0 size-4.5 cursor-pointer opacity-0 outline-none"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`mt-px inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,transform] duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          checked
            ? "border-accent bg-accent text-white"
            : "border-line bg-surface text-transparent hover:border-muted"
        }`}
      >
        <Check width={10} height={10} strokeWidth={2.75} />
      </span>
      <span className="min-w-0 leading-5">{children}</span>
    </label>
  );
}

export function ShareButton({ url, label = "Share" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      await navigator.clipboard.writeText(url);
    } finally {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      className="chip text-muted hover:bg-hover hover:text-fg"
      aria-label={label}
      onClick={share}
    >
      {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="mb-1.5 px-1 text-[11px] text-muted">{label}</p>
      <div className="flex items-center gap-2 rounded-full bg-hover px-3.5 py-2">
        <code className="min-w-0 flex-1 truncate text-[12px]">{value}</code>
        <button
          type="button"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg"
          aria-label="Copy"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </button>
      </div>
    </div>
  );
}
