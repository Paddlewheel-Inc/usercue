import { useDeferredValue, useState } from "react";
import { useMergePost, usePosts } from "../lib/queries";
import { ErrorText } from "./ui";
import { StatusIcon } from "./WorkflowIcon";

export function MergePanel({
  postId,
  onClose,
  onMerged,
}: {
  postId: number;
  onClose: () => void;
  onMerged: (targetId: number) => void;
}) {
  const [text, setText] = useState("");
  const q = useDeferredValue(text.trim());
  const { data: posts = [] } = usePosts({ q: q || undefined, sort: "top" });
  const merge = useMergePost(postId);
  const candidates = posts.filter((post) => post.id !== postId).slice(0, 8);

  return (
    <div className="card flex animate-rise flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[13px] font-medium">Merge into another post</p>
        <button type="button" className="btn-quiet h-7 px-2.5" onClick={onClose}>
          Cancel
        </button>
      </div>
      <p className="text-[12px] text-muted">
        Votes and comments move to the post you pick. This post then redirects to it.
      </p>
      <input
        className="input"
        placeholder="Search for the post to keep…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <ul className="flex flex-col gap-0.5">
        {candidates.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              disabled={merge.isPending}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-hover"
              onClick={() => {
                if (confirm(`Merge into “${post.title}”?`)) {
                  merge.mutate(post.id, { onSuccess: ({ targetId }) => onMerged(targetId) });
                }
              }}
            >
              <StatusIcon status={post.status} />
              <span className="min-w-0 flex-1 truncate">{post.title}</span>
              <span className="text-[12px] text-faint tabular-nums">{post.voteCount}</span>
            </button>
          </li>
        ))}
        {candidates.length === 0 && (
          <li className="px-2.5 py-1.5 text-[12px] text-faint">No posts found.</li>
        )}
      </ul>
      <ErrorText error={merge.error} />
    </div>
  );
}
