import { beforeEach, describe, expect, it, vi } from "vitest";
import { ruleFit } from "@/lib/fit";
import { getProfile } from "@/lib/profile";
import type { Job } from "@/lib/types";

vi.mock("server-only", () => ({}));

const parseStructuredResponse = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  parseStructuredResponse,
}));

const resume = "Python, Kubernetes, PyTorch. B.S. Computer Engineering, expected June 2027.";

const job: Job = {
  id: "x",
  company: "Co",
  title: "Software Engineer, New Grad",
  location: "New York, NY",
  tier: "A",
  jobUrl: "https://example.com",
  postedAt: "2026-01-01T00:00:00.000Z",
  teamHint: "eng",
  requirements: [],
  description: "Build APIs in Python and Rust. 1+ years of experience.",
};

describe("scoreFit", () => {
  beforeEach(() => parseStructuredResponse.mockReset());

  it("sends the resume, the posting, and the rule findings to the fast model", async () => {
    parseStructuredResponse.mockResolvedValue({ score: 4, reasons: ["a"], gaps: [], redFlags: [] });
    const { scoreFit } = await import("@/lib/ai/score-fit");
    const rules = ruleFit(job, { resumeText: resume, locationId: "nyc" });
    const result = await scoreFit(job, getProfile(), resume, rules);
    expect(result.score).toBe(4);
    expect(parseStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({ modelTier: "fast", schemaName: "job_fit_score" })
    );
    const input = parseStructuredResponse.mock.calls[0][0].input as string;
    expect(input).toContain(resume);
    expect(input).toContain("Build APIs in Python and Rust.");
    expect(input).toContain("Skills on both: Python");
    expect(input).toContain("Skills in posting, not on resume: Rust");
    expect(input).toContain("[good] Level: Posted as new grad / early career");
  });

  it("says when there is no description or rule detail", async () => {
    parseStructuredResponse.mockResolvedValue({ score: 2, reasons: ["a"], gaps: [], redFlags: [] });
    const { buildFitPrompt } = await import("@/lib/ai/score-fit");
    const input = buildFitPrompt(
      { ...job, description: undefined, teamHint: "" },
      getProfile(),
      resume,
      { score: 3, reasons: [], gaps: [], redFlags: [], action: "apply_and_outreach" }
    );
    expect(input).toContain("No description available");
    expect(input).toContain("Team: n/a");
    expect(input).toContain("- none");
    expect(input).toContain("Skills on both: none");
  });
});
