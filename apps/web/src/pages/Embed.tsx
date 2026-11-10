import { useEffect, useRef } from "react";
import { Redirect } from "wouter";
import { Changelog } from "./Changelog";
import { Feedback } from "./Feedback";
import { Roadmap } from "./Roadmap";

const PAGES = { feedback: Feedback, roadmap: Roadmap, changelog: Changelog };

const isPage = (kind: string): kind is keyof typeof PAGES => Object.hasOwn(PAGES, kind);

function openInNewTab(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("button")) return;
  const anchor = target.closest("a");
  if (!anchor?.href) return;
  event.preventDefault();
  event.stopPropagation();
  window.open(anchor.href, "_blank", "noopener,noreferrer");
}

function useReportHeight() {
  useEffect(() => {
    if (window.parent === window) return;
    const report = () =>
      window.parent.postMessage(
        { type: "usercue:height", height: document.body.scrollHeight },
        "*",
      );
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    report();
    return () => observer.disconnect();
  }, []);
}

function useExternalLinks() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    element?.addEventListener("click", openInNewTab, true);
    return () => element?.removeEventListener("click", openInNewTab, true);
  }, []);
  return root;
}

export function Embed({ kind }: { kind: string }) {
  const root = useExternalLinks();
  useReportHeight();
  if (!isPage(kind)) return <Redirect to="/" />;
  const Page = PAGES[kind];

  return (
    <div ref={root} className="mx-auto w-full max-w-3xl bg-bg px-4 py-4">
      <Page />
    </div>
  );
}
