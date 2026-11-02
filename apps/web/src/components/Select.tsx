import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "./icons";

export function Select<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [active, setActive] = useState(0);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const open = position !== null && !disabled;

  function close(restoreFocus = false) {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  }

  function show(index = selected) {
    if (disabled || !trigger.current || options.length === 0) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = Math.min(options.length * 32 + 8, 240);
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const upwards = below < height && above > below;
    const maxHeight = Math.max(32, Math.min(height, upwards ? above : below));
    const width = Math.min(rect.width, window.innerWidth - 16);
    setActive(index);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: upwards ? rect.top - maxHeight - 6 : rect.bottom + 6,
      width,
      maxHeight,
    });
  }

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setPosition(null);
    }
    function onScroll(event: Event) {
      if (!menu.current?.contains(event.target as Node)) setPosition(null);
    }
    const onResize = () => setPosition(null);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setPosition(null);
  }, [disabled]);

  useEffect(() => {
    if (open) menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[active]?.focus();
  }, [open, active]);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + direction + options.length) % options.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Tab") {
      close(true);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="input inline-flex items-center justify-between gap-2 text-left disabled:cursor-default disabled:opacity-50"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => (open ? close(true) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show();
          }
        }}
      >
        <span className="min-w-0 truncate">{options[selected]?.label}</span>
        <ChevronDown
          className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
          width={12}
          height={12}
        />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            onKeyDown={onKeyDown}
            className="menu fixed z-50 animate-rise overflow-y-auto p-1"
            style={position}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={option.value === value}
                className={`menu-item rounded-xl outline-none focus:bg-hover focus:text-fg ${active === index ? "bg-hover text-fg" : ""}`}
                onFocus={() => setActive(index)}
                onClick={() => {
                  onChange(option.value);
                  close(true);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === value && (
                  <Check width={12} height={12} className="shrink-0 text-accent-text" />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
