import { expect, test } from "bun:test";
import {
  guessCategory,
  guessMapping,
  POST_IMPORT_FIELDS,
  parseAmount,
  parseCsv,
  parseTimestamp,
  readTable,
  splitList,
} from "./importing";

test("parseCsv handles quotes, escaped quotes, newlines inside cells, and CRLF", () => {
  const text = 'title,details\r\n"Dark, mode","He said ""hi""\nthen left"\r\nSecond,plain\r\n';
  expect(parseCsv(text)).toEqual([
    ["title", "details"],
    ["Dark, mode", 'He said "hi"\nthen left'],
    ["Second", "plain"],
  ]);
});

test("parseCsv detects semicolon and tab delimiters and skips blank lines and the BOM", () => {
  expect(parseCsv("\ufeffa;b\n1;2\n\n")).toEqual([
    ["a", "b"],
    ["1", "2"],
  ]);
  expect(parseCsv("a\tb\n1\t2")).toEqual([
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("readTable builds rows keyed by header and fills missing cells", () => {
  const table = readTable("Title,Votes\nOne,3\nTwo");
  expect(table.headers).toEqual(["Title", "Votes"]);
  expect(table.rows).toEqual([
    { Title: "One", Votes: "3" },
    { Title: "Two", Votes: "" },
  ]);
});

test("readTable accepts JSON exports and flattens one level of nesting", () => {
  const table = readTable(
    JSON.stringify({
      posts: [{ title: "A", author: { name: "Ann" }, tags: ["x", "y"], votes: 4 }],
    }),
  );
  expect(table.rows).toEqual([{ title: "A", "author name": "Ann", tags: "x, y", votes: "4" }]);
});

test("guessMapping matches common export headers once each", () => {
  const mapping = guessMapping(
    ["Post Title", "Details", "Status", "Author Email", "Author", "Vote Count", "Created At"],
    { ...POST_IMPORT_FIELDS },
  );
  expect(mapping).toMatchObject({
    title: "Post Title",
    body: "Details",
    status: "Status",
    authorEmail: "Author Email",
    authorName: "Author",
    votes: "Vote Count",
    createdAt: "Created At",
    board: null,
    tags: null,
  });
});

test("parseAmount copes with currency symbols and separators", () => {
  expect(parseAmount("$1,200")).toBe(1200);
  expect(parseAmount("1,234.56")).toBe(1235);
  expect(parseAmount("12,5")).toBe(13);
  expect(parseAmount("n/a")).toBe(0);
  expect(parseAmount("-5")).toBe(0);
});

test("parseTimestamp reads seconds, milliseconds, and date strings", () => {
  expect(parseTimestamp("1700000000")).toBe(1_700_000_000);
  expect(parseTimestamp("1700000000000")).toBe(1_700_000_000);
  expect(parseTimestamp("2024-01-02T00:00:00Z")).toBe(1_704_153_600);
  expect(parseTimestamp("")).toBeNull();
  expect(parseTimestamp("not a date")).toBeNull();
});

test("splitList trims, splits on common separators, and removes duplicates", () => {
  expect(splitList("ui, api;ui | billing")).toEqual(["ui", "api", "billing"]);
});

test("guessCategory maps common status names", () => {
  expect(guessCategory("Under Review")).toBe("open");
  expect(guessCategory("Planned")).toBe("planned");
  expect(guessCategory("In Progress")).toBe("in_progress");
  expect(guessCategory("Completed")).toBe("complete");
  expect(guessCategory("Shipped")).toBe("complete");
  expect(guessCategory("Not planned")).toBe("closed");
  expect(guessCategory("Won't do")).toBe("closed");
});
