import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "./icons";

const FULL = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
const MONTH = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PANEL_WIDTH = 272;
const PANEL_HEIGHT = 330;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parse = (value: string) => new Date(`${value}T00:00:00`);

export function formatDate(value: string): string {
  return FULL.format(parse(value));
}

export function DatePicker({
  label,
  value,
  onChange,
  quiet = false,
  placeholder = "No date",
  tone = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  quiet?: boolean;
  placeholder?: string;
  tone?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null);
  const [view, setView] = useState(() => (value ? parse(value) : new Date()));
  const open = spot !== null;
  const today = iso(new Date());

  function show() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const upwards = below < PANEL_HEIGHT + 16 && rect.top > below;
    setView(value ? parse(value) : new Date());
    setSpot({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)),
      top: upwards ? Math.max(8, rect.top - PANEL_HEIGHT - 6) : rect.bottom + 6,
    });
  }

  function close(restoreFocus = false) {
    setSpot(null);
    if (restoreFocus) trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) setSpot(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setSpot(null);
        trigger.current?.focus();
      }
    }
    const dismiss = () => setSpot(null);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const cells = Array.from(
    { length: 42 },
    (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + index),
  );

  const shift = (months: number) =>
    setView((current) => new Date(current.getFullYear(), current.getMonth() + months, 1));

  function pick(next: string) {
    onChange(next);
    close(true);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(true) : show())}
        className={`${
          quiet
            ? "inline-flex h-8 w-full items-center gap-2 rounded-xl px-2 text-left text-[13px] transition-colors hover:bg-hover"
            : "input inline-flex items-center gap-2 text-left"
        } ${value ? tone : "text-faint"}`}
      >
        <Calendar className="shrink-0 opacity-70" />
        <span className="min-w-0 truncate">{value ? formatDate(value) : placeholder}</span>
      </button>
      {open &&
        spot &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            style={{ left: spot.left, top: spot.top, width: PANEL_WIDTH }}
            className="menu fixed z-50 animate-rise p-3"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="pl-1 text-[13px] font-semibold tracking-tight">
                {MONTH.format(view)}
              </span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  aria-label="Previous month"
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg"
                  onClick={() => shift(-1)}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg"
                  onClick={() => shift(1)}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 pb-1">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  title={day}
                  className="grid h-7 place-items-center text-[11px] font-medium text-faint"
                >
                  {day.charAt(0)}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((date) => {
                const key = iso(date);
                const selected = key === value;
                const outside = date.getMonth() !== view.getMonth();
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={FULL.format(date)}
                    aria-pressed={selected}
                    onClick={() => pick(key)}
                    className={`mx-auto grid size-8 place-items-center rounded-full text-[12px] tabular-nums transition-colors ${
                      selected
                        ? "bg-accent font-semibold text-white"
                        : key === today
                          ? "font-semibold text-accent-text ring-1 ring-accent/50 hover:bg-hover"
                          : outside
                            ? "text-faint/60 hover:bg-hover"
                            : "text-fg hover:bg-hover"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-[12px] font-medium text-accent-text transition-colors hover:bg-hover"
                onClick={() => pick(today)}
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  className="rounded-full px-2.5 py-1 text-[12px] text-muted transition-colors hover:bg-hover hover:text-fg"
                  onClick={() => pick("")}
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
