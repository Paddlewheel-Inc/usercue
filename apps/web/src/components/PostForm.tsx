import { LIMITS, tagColorHex } from "@usercue/shared";
import { type FormEvent, useState } from "react";
import { getSavedName, saveName } from "../lib/format";
import { useAuthMethods, useCreatePost, useMe, useTags } from "../lib/queries";
import { isEmbedded } from "../lib/visitor";
import { Editor } from "./Editor";
import { OAuthButtons } from "./OAuthButtons";
import { SimilarPosts } from "./SimilarPosts";
import { ErrorText } from "./ui";

export function PostForm({ board, defaultOpen = false }: { board: string; defaultOpen?: boolean }) {
  const { data: me } = useMe();
  const { data: methods } = useAuthMethods();
  const create = useCreatePost();
  const allowTags = Boolean(me?.customerTags);
  const requireTags = Boolean(me?.customerTagsRequired);
  const { data: tags = [] } = useTags(allowTags);
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState(getSavedName);
  const [tagIds, setTagIds] = useState<number[]>([]);

  const user = me?.user;
  const identity = me?.identity;
  const guest = !user && !identity;
  const allowGuest = me?.allowGuestFeedback !== false;
  const mustSignIn = guest && !allowGuest;
  const canSignInHere = Boolean(methods?.providers.length) && !isEmbedded();
  const suspended = Boolean(user?.suspended);
  const needsTag = requireTags && tagIds.length === 0;
  const canPost = !mustSignIn && !suspended && !needsTag;

  function toggleTag(id: number) {
    setTagIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 8) return current;
      return [...current, id];
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const author = guest ? name.trim() : undefined;
    if (author) saveName(author);

    create.mutate(
      { board, title, body, name: author, tagIds: allowTags ? tagIds : undefined },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setTagIds([]);
          setOpen(false);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="card overflow-hidden">
      <input
        className="h-12 w-full bg-transparent px-4 text-[13px] outline-none placeholder:text-faint"
        placeholder="Share an idea or report a problem…"
        value={title}
        maxLength={LIMITS.title}
        onFocus={() => setOpen(true)}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      {open && <SimilarPosts text={title} />}
      {open && (
        <div className="flex animate-rise flex-col gap-3 px-4 pb-3">
          <Editor value={body} onChange={setBody} maxLength={LIMITS.body} mentions />
          {allowTags && tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[12px] text-muted">
                {requireTags ? "Choose a tag" : "Add a tag (optional)"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={selected}
                      className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-full px-2 text-[11px] font-medium transition-colors ${
                        selected
                          ? "bg-accent-soft text-accent-text"
                          : "bg-hover text-muted hover:text-fg"
                      }`}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: tagColorHex(tag.color) }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {guest && canSignInHere && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <OAuthButtons next="board" />
              {allowGuest && (
                <p className="text-center text-[11px] text-faint">or post as a guest</p>
              )}
            </div>
          )}
          {mustSignIn && !canSignInHere && (
            <p className="border-t pt-3 text-[12px] text-muted">
              Sign in is required to share feedback.
              {isEmbedded() && " Open the full board to sign in."}
            </p>
          )}
          <div className="flex items-center gap-2 border-t pt-3">
            {guest && allowGuest && (
              <input
                className="input max-w-40"
                placeholder="Your name"
                value={name}
                maxLength={LIMITS.name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            {(user || identity) && (
              <span className="px-1 text-[13px] text-muted">{user?.name ?? identity?.name}</span>
            )}
            {suspended && <p className="text-xs text-rose-500">Your account has been suspended.</p>}
            <ErrorText error={create.error} />
            <div className="flex-1" />
            <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending || !canPost}>
              Post
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
