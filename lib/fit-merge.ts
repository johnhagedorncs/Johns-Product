import type { FitScoreResult } from "@/lib/ai/score-fit";
import type { Job, JobFitResult } from "@/lib/types";

export type FitScoreStore = Record<string, FitScoreResult>;

export function jobNeedsFitScore(
  job: Job,
  stored: FitScoreStore
): boolean {
  if (job.fitScore !== undefined) return false;
  const saved = stored[job.id];
  if (!saved?.action || !saved.redFlags) return true;
  return false;
}

export function mergeJobWithFit(
  job: Job,
  fit?: FitScoreResult
): Job {
  if (!fit) {
    return job;
  }
  const normalized: JobFitResult = {
    score: fit.score,
    reasons: [...fit.reasons],
    gaps: [...fit.gaps],
    redFlags: [...(fit.redFlags ?? [])],
    action: fit.action ?? "apply_and_outreach",
  };
  return {
    ...job,
    fitScore: fit.score,
    fit: normalized,
  };
}

export function mergeJobsWithFits(
  jobs: Job[],
  stored: FitScoreStore
): Job[] {
  return jobs.map((job) => mergeJobWithFit(job, stored[job.id]));
}

export function sortJobsForScan(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });
}
