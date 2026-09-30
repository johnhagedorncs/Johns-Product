import { describe, expect, it } from "vitest";
import { rememberScan } from "@/lib/scan-cache";
import {
  getJobById,
  getJobByUrl,
  getOutreachForJob,
  groupJobsByTier,
  hoursSincePosted,
  isFreshPosting,
  relativePosted,
  shouldApplyToday,
  sortJobs,
} from "@/lib/jobs";
import { clampConnectionNote, clampEmail, initials } from "@/lib/draft-text";

describe("jobs helpers", () => {
  it("finds a cached job by url", () => {
    rememberScan([
      {
        id: "cursor-1",
        company: "Cursor",
        title: "SWE",
        location: "NYC",
        tier: "A",
        jobUrl: "https://example.com/cursor",
        postedAt: "2026-03-29T00:00:00.000Z",
        teamHint: "",
        requirements: [],
      },
    ]);
    expect(getJobByUrl("https://example.com/cursor")?.company).toBe("Cursor");
    expect(getJobById("cursor-1")?.title).toBe("SWE");
    expect(getOutreachForJob("cursor-new-grad-2027").length).toBeGreaterThan(1);
    expect(getOutreachForJob("missing")).toEqual([]);
    const grouped = groupJobsByTier([
      {
        id: "a",
        company: "A",
        title: "SWE",
        location: "NYC",
        tier: "A",
        jobUrl: "https://a.example",
        postedAt: "2026-01-01T00:00:00.000Z",
        teamHint: "",
        requirements: [],
      },
      {
        id: "b",
        company: "B",
        title: "SWE",
        location: "NYC",
        tier: "B",
        jobUrl: "https://b.example",
        postedAt: "2026-01-01T00:00:00.000Z",
        teamHint: "",
        requirements: [],
      },
    ]);
    expect(grouped.A).toHaveLength(1);
    expect(grouped.C).toHaveLength(0);
  });

  it("should apply today when fit >= 3", () => {
    expect(shouldApplyToday(3)).toBe(true);
    expect(shouldApplyToday(2)).toBe(false);
    expect(shouldApplyToday(undefined)).toBe(false);
  });

  it("computes hours and relative labels", () => {
    const posted = "2026-03-29T00:00:00.000Z";
    const now = new Date("2026-03-29T14:00:00.000Z").getTime();
    expect(hoursSincePosted(posted, now)).toBe(14);
    expect(relativePosted(posted, now)).toBe("14h ago");
    expect(isFreshPosting(posted, now)).toBe(true);
    expect(relativePosted(posted, new Date(posted).getTime() + 1000)).toBe(
      "just now"
    );
  });

  it("marks posts older than 48h as not fresh", () => {
    const posted = "2026-03-01T00:00:00.000Z";
    const now = new Date("2026-03-04T00:00:00.000Z").getTime();
    expect(isFreshPosting(posted, now)).toBe(false);
    expect(relativePosted(posted, now)).toBe("3d ago");
  });
});

describe("draft text", () => {
  it("caps connection notes at 300 characters", () => {
    expect(clampConnectionNote("a".repeat(400))).toHaveLength(300);
  });

  it("keeps at most six email sentences", () => {
    const email = "One. Two. Three. Four. Five. Six. Seven.";
    expect(clampEmail(email).split(". ").length).toBe(6);
  });

  it("builds initials", () => {
    expect(initials("Maya Lin")).toBe("ML");
    expect(initials(" ")).toBe("?");
  });
});

describe("sortJobs", () => {
  const older = {
    id: "old",
    company: "A",
    title: "SWE",
    location: "NYC",
    tier: "A" as const,
    jobUrl: "https://a.example",
    postedAt: "2026-03-01T00:00:00.000Z",
    teamHint: "",
    requirements: [],
    fitScore: 5,
  };
  const newer = {
    ...older,
    id: "new",
    postedAt: "2026-03-20T00:00:00.000Z",
    fitScore: 3,
  };
  const unscored = {
    ...older,
    id: "none",
    postedAt: "2026-03-25T00:00:00.000Z",
    fitScore: undefined,
  };

  it("ranks by fit, then newer posts", () => {
    const sorted = sortJobs([newer, unscored, older], "match");
    expect(sorted.map((job) => job.id)).toEqual(["old", "new", "none"]);
  });

  it("ranks by post date", () => {
    const sorted = sortJobs([older, newer], "posted");
    expect(sorted.map((job) => job.id)).toEqual(["new", "old"]);
  });
});
