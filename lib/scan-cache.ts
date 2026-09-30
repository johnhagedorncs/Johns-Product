import type { Job } from "@/lib/types";

type ScanCache = { jobs: Job[]; at: number };

const globalCache = globalThis as typeof globalThis & {
  __warmApplyScan?: ScanCache;
};

export function rememberScan(jobs: Job[]): void {
  globalCache.__warmApplyScan = { jobs, at: Date.now() };
}

export function recallScan(maxAgeMs = 10 * 60 * 1000): Job[] | null {
  const cached = globalCache.__warmApplyScan;
  if (!cached) return null;
  if (Date.now() - cached.at > maxAgeMs) return null;
  return cached.jobs;
}

export function findCachedJob(id: string): Job | undefined {
  return recallScan()?.find((job) => job.id === id);
}
