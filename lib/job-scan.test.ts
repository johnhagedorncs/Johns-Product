import { describe, expect, it } from "vitest";
import { dedupeJobs, roleKey, scanAllSources } from "@/lib/job-scan";
import type { Job } from "@/lib/types";

function job(overrides: Partial<Job>): Job {
  return {
    id: "x",
    company: "Stripe",
    title: "Software Engineer, New Grad",
    location: "New York, NY",
    tier: "B",
    jobUrl: "https://x",
    postedAt: "2026-09-25T00:00:00.000Z",
    teamHint: "",
    requirements: [],
    ...overrides,
  };
}

describe("dedupeJobs", () => {
  it("merges the same role from several boards, keeping the ATS copy", () => {
    const linkedin = job({ id: "li-1", source: "linkedin", sources: ["linkedin"], applicants: "Over 200 applicants", postedAt: "2026-09-20T00:00:00.000Z" });
    const ats = job({ id: "stripe-1", source: "greenhouse", sources: ["greenhouse"], description: "Build payments.", onWatchList: true });
    const simplify = job({ id: "s-1", title: "Software Engineer, New Grad - US", source: "simplify", sources: ["simplify"], early: true });
    const other = job({ id: "o-1", title: "Data Engineer", source: "simplify" });
    const merged = dedupeJobs([linkedin, ats, simplify, other]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "stripe-1",
      description: "Build payments.",
      applicants: "Over 200 applicants",
      postedAt: "2026-09-20T00:00:00.000Z",
      early: true,
      onWatchList: true,
    });
    expect(merged[0].sources).toEqual(["linkedin", "greenhouse", "simplify"]);
  });

  it("keys roles on company and title, ignoring suffixes", () => {
    expect(roleKey({ company: "Scale AI", title: "FDE (New Grad) - NYC" })).toBe(roleKey({ company: "scale", title: "FDE" }));
    const noSource = dedupeJobs([job({ id: "a" }), job({ id: "b", description: "Text" })]);
    expect(noSource[0]).toMatchObject({ id: "a", description: "Text" });
  });
});

describe("scanAllSources", () => {
  const context = { resumeText: "Python, Go, Kubernetes. B.S. expected 2027", locationId: "nyc" };

  it("combines every source, scores each role, and reports counts", async () => {
    const result = await scanAllSources(context, {
      scanners: {
        watchlist: async () => ({
          jobs: [job({ id: "gh-1", source: "greenhouse", description: "Python and Go on Kubernetes. New grad." })],
          failed: ["Ramp"],
        }),
        simplify: async () => [job({ id: "s-1", company: "Acme", source: "simplify", postedAt: "2026-09-29T00:00:00.000Z" })],
        linkedin: async () => {
          throw new Error("LinkedIn did not answer (rate limited)");
        },
      },
    });
    expect(result.jobs.map((item) => item.id)).toEqual(["s-1", "gh-1"]);
    expect(result.jobs.every((item) => item.fit?.basis === "rules" && item.fitScore)).toBe(true);
    expect(result.sources).toEqual([
      expect.objectContaining({ id: "watchlist", count: 1, error: "No answer from Ramp" }),
      expect.objectContaining({ id: "simplify", count: 1 }),
      expect.objectContaining({ id: "linkedin", count: 0, error: "LinkedIn did not answer (rate limited)" }),
    ]);
  });

  it("keeps going when the watch list fails outright", async () => {
    const result = await scanAllSources(context, {
      scanners: {
        watchlist: async () => {
          throw "down";
        },
        simplify: async () => [],
        linkedin: async () => [],
      },
    });
    expect(result.jobs).toEqual([]);
    expect(result.sources[0]).toMatchObject({ id: "watchlist", error: "Did not answer" });
  });
});
