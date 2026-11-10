import { SAVED_VIEW_KEYS, SORTS, type Sort } from "@usercue/shared";

export interface Filter {
  status?: string;
  board?: string;
  tag?: string;
  assignee?: string;
  minVotes?: string;
  sort?: Sort;
  q?: string;
}

export function parseFilter(search: string): Filter {
  const params = new URLSearchParams(search);
  const read = (key: string) => params.get(key) || undefined;
  return {
    status: read("status"),
    board: read("board"),
    tag: read("tag"),
    assignee: read("assignee"),
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
  Boolean(filter.tag || filter.assignee || filter.minVotes || filter.q?.trim());
