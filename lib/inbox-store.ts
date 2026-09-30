import type { SourceStatus } from "@/lib/job-scan";
import type { Job, JobFitResult } from "@/lib/types";

/**
 * Browser-side store for the inbox. Everything lives in localStorage so a
 * refresh, a deep link to /jobs/[id], or a new tab still has the last scan.
 * Descriptions are stored separately and capped so the inbox never blows
 * the ~5 MB storage limit.
 */
export const INBOX_KEY = "warm-apply-inbox-v2";
export const DESCRIPTIONS_KEY = "warm-apply-descriptions";
export const SEEN_KEY = "warm-apply-seen";
export const JOB_STATUS_KEY = "warm-apply-job-status";
export const AI_FIT_KEY = "warm-apply-ai-fits";

const MAX_DESCRIPTIONS = 200;
const MAX_DESCRIPTION_CHARS = 8000;
const MAX_SEEN = 3000;
const MAX_AI_FITS = 600;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, fallback: T, store = browserStore()): T {
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(fallback) !== Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown, store = browserStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Keep the newest `max` entries of an insertion-ordered record. */
function trim<T>(record: Record<string, T>, max: number): Record<string, T> {
  const entries = Object.entries(record);
  return entries.length <= max ? record : Object.fromEntries(entries.slice(entries.length - max));
}

// ---- Inbox ---------------------------------------------------------------

export type Inbox = {
  jobs: Job[];
  sources: SourceStatus[];
  scannedAt: string;
  locationId: string;
  /** Roles the last scan found for the first time */
  newIds?: string[];
};

export function readInbox(store = browserStore()): Inbox | null {
  const inbox = read<Partial<Inbox> | null>(INBOX_KEY, null, store) as Partial<Inbox> | null;
  if (!inbox || !Array.isArray(inbox.jobs)) return null;
  const descriptions = readDescriptions(store);
  return {
    jobs: inbox.jobs.map((job) => (descriptions[job.id] ? { ...job, description: descriptions[job.id] } : job)),
    sources: Array.isArray(inbox.sources) ? inbox.sources : [],
    scannedAt: typeof inbox.scannedAt === "string" ? inbox.scannedAt : "",
    locationId: typeof inbox.locationId === "string" ? inbox.locationId : "nyc",
    newIds: Array.isArray(inbox.newIds) ? inbox.newIds : [],
  };
}

export function writeInbox(inbox: Inbox, store = browserStore()): void {
  const descriptions: Record<string, string> = {};
  // Oldest first so the freshest roles survive the size cap.
  for (const job of [...inbox.jobs].reverse()) {
    if (job.description) descriptions[job.id] = job.description;
  }
  saveDescriptions(descriptions, store);
  write(
    INBOX_KEY,
    { ...inbox, jobs: inbox.jobs.map((job) => ({ ...job, description: undefined })) },
    store
  );
}

export function findInboxJob(id: string, store = browserStore()): Job | null {
  return readInbox(store)?.jobs.find((job) => job.id === id) ?? null;
}

/** Add or replace one role (pasted link, fetched description, new fit). */
export function upsertInboxJob(job: Job, store = browserStore()): Inbox {
  const inbox = readInbox(store) ?? { jobs: [], sources: [], scannedAt: "", locationId: "nyc" };
  const others = inbox.jobs.filter((item) => item.id !== job.id);
  const next = { ...inbox, jobs: [job, ...others] };
  writeInbox(next, store);
  return next;
}

// ---- Descriptions --------------------------------------------------------

function readDescriptions(store = browserStore()): Record<string, string> {
  return read<Record<string, string>>(DESCRIPTIONS_KEY, {}, store);
}

export function saveDescriptions(update: Record<string, string>, store = browserStore()): void {
  const merged = { ...readDescriptions(store) };
  for (const [id, text] of Object.entries(update)) {
    delete merged[id];
    merged[id] = text.slice(0, MAX_DESCRIPTION_CHARS);
  }
  let next = trim(merged, MAX_DESCRIPTIONS);
  while (!write(DESCRIPTIONS_KEY, next, store) && Object.keys(next).length > 0) {
    next = trim(next, Math.floor(Object.keys(next).length / 2));
  }
}

// ---- New since last scan ------------------------------------------------

/** Records first-seen time for each role and returns the ids never seen before. */
export function markSeen(jobs: Job[], now = new Date().toISOString(), store = browserStore()): Set<string> {
  const seen = read<Record<string, string>>(SEEN_KEY, {}, store);
  const firstScan = Object.keys(seen).length === 0;
  const fresh = new Set<string>();
  for (const job of jobs) {
    if (!seen[job.id]) {
      seen[job.id] = now;
      if (!firstScan) fresh.add(job.id);
    }
  }
  write(SEEN_KEY, trim(seen, MAX_SEEN), store);
  return fresh;
}

// ---- Applied / hidden ----------------------------------------------------

export type JobStatus = "applied" | "hidden";

export type JobStatusEntry = { status: JobStatus; at: string };

export function readJobStatuses(store = browserStore()): Record<string, JobStatusEntry> {
  return read<Record<string, JobStatusEntry>>(JOB_STATUS_KEY, {}, store);
}

export function setJobStatus(
  id: string,
  status: JobStatus | null,
  now = new Date().toISOString(),
  store = browserStore()
): Record<string, JobStatusEntry> {
  const statuses = { ...readJobStatuses(store) };
  if (status) statuses[id] = { status, at: now };
  else delete statuses[id];
  write(JOB_STATUS_KEY, statuses, store);
  return statuses;
}

// ---- AI fit cache (per resume) ----------------------------------------------

function fitKey(jobId: string, resumeHash: string): string {
  return `${jobId}:${resumeHash}`;
}

export function readAiFit(jobId: string, resumeHash: string, store = browserStore()): JobFitResult | null {
  return read<Record<string, JobFitResult>>(AI_FIT_KEY, {}, store)[fitKey(jobId, resumeHash)] ?? null;
}

export function saveAiFits(
  fits: Array<{ id: string; fit: JobFitResult }>,
  resumeHash: string,
  store = browserStore()
): void {
  const all = { ...read<Record<string, JobFitResult>>(AI_FIT_KEY, {}, store) };
  for (const { id, fit } of fits) {
    if (fit.basis !== "ai") continue;
    delete all[fitKey(id, resumeHash)];
    all[fitKey(id, resumeHash)] = fit;
  }
  write(AI_FIT_KEY, trim(all, MAX_AI_FITS), store);
}

/** Swap in any AI fit already scored for this resume so rescans don't pay twice. */
export function applyCachedFits(jobs: Job[], resumeHash: string, store = browserStore()): Job[] {
  const all = read<Record<string, JobFitResult>>(AI_FIT_KEY, {}, store);
  return jobs.map((job) => {
    const fit = all[fitKey(job.id, resumeHash)];
    return fit ? { ...job, fit, fitScore: fit.score } : job;
  });
}
