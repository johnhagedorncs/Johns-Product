import { describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/types";

vi.mock("server-only", () => ({}));

const parseStructuredResponse = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  parseStructuredResponse,
}));

describe("scoreFit", () => {
  it("calls structured parse with fast model tier", async () => {
    parseStructuredResponse.mockResolvedValue({
      score: 4,
      reasons: ["a", "b", "c"],
      gaps: [],
    });
    const { scoreFit } = await import("@/lib/ai/score-fit");
    const job: Job = {
      id: "x",
      company: "Co",
      title: "SWE",
      location: "NYC",
      tier: "A",
      jobUrl: "https://example.com",
      postedAt: "2026-01-01T00:00:00.000Z",
      teamHint: "eng",
      requirements: ["TS"],
      description: "Build APIs in New York.",
    };
    const result = await scoreFit(job, {
      name: "John",
      summary: "s",
      school: "UCSB",
      fraternity: "ZBT",
      location: "NYC",
      targetRoles: ["SWE"],
      proofPoints: [],
      pitch: "p",
    });
    expect(result.score).toBe(4);
    expect(parseStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({ modelTier: "fast", schemaName: "job_fit_score" })
    );
    const input = parseStructuredResponse.mock.calls[0][0].input as string;
    expect(input).toContain("Build APIs in New York.");
  });

  it("falls back when the posting has no description", async () => {
    parseStructuredResponse.mockResolvedValue({
      score: 2,
      reasons: ["a", "b", "c"],
      gaps: [],
      redFlags: [],
      action: "skip",
    });
    const { scoreFit } = await import("@/lib/ai/score-fit");
    await scoreFit(
      {
        id: "x",
        company: "Co",
        title: "SWE",
        location: "NYC",
        tier: "A",
        jobUrl: "https://example.com",
        postedAt: "2026-01-01T00:00:00.000Z",
        teamHint: "eng",
        requirements: ["TypeScript"],
      },
      {
        name: "John",
        summary: "s",
        school: "UCSB",
        fraternity: "ZBT",
        location: "NYC",
        targetRoles: ["SWE"],
        proofPoints: [],
        pitch: "p",
      }
    );
    const input = parseStructuredResponse.mock.calls.at(-1)?.[0].input as string;
    expect(input).toContain("TypeScript");
  });

  it("names a missing description", async () => {
    parseStructuredResponse.mockResolvedValue({
      score: 1,
      reasons: ["a", "b", "c"],
      gaps: [],
      redFlags: [],
      action: "skip",
    });
    const { scoreFit } = await import("@/lib/ai/score-fit");
    await scoreFit(
      {
        id: "y",
        company: "Co",
        title: "SWE",
        location: "NYC",
        tier: "A",
        jobUrl: "https://example.com",
        postedAt: "2026-01-01T00:00:00.000Z",
        teamHint: "eng",
        requirements: [],
      },
      {
        name: "John",
        summary: "s",
        school: "UCSB",
        fraternity: "ZBT",
        location: "NYC",
        targetRoles: ["SWE"],
        proofPoints: [],
        pitch: "p",
      }
    );
    const input = parseStructuredResponse.mock.calls.at(-1)?.[0].input as string;
    expect(input).toContain("No description");
  });
});
