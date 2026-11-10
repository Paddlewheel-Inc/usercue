import { expect, test } from "bun:test";
import { priorityScore } from "./priority";
import { searchTerms, similarThreshold } from "./similar";
import { normalizeViewQuery } from "./views";

test("priority score weighs votes and impact against effort", () => {
  expect(priorityScore(9, 5, 2)).toBe(25);
  expect(priorityScore(0, 1, 5)).toBe(0.2);
  expect(priorityScore(4, null, 2)).toBeNull();
  expect(priorityScore(4, 3, null)).toBeNull();
});

test("search terms drop stop words, short words, and duplicates", () => {
  expect(searchTerms("Please add a dark mode to the dashboard, dark!")).toEqual([
    "dashboard",
    "dark",
    "mode",
  ]);
  expect(searchTerms("it is ok")).toEqual([]);
});

test("search terms are capped and prefer longer words", () => {
  const terms = searchTerms("alpha bravo charlie delta echo foxtrot golf hotel india juliet", 3);
  expect(terms).toEqual(["charlie", "foxtrot", "juliet"]);
});

test("similarity needs most of the terms to match", () => {
  expect(similarThreshold(1)).toBe(1);
  expect(similarThreshold(2)).toBe(2);
  expect(similarThreshold(5)).toBe(3);
});

test("view queries keep only known keys and drop empty values", () => {
  expect(normalizeViewQuery("status=open&evil=1&board=&tag=3&minVotes=%205")).toBe(
    "status=open&tag=3&minVotes=5",
  );
});
