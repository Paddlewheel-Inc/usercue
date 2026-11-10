import { SectionHead } from "../../components/SectionHead";
import { Empty, ErrorText } from "../../components/ui";
import { dateTimeLabel } from "../../lib/format";
import { useAudit } from "../../lib/queries";

export function AuditSettings() {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useAudit();
  const entries = data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title="Audit log">
        Who changed what in your workspace. Entries are kept for over a year.
      </SectionHead>
      <ErrorText error={error} />
      {!isLoading && entries.length === 0 && <Empty title="Nothing logged yet" />}
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-0.5 rounded-xl bg-hover/60 px-3.5 py-2.5">
            <span className="text-[13px] leading-5">{entry.summary}</span>
            <span className="text-[11px] text-faint">
              {entry.actorName} · {dateTimeLabel(entry.createdAt)}
            </span>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          className="btn-ghost w-fit"
          disabled={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
