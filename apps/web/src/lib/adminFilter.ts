import { isDateOnly, SAVED_VIEW_KEYS, SORTS, type Sort } from "@usercue/shared";

export interface Filter {
  status?: string;
  board?: string;
  tag?: string;
  tagMode?: "any" | "all";
  assignee?: string;
  author?: string;
  createdAfter?: string;
  createdBefore?: string;
  minVotes?: string;
  sort?: Sort;
  q?: string;
}

export function parseFilter(search: string): Filter {
  const params = new URLSearchParams(search);
  const read = (key: string) => params.get(key) || undefined;
  const readDate = (key: string) => {
    const value = read(key);
    return value && isDateOnly(value) ? value : undefined;
  };
  const tag = read("tag");
  return {
    status: read("status"),
    board: read("board"),
    tag: tag && /^\d+(,\d+){0,7}$/.test(tag) ? tag : undefined,
    tagMode: params.get("tagMode") === "all" ? "all" : undefined,
    assignee: read("assignee"),
    author: read("author"),
    createdAfter: readDate("createdAfter"),
    createdBefore: readDate("createdBefore"),
    minVotes: read("minVotes"),
    sort: SORTS.find((sort) => sort === params.get("sort")),
    q: read("q"),
  };
}

export function filterQuery(filter: Filter): string {
  const params = new URLSearchParams();
  for (const key of SAVED_VIEW_KEYS) {
    const value = filter[key]?.trim();
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function filterHref(filter: Filter, id?: number): string {
  const query = filterQuery(filter);
  return `/admin/requests${id ? `/${id}` : ""}${query ? `?${query}` : ""}`;
}

export const isNarrowed = (filter: Filter): boolean =>
  Boolean(
    filter.tag ||
      filter.assignee ||
      filter.author ||
      filter.createdAfter ||
      filter.createdBefore ||
      filter.minVotes ||
      filter.q?.trim(),
  );
