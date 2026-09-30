import type { Job } from "@/lib/types";

export const INBOX_CACHE_KEY = "warm-apply-inbox";

export type InboxCache = {
  jobs: Job[];
  note: string;
};

export function readInboxCache(): InboxCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INBOX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InboxCache;
    if (!Array.isArray(parsed.jobs)) return null;
    return {
      jobs: parsed.jobs,
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
  } catch {
    return null;
  }
}

export function writeInboxCache(jobs: Job[], note: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    INBOX_CACHE_KEY,
    JSON.stringify({ jobs, note })
  );
}

export function clearInboxCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INBOX_CACHE_KEY);
}
