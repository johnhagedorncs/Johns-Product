import type { Job, JobSource } from "@/lib/types";

export function hoursSincePosted(postedAt: string, now = Date.now()): number {
  const ms = now - new Date(postedAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
}

export function isFreshPosting(postedAt: string, now = Date.now()): boolean {
  return hoursSincePosted(postedAt, now) < 48;
}

export function relativePosted(postedAt: string, now = Date.now()): string {
  const hours = hoursSincePosted(postedAt, now);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}

export function shouldApplyToday(fitScore?: number): boolean {
  return fitScore !== undefined && fitScore >= 3;
}

/** Fresh, good-fit, and nothing blocking — the roles to apply to before lunch. */
export function isApplyToday(job: Job, now = Date.now()): boolean {
  return (
    shouldApplyToday(job.fitScore) &&
    job.fit?.action !== "skip" &&
    isFreshPosting(job.postedAt, now)
  );
}

export type JobSort = "match" | "posted";

function postedDesc(a: Job, b: Job): number {
  return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
}

export function sortJobs(jobs: Job[], sort: JobSort): Job[] {
  const copy = [...jobs];
  copy.sort((a, b) => {
    if (sort === "match") {
      const scoreA = a.fitScore ?? -1;
      const scoreB = b.fitScore ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (Boolean(a.early) !== Boolean(b.early)) return a.early ? -1 : 1;
      if (Boolean(a.onWatchList) !== Boolean(b.onWatchList)) return a.onWatchList ? -1 : 1;
    }
    return postedDesc(a, b);
  });
  return copy;
}

export type SourceFilter = "all" | "watchlist" | "simplify" | "linkedin";

export type JobFilters = {
  minFit: number;
  source: SourceFilter;
  query: string;
  hidden: Set<string>;
};

function fromSource(job: Job, source: SourceFilter): boolean {
  if (source === "all") return true;
  const sources: JobSource[] = job.sources ?? (job.source ? [job.source] : []);
  if (source === "watchlist") return Boolean(job.onWatchList);
  return sources.includes(source);
}

export function filterJobs(jobs: Job[], filters: JobFilters): Job[] {
  const query = filters.query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (filters.hidden.has(job.id)) return false;
    if (filters.minFit > 0 && (job.fitScore ?? 0) < filters.minFit) return false;
    if (!fromSource(job, filters.source)) return false;
    if (query && !`${job.company} ${job.title} ${job.location}`.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

export const SOURCE_NAMES: Record<JobSource, string> = {
  greenhouse: "Greenhouse",
  ashby: "Ashby",
  lever: "Lever",
  simplify: "Simplify",
  linkedin: "LinkedIn",
  url: "Pasted link",
};
