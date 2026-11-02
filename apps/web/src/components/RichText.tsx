import { sanitizeHtml } from "@usercue/shared";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { excerpt, postIdFromHref, timeAgo } from "../lib/format";
import { usePost } from "../lib/queries";
import { Avatar } from "./ui";
import { StatusIcon } from "./WorkflowIcon";

function useSuggestionPreview() {
  const [preview, setPreview] = useState<{ id: number; x: number; y: number } | null>(null);
  const leave = useRef<number>(0);
  const enter = useRef<number>(0);

  useEffect(
    () => () => {
      window.clearTimeout(leave.current);
      window.clearTimeout(enter.current);
    },
    [],
  );

  function hide() {
    window.clearTimeout(enter.current);
    leave.current = window.setTimeout(() => setPreview(null), 80);
  }

  function show(id: number, node: Element) {
    window.clearTimeout(leave.current);
    const rect = node.getBoundingClientRect();
    enter.current = window.setTimeout(() => {
      const width = 288;
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      const below = rect.bottom + 8;
      const y = below + 148 > window.innerHeight ? rect.top - 156 : below;
      setPreview({ id, x: Math.max(12, left), y: Math.max(12, y) });
    }, 220);
  }

  function hold() {
    window.clearTimeout(leave.current);
  }

  return { preview, show, hide, hold };
}

export function RichText({ html }: { html: string }) {
  const safe = sanitizeHtml(html);
  const [, navigate] = useLocation();
  const { preview, show, hide, hold } = useSuggestionPreview();

  if (!safe) return null;

  function onOver(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[contenteditable]")) return;
    const link = target.closest("a");
    if (!link) return;
    const id = postIdFromHref(link.getAttribute("href") ?? "");
    if (!id) return;
    show(id, link);
  }

  function onClick(e: MouseEvent) {
    const link = (e.target as HTMLElement).closest("a");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = link.getAttribute("href") ?? "";
    const id = postIdFromHref(href);
    if (!id) return;
    e.preventDefault();
    navigate(`/post/${id}`);
  }

  return (
    <>
      <div
        className="rich"
        dangerouslySetInnerHTML={{ __html: safe }}
        onMouseOver={onOver}
        onMouseOut={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && e.currentTarget.contains(next)) return;
          hide();
        }}
        onClick={onClick}
      />
      {preview &&
        createPortal(
          <SuggestionPreview
            id={preview.id}
            x={preview.x}
            y={preview.y}
            onEnter={hold}
            onLeave={hide}
          />,
          document.body,
        )}
    </>
  );
}

export function PostLink({
  id,
  title,
  className,
}: {
  id: number;
  title: string;
  className?: string;
}) {
  const [, navigate] = useLocation();
  const { preview, show, hide, hold } = useSuggestionPreview();

  return (
    <>
      <a
        href={`/post/${id}`}
        className={
          className ??
          "inline-flex max-w-full truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-[13px] text-accent-text"
        }
        onMouseEnter={(e) => show(id, e.currentTarget)}
        onMouseLeave={hide}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          e.stopPropagation();
          navigate(`/post/${id}`);
        }}
      >
        {title}
      </a>
      {preview &&
        createPortal(
          <SuggestionPreview
            id={preview.id}
            x={preview.x}
            y={preview.y}
            onEnter={hold}
            onLeave={hide}
          />,
          document.body,
        )}
    </>
  );
}

function SuggestionPreview({
  id,
  x,
  y,
  onEnter,
  onLeave,
}: {
  id: number;
  x: number;
  y: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { data: post, isLoading } = usePost(id);
  const summary = post ? previewCopy(post) : "";

  return (
    <div
      className="card pointer-events-auto fixed z-50 w-72 p-3"
      style={{ top: y, left: x }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {isLoading || !post ? (
        <p className="text-[12px] text-faint">Loading suggestion…</p>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[13px] leading-5 font-medium">{post.title}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted tabular-nums">
              <StatusIcon status={post.status} size={12} />
              {post.voteCount}
            </span>
          </div>
          {summary && (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-4 text-muted">{summary}</p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
            <Avatar name={post.authorName} src={post.authorAvatar} size="xs" />
            <span className="truncate">{post.authorName}</span>
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
          </p>
        </>
      )}
    </div>
  );
}

function previewCopy(post: { body: string }) {
  return excerpt(post.body, 110);
}
