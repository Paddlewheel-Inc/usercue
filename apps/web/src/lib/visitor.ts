const STORAGE_KEY = "usercue:visitor";
const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export const isEmbedded = () => window.location.pathname.startsWith("/embed");

function createId() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function visitorId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ID_PATTERN.test(stored)) return stored;
    const created = createId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return createId();
  }
}

export function visitorHeaders(): Record<string, string> {
  return isEmbedded() ? { "x-visitor-id": visitorId() } : {};
}
