import { useEffect } from "react";

export const ANCHOR_EVENT = "usercue:anchor";

const COMMENT_HASH = /^#comment-\d+$/;

function reveal() {
  const { hash } = window.location;
  if (!COMMENT_HASH.test(hash)) return;
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.remove("flash");
  void target.offsetWidth;
  target.classList.add("flash");
  window.setTimeout(() => target.classList.remove("flash"), 2600);
}

export function useCommentAnchor(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const frame = window.requestAnimationFrame(reveal);
    window.addEventListener(ANCHOR_EVENT, reveal);
    window.addEventListener("hashchange", reveal);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(ANCHOR_EVENT, reveal);
      window.removeEventListener("hashchange", reveal);
    };
  }, [ready]);
}
