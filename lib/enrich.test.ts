import { describe, expect, it } from "vitest";
import { applyEnrichment, chunk, pickForEnrichment } from "@/lib/enrich";
import type { Job, JobFitResult } from "@/lib/types";

const fit = (score: number, basis: "rules" | "ai" = "rules"): JobFitResult => ({
  score,
  reasons: [],
  gaps: [],
  redFlags: [],
  action: "apply_now",
  basis,
});

function job(id: string, score: number, overrides: Partial<Job> = {}): Job {
  return {
    id,
    company: "Co",
    title: "SWE",
    location: "NYC",
    tier: "A",
    jobUrl: "https://x",
    postedAt: "2026-09-29T00:00:00.000Z",
    teamHint: "",
    requirements: [],
    fitScore: score,
    fit: fit(score),
    ...overrides,
  };
}

describe("pickForEnrichment", () => {
  const jobs = [
    job("low", 2),
    job("mid", 3, { postedAt: "2026-09-20T00:00:00.000Z" }),
    job("mid-new", 3, { description: "has text" }),
    job("top", 5),
    job("done", 5, { fit: fit(5, "ai") }),
    job("hidden", 5),
    job("unscored", 0, { fitScore: undefined, fit: undefined }),
  ];

  it("picks unread, visible roles with the best rule scores first", () => {
    expect(pickForEnrichment(jobs, new Set(["hidden"]), 10).map((item) => item.id)).toEqual(["top", "mid-new", "mid"]);
    expect(pickForEnrichment(jobs, new Set(), 1).map((item) => item.id)).toEqual(["top"]);
    expect(pickForEnrichment(jobs, new Set(), 10, { minRuleScore: 0 })).toHaveLength(6);
  });

  it("only fetches missing text when no model is available", () => {
    expect(pickForEnrichment(jobs, new Set(["hidden"]), 10, { aiAvailable: false }).map((item) => item.id)).toEqual([
      "top",
      "done",
      "mid",
    ]);
  });
});

describe("applyEnrichment", () => {
  it("merges new text, applicants, and fit into the matching roles", () => {
    const [updated, untouched] = applyEnrichment(
      [job("a", 3, { description: "old" }), job("b", 4)],
      [{ id: "a", applicants: "65 applicants", fit: fit(5, "ai") }]
    );
    expect(updated).toMatchObject({ description: "old", applicants: "65 applicants", fitScore: 5 });
    expect(updated.fit?.basis).toBe("ai");
    expect(untouched.fitScore).toBe(4);
    expect(applyEnrichment([job("a", 3)], [{ id: "a", description: "new", fit: fit(2) }])[0].description).toBe("new");
  });

  it("splits work into request-sized chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
