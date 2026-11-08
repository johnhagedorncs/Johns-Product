import type { LinkedInDraft } from "@/lib/ai/linkedin-draft";
import type { WarmPath } from "@/lib/warm-paths";

/**
 * Per-role work that should survive leaving the page and coming back:
 * the outreach draft in progress, the checked warm paths, and whether the
 * posting was already read this session. Lives in localStorage so switching
 * tabs never re-runs a search or wipes a draft.
 */
export const DRAFTS_KEY = "warm-apply-drafts";
export const WARM_PATHS_KEY = "warm-apply-warm-paths-v4";
export const READ_KEY = "warm-apply-read-this-session";

const MAX_DRAFTS = 100;
const MAX_WARM_PATHS = 200;

type Store = Pick<Storage, "getItem" | "setItem">;

function local(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function session(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function readRecord<T>(key: string, store: Store | null): Record<string, T> {
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(key) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

/** Save one entry, keeping only the newest `max` (insertion order). */
function writeEntry<T>(key: string, id: string, value: T | null, max: number, store: Store | null): void {
  if (!store) return;
  const all = readRecord<T>(key, store);
  delete all[id];
  if (value !== null) all[id] = value;
  const entries = Object.entries(all);
  try {
    store.setItem(key, JSON.stringify(Object.fromEntries(entries.slice(Math.max(0, entries.length - max)))));
  } catch {
    // Storage full or blocked — the page still works, it just won't remember.
  }
}

// ---- Outreach draft ------------------------------------------------------

export type SavedDraft = {
  paste: string;
  draft: LinkedInDraft | null;
  note: string;
  messaged: boolean;
};

export function readDraft(jobId: string, store = local()): SavedDraft | null {
  const saved = readRecord<SavedDraft>(DRAFTS_KEY, store)[jobId];
  if (!saved || typeof saved.paste !== "string") return null;
  return {
    paste: saved.paste,
    draft: saved.draft ?? null,
    note: typeof saved.note === "string" ? saved.note : "",
    messaged: Boolean(saved.messaged),
  };
}

export function saveDraft(jobId: string, value: SavedDraft, store = local()): void {
  const empty = !value.paste.trim() && !value.draft;
  writeEntry(DRAFTS_KEY, jobId, empty ? null : value, MAX_DRAFTS, store);
}

// ---- Warm paths (already checked for results) ------------------------------

export function warmPathsKey(jobId: string, resumeHash: string, locationId: string): string {
  return `${jobId}|${resumeHash}|${locationId}`;
}

export function readWarmPaths(key: string, store = local()): WarmPath[] | null {
  const saved = readRecord<WarmPath[]>(WARM_PATHS_KEY, store)[key];
  return Array.isArray(saved) ? saved : null;
}

export function saveWarmPaths(key: string, paths: WarmPath[], store = local()): void {
  writeEntry(WARM_PATHS_KEY, key, paths, MAX_WARM_PATHS, store);
}

// ---- Posting already read this session ------------------------------------

/** True once this browser session already tried reading the posting — success or not. */
export function wasReadThisSession(jobId: string, store = session()): boolean {
  return Boolean(readRecord<boolean>(READ_KEY, store)[jobId]);
}

export function markReadThisSession(jobId: string, store = session()): void {
  writeEntry(READ_KEY, jobId, true, 500, store);
}
