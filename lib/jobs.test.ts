import { describe, expect, it } from "vitest";
import {
  filterJobs,
  hoursSincePosted,
  isApplyToday,
  isFreshPosting,
  relativePosted,
  shouldApplyToday,
  sortJobs,
} from "@/lib/jobs";
import type { Job } from "@/lib/types";

const now = Date.parse("2026-09-30T12:00:00Z");

function job(overrides: Partial<Job>): Job {
  return {
    id: "x",
    company: "Cursor",
    title: "Software Engineer",
    location: "New York, NY",
    tier: "A",
    jobUrl: "https://x",
    postedAt: "2026-09-30T06:00:00.000Z",
    teamHint: "",
    requirements: [],
    ...overrides,
  };
}

describe("posting age", () => {
  it("formats hours and days since posting", () => {
    expect(hoursSincePosted("2026-09-30T06:00:00Z", now)).toBe(6);
    expect(hoursSincePosted("2026-10-01T00:00:00Z", now)).toBe(0);
    expect(relativePosted("2026-09-30T11:30:00Z", now)).toBe("just now");
    expect(relativePosted("2026-09-30T06:00:00Z", now)).toBe("6h ago");
    expect(relativePosted("2026-09-29T06:00:00Z", now)).toBe("1d ago");
    expect(relativePosted("2026-09-25T06:00:00Z", now)).toBe("5d ago");
    expect(isFreshPosting("2026-09-29T00:00:00Z", now)).toBe(true);
    expect(isFreshPosting("2026-09-27T00:00:00Z", now)).toBe(false);
  });

  it("says apply today only for fresh, fitting, unblocked roles", () => {
    expect(shouldApplyToday(undefined)).toBe(false);
    expect(shouldApplyToday(3)).toBe(true);
    const base = { score: 4, reasons: [], gaps: [], redFlags: [] };
    expect(isApplyToday(job({ fitScore: 4, fit: { ...base, action: "apply_now" } }), now)).toBe(true);
    expect(isApplyToday(job({ fitScore: 4, fit: { ...base, action: "skip" } }), now)).toBe(false);
    expect(isApplyToday(job({ fitScore: 4, postedAt: "2026-09-20T00:00:00Z" }), now)).toBe(false);
  });
});

describe("sortJobs", () => {
  const a = job({ id: "a", fitScore: 3, postedAt: "2026-09-29T00:00:00Z" });
  const b = job({ id: "b", fitScore: 5, postedAt: "2026-09-20T00:00:00Z" });
  const c = job({ id: "c", fitScore: 3, early: true, postedAt: "2026-09-10T00:00:00Z" });
  const d = job({ id: "d", fitScore: 3, onWatchList: true, postedAt: "2026-09-01T00:00:00Z" });
  const e = job({ id: "e", postedAt: "2026-09-30T00:00:00Z" });

  it("puts best fit first, then early career, watch list, and freshness", () => {
    expect(sortJobs([a, b, c, d, e], "match").map((item) => item.id)).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("sorts newest first", () => {
    expect(sortJobs([a, b, e], "posted").map((item) => item.id)).toEqual(["e", "a", "b"]);
  });
});

describe("filterJobs", () => {
  const jobs = [
    job({ id: "gh", fitScore: 5, source: "greenhouse", sources: ["greenhouse", "linkedin"], onWatchList: true }),
    job({ id: "li", company: "Uniswap", fitScore: 3, source: "linkedin" }),
    job({ id: "s", company: "Acme", title: "FDE", fitScore: 4, sources: ["simplify"] }),
    job({ id: "none", company: "NoFit" }),
  ];
  const all = { minFit: 0, source: "all" as const, query: "", hidden: new Set<string>() };

  it("filters by fit, source, text, and hidden ids", () => {
    expect(filterJobs(jobs, all)).toHaveLength(4);
    expect(filterJobs(jobs, { ...all, minFit: 4 }).map((item) => item.id)).toEqual(["gh", "s"]);
    expect(filterJobs(jobs, { ...all, source: "linkedin" }).map((item) => item.id)).toEqual(["gh", "li"]);
    expect(filterJobs(jobs, { ...all, source: "watchlist" }).map((item) => item.id)).toEqual(["gh"]);
    expect(filterJobs(jobs, { ...all, source: "simplify" }).map((item) => item.id)).toEqual(["s"]);
    expect(filterJobs(jobs, { ...all, query: "uniswap" }).map((item) => item.id)).toEqual(["li"]);
    expect(filterJobs(jobs, { ...all, hidden: new Set(["gh"]) })).toHaveLength(3);
  });
});
