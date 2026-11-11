import { type FormEvent, useState } from "react";
import { SectionHead } from "../../components/SectionHead";
import { ErrorText, useToast } from "../../components/ui";
import { useBoards, useCounts, useWipeBoard } from "../../lib/queries";

export function DangerSettings() {
  const { data: boards = [], isLoading } = useBoards();

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title="Wipe a board">
        Permanently delete every request on a board, along with its votes, comments, notes, and
        tags. The board stays, so people can post again. Changelog updates are kept. This cannot be
        undone.
      </SectionHead>
      {!isLoading && boards.length === 0 && (
        <p className="rounded-2xl bg-hover/60 px-4 py-8 text-center text-[12px] text-muted">
          No boards yet.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {boards.map((board) => (
          <WipeRow key={board.slug} board={board} />
        ))}
      </ul>
    </section>
  );
}

function WipeRow({ board }: { board: { slug: string; name: string } }) {
  const { data: counts } = useCounts(board.slug);
  const wipe = useWipeBoard();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : null;

  function close() {
    setOpen(false);
    setConfirm("");
    wipe.reset();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    wipe.mutate(
      { slug: board.slug, confirm },
      {
        onSuccess: ({ removed }) => {
          close();
          toast({
            message: `Wiped ${removed} ${removed === 1 ? "request" : "requests"} from ${board.name}.`,
          });
        },
      },
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-rose-500/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{board.name}</p>
          <p className="text-[11px] text-faint">
            {total === null ? "Counting…" : `${total} ${total === 1 ? "request" : "requests"}`}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            className="btn-quiet h-7 px-2.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            disabled={total === 0}
            onClick={() => setOpen(true)}
          >
            Wipe board
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-[12px] text-muted">
              Type <code className="font-medium text-fg">{board.slug}</code> to delete{" "}
              {total ?? "all"} {total === 1 ? "request" : "requests"} for good.
            </span>
            <input
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type ${board.slug} to confirm`}
            />
          </label>
          <div className="flex items-center gap-2">
            <ErrorText error={wipe.error} />
            <div className="flex-1" />
            <button type="button" className="btn-quiet h-8 px-3" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-full bg-rose-600 px-3 text-[13px] font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
              disabled={confirm !== board.slug || wipe.isPending}
            >
              {wipe.isPending ? "Wiping…" : "Wipe everything"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
