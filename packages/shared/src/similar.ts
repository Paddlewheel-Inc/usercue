const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "you",
  "are",
  "was",
  "can",
  "not",
  "but",
  "have",
  "has",
  "how",
  "its",
  "our",
  "your",
  "from",
  "when",
  "what",
  "into",
  "they",
  "them",
  "there",
  "would",
  "could",
  "should",
  "will",
  "just",
  "also",
  "been",
  "more",
  "some",
  "than",
  "then",
  "about",
  "like",
  "want",
  "need",
  "able",
  "please",
  "add",
  "use",
  "get",
  "make",
]);

export const SIMILAR_MIN_LENGTH = 6;

export function searchTerms(text: string, limit = 8): string[] {
  const seen = new Set<string>();
  for (const match of text.toLowerCase().matchAll(/[\p{L}\p{N}]{3,}/gu)) {
    if (!STOP_WORDS.has(match[0])) seen.add(match[0]);
  }
  return [...seen].sort((a, b) => b.length - a.length).slice(0, limit);
}

export function similarThreshold(termCount: number): number {
  return Math.max(1, Math.ceil(termCount * 0.6));
}
