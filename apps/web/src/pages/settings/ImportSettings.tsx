import {
  IMPORT_LIMITS,
  LIMITS,
  POST_IMPORT_FIELDS,
  parseAmount,
  parseTimestamp,
  splitList,
} from "@usercue/shared";
import { ImportTable } from "../../components/ImportTable";
import { SectionHead } from "../../components/SectionHead";
import { type ImportPostRow, useFinishImport, useImportPosts } from "../../lib/queries";

const POST_LABELS = {
  title: "Title",
  body: "Details",
  status: "Status",
  board: "Board",
  authorName: "Author name",
  authorEmail: "Author email",
  votes: "Votes",
  createdAt: "Created",
  tags: "Tags",
};

export function ImportSettings() {
  const importPosts = useImportPosts();
  const finish = useFinishImport();

  return (
    <section className="flex flex-col gap-3">
      <SectionHead title="Import feedback">
        Move over from Canny, Featurebase, Productboard, or any tool that exports CSV or JSON.
        Votes, authors, tags, and dates come along when the file has them.
      </SectionHead>
      <ImportTable
        required="title"
        noun="posts"
        fields={POST_IMPORT_FIELDS}
        labels={POST_LABELS}
        weigh={(row: ImportPostRow) => row.votes}
        toRow={(values): ImportPostRow | null => {
          const title = values.title.trim().slice(0, LIMITS.title);
          if (!title) return null;
          return {
            title,
            body: values.body.slice(0, LIMITS.body),
            status: values.status.trim().slice(0, 80),
            board: values.board.trim().slice(0, 80),
            authorName: values.authorName.trim().slice(0, LIMITS.name),
            authorEmail: values.authorEmail.trim().slice(0, 200),
            votes: Math.min(IMPORT_LIMITS.votes, parseAmount(values.votes)),
            createdAt: parseTimestamp(values.createdAt),
            tags: splitList(values.tags)
              .slice(0, 20)
              .map((tag) => tag.slice(0, 80)),
          };
        }}
        send={async (rows) => {
          const result = await importPosts.mutateAsync(rows);
          return { imported: result.created, skipped: result.skipped };
        }}
        onFinished={(count) => finish.mutate(count)}
      />
    </section>
  );
}
