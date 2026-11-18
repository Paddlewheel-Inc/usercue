import { type TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";

export function AutoTextarea({
  value,
  className = "",
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "rows"> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={`block resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}
