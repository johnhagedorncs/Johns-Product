import { describe, expect, it, vi, beforeEach } from "vitest";

const { loadFitScores, saveFitScores } = vi.hoisted(() => ({
  loadFitScores: vi.fn(async () => ({})),
  saveFitScores: vi.fn(async () => undefined),
}));

vi.mock("@/lib/fit-scores-store.server", () => ({
  loadFitScores,
  saveFitScores,
}));

vi.mock("@/lib/ai/client", () => ({
  hasOpenAIConfig: vi.fn(() => true),
}));

vi.mock("@/lib/scan-boards", () => ({
  scanLiveBoards: vi.fn(async () => [
    {
      id: "cursor-new-grad-2027",
      company: "Cursor",
      title: "New Grad",
      location: "New York, NY",
      tier: "A",
      jobUrl: "https://example.com/cursor",
      postedAt: "2026-03-29T00:00:00.000Z",
      teamHint: "product",
      requirements: [],
      description: "Build the editor.",
    },
    {
      id: "sierra-swe-agent-ng-2027",
      company: "Sierra",
      title: "SWE Agent",
      location: "New York, NY",
      tier: "A",
      jobUrl: "https://example.com/sierra",
      postedAt: "2026-03-28T00:00:00.000Z",
      teamHint: "agents",
      requirements: [],
      description: "Agent platform.",
    },
    {
      id: "palantir-fdse-ng",
      company: "Palantir",
      title: "FDSE",
      location: "New York, NY",
      tier: "B",
      jobUrl: "https://example.com/palantir",
      postedAt: "2026-03-27T00:00:00.000Z",
      teamHint: "deployed",
      requirements: [],
      description: "Forward deployed.",
    },
  ]),
}));

vi.mock("@/lib/ai/score-fit", () => ({
  scoreFit: vi.fn(async () => ({
    score: 4,
    reasons: ["r1", "r2", "r3"],
    gaps: [],
    redFlags: ["Clearance required"],
    action: "apply_and_outreach",
  })),
}));

describe("board-scan-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFitScores.mockResolvedValue({});
  });

  it("scores jobs missing fit and returns merged list", async () => {
    const { runBoardScanWithFitScoring } = await import(
      "@/lib/board-scan-pipeline"
    );
    const result = await runBoardScanWithFitScoring();
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.scoredJobIds.length).toBe(result.jobs.length);
    expect(result.jobs[0].fitScore).toBe(4);
    const { scoreFit } = await import("@/lib/ai/score-fit");
    expect(vi.mocked(scoreFit).mock.calls[0][0].description).toContain("editor");
  });

  it("does not rescore jobs already in store", async () => {
    const { scoreFit } = await import("@/lib/ai/score-fit");
    loadFitScores.mockResolvedValueOnce({
      "cursor-new-grad-2027": {
        score: 5,
        reasons: ["a", "b", "c"],
        gaps: [],
        redFlags: [],
        action: "apply_now",
      },
    });
    const { runBoardScanWithFitScoring } = await import(
      "@/lib/board-scan-pipeline"
    );
    const result = await runBoardScanWithFitScoring();
    expect(result.scoredJobIds.length).toBe(2);
    expect(vi.mocked(scoreFit)).toHaveBeenCalledTimes(2);
    const cursor = result.jobs.find((j) => j.id === "cursor-new-grad-2027");
    expect(cursor?.fitScore).toBe(5);
  });

  it("does not save when nothing new to score", async () => {
    loadFitScores.mockResolvedValueOnce({
      "cursor-new-grad-2027": {
        score: 5,
        reasons: ["a", "b", "c"],
        gaps: [],
        redFlags: [],
        action: "apply_now",
      },
      "sierra-swe-agent-ng-2027": {
        score: 5,
        reasons: ["a", "b", "c"],
        gaps: [],
        redFlags: [],
        action: "apply_now",
      },
      "palantir-fdse-ng": {
        score: 5,
        reasons: ["a", "b", "c"],
        gaps: [],
        redFlags: [],
        action: "apply_now",
      },
    });
    const { runBoardScanWithFitScoring } = await import(
      "@/lib/board-scan-pipeline"
    );
    const result = await runBoardScanWithFitScoring();
    expect(result.scoredJobIds).toHaveLength(0);
    expect(saveFitScores).not.toHaveBeenCalled();
  });

  it("skips scoring when OpenAI config missing", async () => {
    const { hasOpenAIConfig } = await import("@/lib/ai/client");
    vi.mocked(hasOpenAIConfig).mockReturnValueOnce(false);
    const { runBoardScanWithFitScoring } = await import(
      "@/lib/board-scan-pipeline"
    );
    const result = await runBoardScanWithFitScoring();
    expect(result.skippedReason).toBe("missing_openai_config");
    expect(result.scoredJobIds).toHaveLength(0);
  });
});
