import type { Job, JobFitResult } from "@/lib/types";

export type Enrichment = {
  id: string;
  description?: string;
  applicants?: string;
  fit: JobFitResult;
};

/**
 * Roles to deep-score next: not yet read by the model, not hidden, best rule
 * score first, freshest as the tie-break. Keeps AI spend on the roles that
 * could actually be worth applying to.
 */
export function pickForEnrichment(
  jobs: Job[],
  hidden: Set<string>,
  limit: number,
  options: { minRuleScore?: number; aiAvailable?: boolean } = {}
): Job[] {
  const minRuleScore = options.minRuleScore ?? 3;
  // Without a model, the only thing left to do is fetch missing posting text.
  const needsWork = options.aiAvailable === false ? (job: Job) => !job.description : (job: Job) => job.fit?.basis !== "ai";
  return jobs
    .filter((job) => needsWork(job) && !hidden.has(job.id))
    .filter((job) => (job.fitScore ?? 0) >= minRuleScore)
    .sort((a, b) => {
      const diff = (b.fitScore ?? 0) - (a.fitScore ?? 0);
      if (diff !== 0) return diff;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    })
    .slice(0, limit);
}

export function applyEnrichment(jobs: Job[], updates: Enrichment[]): Job[] {
  const byId = new Map(updates.map((update) => [update.id, update]));
  return jobs.map((job) => {
    const update = byId.get(job.id);
    if (!update) return job;
    return {
      ...job,
      description: update.description || job.description,
      applicants: update.applicants ?? job.applicants,
      fit: update.fit,
      fitScore: update.fit.score,
    };
  });
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
