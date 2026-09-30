import { describe, expect, it } from "vitest";
import {
  jobNeedsFitScore,
  mergeJobWithFit,
  mergeJobsWithFits,
  sortJobsForScan,
} from "@/lib/fit-merge";
import type { Job } from "@/lib/types";

const baseJob: Job = {
  id: "test-job",
  company: "Acme",
  title: "SWE",
  location: "New York, NY",
  tier: "A",
  jobUrl: "https://example.com",
  postedAt: "2026-03-29T00:00:00.000Z",
  teamHint: "platform",
  requirements: ["TypeScript"],
};

describe("fit-merge", () => {
  it("needs fit when not on job or in store", () => {
    expect(jobNeedsFitScore(baseJob, {})).toBe(true);
  });

  it("skips when store has fit", () => {
    expect(
      jobNeedsFitScore(baseJob, {
        "test-job": {
          score: 4,
          reasons: ["a", "b", "c"],
          gaps: [],
          redFlags: [],
          action: "apply_now",
        },
      })
    ).toBe(false);
  });

  it("skips when job already has fitScore", () => {
    expect(jobNeedsFitScore({ ...baseJob, fitScore: 3 }, {})).toBe(false);
  });

  it("mergeJobWithFit returns job unchanged without fit", () => {
    expect(mergeJobWithFit(baseJob)).toEqual(baseJob);
  });

  it("merges fit onto job", () => {
    const merged = mergeJobWithFit(baseJob, {
      score: 5,
      reasons: ["one", "two", "three"],
      gaps: ["Kubernetes depth"],
      redFlags: ["5+ years required"],
      action: "skip",
    });
    expect(merged.fitScore).toBe(5);
    expect(merged.fit?.redFlags).toEqual(["5+ years required"]);
  });

  it("sortJobsForScan orders by tier then recency", () => {
    const sorted = sortJobsForScan([
      { ...baseJob, id: "b", tier: "B", postedAt: "2026-03-29T00:00:00.000Z" },
      { ...baseJob, id: "a", tier: "A", postedAt: "2026-03-28T00:00:00.000Z" },
    ]);
    expect(sorted[0].tier).toBe("A");
    const sameTier = sortJobsForScan([
      { ...baseJob, id: "old", tier: "A", postedAt: "2026-03-01T00:00:00.000Z" },
      { ...baseJob, id: "new", tier: "A", postedAt: "2026-03-29T00:00:00.000Z" },
    ]);
    expect(sameTier[0].id).toBe("new");
  });

  it("mergeJobsWithFits applies per id", () => {
    const jobs = mergeJobsWithFits([baseJob], {
      "test-job": { score: 2, reasons: ["a", "b", "c"], gaps: [], redFlags: [], action: "skip" },
    });
    expect(jobs[0].fitScore).toBe(2);
  });
});
