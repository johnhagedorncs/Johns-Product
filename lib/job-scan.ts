import { ruleFit, withFit, type FitContext } from "@/lib/fit";
import { normalizeCompany, scanWatchList } from "@/lib/sources/ats";
import type { FetchLike } from "@/lib/sources/http";
import { scanLinkedIn } from "@/lib/sources/linkedin";
import { scanSimplify } from "@/lib/sources/simplify";
import type { Job, JobSource } from "@/lib/types";

export type ScanSourceId = "watchlist" | "simplify" | "linkedin";

export type SourceStatus = {
  id: ScanSourceId;
  label: string;
  count: number;
  error?: string;
};

export type ScanResult = {
  jobs: Job[];
  sources: SourceStatus[];
  scannedAt: string;
};

export const SOURCE_LABELS: Record<ScanSourceId, string> = {
  watchlist: "Watch list (Greenhouse · Ashby · Lever)",
  simplify: "SimplifyJobs new-grad list",
  linkedin: "LinkedIn jobs",
};

const MAX_JOBS = 300;
/** Keeps the scan response well under Vercel's 4.5 MB function response limit. */
const MAX_DESCRIPTION_CHARS = 6000;

/** Boards with a full description win when the same role shows up twice. */
const SOURCE_RANK: Record<JobSource, number> = {
  greenhouse: 0,
  ashby: 0,
  lever: 0,
  url: 1,
  simplify: 2,
  linkedin: 3,
};

export function roleKey(job: Pick<Job, "company" | "title">): string {
  const title = job.title
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[-–—,|:]\s*(us|usa|united states|remote|new york|nyc|ny)\s*$/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${normalizeCompany(job.company)}|${title}`;
}

export function dedupeJobs(jobs: Job[]): Job[] {
  const byKey = new Map<string, Job>();
  for (const job of jobs) {
    const key = roleKey(job);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...job, sources: [...(job.sources ?? (job.source ? [job.source] : []))] });
      continue;
    }
    const keepNew =
      SOURCE_RANK[job.source ?? "url"] < SOURCE_RANK[existing.source ?? "url"];
    const primary = keepNew ? job : existing;
    const other = keepNew ? existing : job;
    const sources = [...new Set([...(existing.sources ?? []), ...(job.sources ?? [])])];
    const posted = [primary.postedAt, other.postedAt].sort()[0];
    byKey.set(key, {
      ...primary,
      sources,
      postedAt: posted,
      description: primary.description || other.description,
      applicants: primary.applicants ?? other.applicants,
      early: Boolean(primary.early || other.early),
      onWatchList: Boolean(primary.onWatchList || other.onWatchList),
    });
  }
  return [...byKey.values()];
}

function freshFirst(a: Job, b: Job): number {
  return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
}

type Scanners = {
  watchlist: (fetchImpl: FetchLike, locationId: string) => Promise<{ jobs: Job[]; failed: string[] }>;
  simplify: (fetchImpl: FetchLike, locationId: string) => Promise<Job[]>;
  linkedin: (fetchImpl: FetchLike, locationId: string) => Promise<Job[]>;
};

const DEFAULT_SCANNERS: Scanners = {
  watchlist: scanWatchList,
  simplify: scanSimplify,
  linkedin: scanLinkedIn,
};

function errorText(err: unknown): string {
  return (err instanceof Error ? err.message : "Did not answer").slice(0, 120);
}

export async function scanAllSources(
  context: FitContext,
  options: { fetchImpl?: FetchLike; scanners?: Partial<Scanners> } = {}
): Promise<ScanResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const scanners = { ...DEFAULT_SCANNERS, ...options.scanners };
  const { locationId } = context;

  const [watch, simplify, linkedin] = await Promise.allSettled([
    scanners.watchlist(fetchImpl, locationId),
    scanners.simplify(fetchImpl, locationId),
    scanners.linkedin(fetchImpl, locationId),
  ]);

  const sources: SourceStatus[] = [];
  const all: Job[] = [];

  if (watch.status === "fulfilled") {
    all.push(...watch.value.jobs);
    sources.push({
      id: "watchlist",
      label: SOURCE_LABELS.watchlist,
      count: watch.value.jobs.length,
      error: watch.value.failed.length > 0 ? `No answer from ${watch.value.failed.join(", ")}` : undefined,
    });
  } else {
    sources.push({ id: "watchlist", label: SOURCE_LABELS.watchlist, count: 0, error: errorText(watch.reason) });
  }
  for (const [id, result] of [
    ["simplify", simplify],
    ["linkedin", linkedin],
  ] as const) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
      sources.push({ id, label: SOURCE_LABELS[id], count: result.value.length });
    } else {
      sources.push({ id, label: SOURCE_LABELS[id], count: 0, error: errorText(result.reason) });
    }
  }

  // Score everything first so the cap drops the weakest fits, not the oldest posts.
  const jobs = dedupeJobs(all)
    .map((job) => withFit(job, ruleFit(job, context)))
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0) || freshFirst(a, b))
    .slice(0, MAX_JOBS)
    .sort(freshFirst)
    .map((job) => (job.description ? { ...job, description: job.description.slice(0, MAX_DESCRIPTION_CHARS) } : job));

  return { jobs, sources, scannedAt: new Date().toISOString() };
}
