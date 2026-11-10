import { guessMapping, IMPORT_LIMITS, type Mapping, readTable, type Table } from "@usercue/shared";
import { useRef, useState } from "react";
import { Select } from "./Select";
import { ErrorText } from "./ui";

interface Outcome {
  imported: number;
  skipped: number;
}

interface ImportTableProps<F extends string, R> {
  fields: Record<F, readonly string[]>;
  labels: Record<F, string>;
  required: NoInfer<F>;
  noun: string;
  toRow: (values: Record<F, string>) => R | null;
  weigh?: (row: R) => number;
  send: (rows: R[]) => Promise<Outcome>;
  onFinished: (imported: number) => void;
}

function batches<R>(rows: R[], weigh: (row: R) => number): R[][] {
  const result: R[][] = [];
  let current: R[] = [];
  let weight = 0;
  for (const row of rows) {
    const next = weigh(row);
    if (current.length >= IMPORT_LIMITS.batch || weight + next > IMPORT_LIMITS.votes) {
      result.push(current);
      current = [];
      weight = 0;
    }
    current.push(row);
    weight += next;
  }
  if (current.length > 0) result.push(current);
  return result;
}

export function ImportTable<F extends string, R>({
  fields,
  labels,
  required,
  noun,
  toRow,
  weigh = () => 0,
  send,
  onFinished,
}: ImportTableProps<F, R>) {
  const input = useRef<HTMLInputElement>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<Mapping<F> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function reset() {
    setTable(null);
    setMapping(null);
    setError(null);
    setProgress(null);
    setOutcome(null);
  }

  async function pick(file: File) {
    reset();
    try {
      const parsed = readTable(await file.text());
      if (parsed.rows.length === 0) throw new Error("That file has no rows.");
      if (parsed.rows.length > IMPORT_LIMITS.rows) {
        throw new Error(`Import up to ${IMPORT_LIMITS.rows.toLocaleString()} rows at a time.`);
      }
      setTable(parsed);
      setMapping(guessMapping(parsed.headers, fields));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Could not read that file."));
    }
  }

  function convert(): R[] {
    if (!table || !mapping) return [];
    const keys = Object.keys(fields) as F[];
    return table.rows.flatMap((row) => {
      const values = Object.fromEntries(
        keys.map((key) => [key, mapping[key] ? (row[mapping[key]] ?? "") : ""]),
      ) as Record<F, string>;
      const converted = toRow(values);
      return converted ? [converted] : [];
    });
  }

  async function run() {
    const rows = convert();
    const total = { imported: 0, skipped: (table?.rows.length ?? 0) - rows.length };
    setError(null);
    setProgress({ done: 0, total: rows.length });
    try {
      for (const batch of batches(rows, weigh)) {
        const result = await send(batch);
        total.imported += result.imported;
        total.skipped += result.skipped;
        setProgress((current) => current && { ...current, done: current.done + batch.length });
      }
      setOutcome(total);
      if (total.imported > 0) onFinished(total.imported);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("The import failed."));
    }
    setProgress(null);
  }

  const options = [
    { value: "", label: "Not in file" },
    ...(table?.headers ?? []).map((header) => ({ value: header, label: header })),
  ];
  const running = progress !== null;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept=".csv,.tsv,.txt,.json,text/csv,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
          e.target.value = "";
        }}
      />

      {!table && !outcome && (
        <button type="button" className="btn-ghost w-fit" onClick={() => input.current?.click()}>
          Choose a file
        </button>
      )}

      {table && mapping && !outcome && (
        <div className="flex flex-col gap-3 rounded-2xl bg-hover/60 p-3.5">
          <p className="text-[12px] text-muted">
            Found {table.rows.length.toLocaleString()} rows. Match each field to a column.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(fields) as F[]).map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <span className="px-1 text-[11px] text-muted">
                  {labels[key]}
                  {key === required && " (required)"}
                </span>
                <Select
                  label={labels[key]}
                  value={mapping[key] ?? ""}
                  options={options}
                  disabled={running}
                  onChange={(value) => setMapping({ ...mapping, [key]: value || null })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-quiet" disabled={running} onClick={reset}>
              Cancel
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className="btn-primary"
              disabled={running || !mapping[required]}
              onClick={run}
            >
              {running
                ? `Importing ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}…`
                : `Import ${noun}`}
            </button>
          </div>
        </div>
      )}

      {outcome && (
        <div className="flex items-center gap-2 rounded-2xl bg-accent-soft px-3.5 py-3">
          <p className="flex-1 text-[13px]">
            Imported {outcome.imported.toLocaleString()} {noun}
            {outcome.skipped > 0 && `, skipped ${outcome.skipped.toLocaleString()}`}.
          </p>
          <button type="button" className="btn-quiet" onClick={reset}>
            Done
          </button>
        </div>
      )}
      <ErrorText error={error} />
    </div>
  );
}
