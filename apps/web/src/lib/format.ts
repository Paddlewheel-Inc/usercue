import { stripHtml } from "@usercue/shared";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
const short = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const long = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function timeAgo(unixSeconds: number): string {
  const diff = unixSeconds - Math.floor(Date.now() / 1000);
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.trunc(diff / seconds), unit);
  }
  return "just now";
}

export function shortDate(unixSeconds: number): string {
  return short.format(unixSeconds * 1000);
}

export function longDate(unixSeconds: number): string {
  return long.format(unixSeconds * 1000);
}

export function dateTimeLabel(unixSeconds: number): string {
  return dateTime.format(unixSeconds * 1000);
}

export function excerpt(text: string, max = 96): string {
  const t = stripHtml(text);
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

const POST_HREF = /^\/(?:p|post)\/(\d+)$/;

export function postIdFromHref(href: string): number | undefined {
  const path = href.trim();
  const local = POST_HREF.exec(path);
  if (local) return Number(local[1]);
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    const match = POST_HREF.exec(url.pathname);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

const NAME_KEY = "usercue:name";

export const getSavedName = () => localStorage.getItem(NAME_KEY) ?? "";
export const saveName = (name: string) => localStorage.setItem(NAME_KEY, name);
