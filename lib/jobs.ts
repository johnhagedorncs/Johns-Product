import outreachSeed from "@/data/outreach.json";
import { findCachedJob, recallScan } from "@/lib/scan-cache";
import type { Job, OutreachContact } from "@/lib/types";

const outreach = outreachSeed as OutreachContact[];

export function getJobs(): Job[] {
  return recallScan() ?? [];
}

export function getJobById(id: string): Job | undefined {
  return findCachedJob(id);
}

export function getJobByUrl(url: string): Job | undefined {
  const normalized = url.trim().toLowerCase();
  return getJobs().find(
    (job) =>
      job.jobUrl.toLowerCase() === normalized ||
      normalized.includes(job.id.replace(/-/g, ""))
  );
}

export function getOutreachForJob(jobId: string): OutreachContact[] {
  return outreach
    .filter((c) => c.jobId === jobId)
    .sort((a, b) => b.rankScore - a.rankScore);
}

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

export type JobSort = "match" | "posted";

export function sortJobs(jobs: Job[], sort: JobSort): Job[] {
  const copy = [...jobs];
  copy.sort((a, b) => {
    if (sort === "match") {
      const scoreA = a.fitScore ?? -1;
      const scoreB = b.fitScore ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
    }
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });
  return copy;
}

export function groupJobsByTier(jobList: Job[]): Record<string, Job[]> {
  const groups: Record<string, Job[]> = { A: [], B: [], C: [] };
  for (const job of jobList) {
    groups[job.tier]?.push(job);
  }
  return groups;
}
