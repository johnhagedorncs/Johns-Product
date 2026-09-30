import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const parseStructuredResponse = vi.fn();
vi.mock("@/lib/ai/client", () => ({ parseStructuredResponse }));

describe("outreach drafts", () => {
  it("tailors with the smart model", async () => {
    parseStructuredResponse.mockResolvedValueOnce({
      leadBullets: ["a", "b", "c"],
      rewordings: [],
      missingKeywords: ["Kubernetes"],
    });
    const { tailorResume } = await import("@/lib/ai/tailor-resume");
    const result = await tailorResume(
      {
        id: "j",
        company: "Co",
        title: "SWE",
        location: "NYC",
        tier: "A",
        jobUrl: "https://example.com",
        postedAt: "2026-01-01T00:00:00.000Z",
        teamHint: "",
        requirements: [],
      },
      {
        name: "John",
        summary: "s",
        school: "UCSB",
        fraternity: "ZBT",
        location: "NYC",
        targetRoles: [],
        proofPoints: [],
        pitch: "p",
      },
      "Resume body"
    );
    expect(result.missingKeywords).toEqual(["Kubernetes"]);
    const { readResumeText } = await import("@/lib/ai/tailor-resume");
    expect(await readResumeText()).toMatch(/BrightAI/);
    expect(parseStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({ modelTier: "smart" })
    );
  });

  it("clamps linkedin drafts", async () => {
    parseStructuredResponse.mockResolvedValueOnce({
      personName: "Maya Lin",
      rankReason: "UCSB",
      connectionNote: "x".repeat(400),
      email: "One. Two. Three. Four. Five. Six. Seven.",
      coffeeQuestions: ["q1", "q2", "q3", "q4", "q5"],
    });
    const { draftFromLinkedInPaste } = await import("@/lib/ai/linkedin-draft");
    const draft = await draftFromLinkedInPaste(
      {
        id: "j",
        company: "Co",
        title: "SWE",
        location: "NYC",
        tier: "A",
        jobUrl: "https://example.com",
        postedAt: "2026-01-01T00:00:00.000Z",
        teamHint: "",
        requirements: [],
      },
      {
        name: "John",
        summary: "s",
        school: "UCSB",
        fraternity: "ZBT",
        location: "NYC",
        targetRoles: [],
        proofPoints: [],
        pitch: "p",
      },
      "Headline: SWE"
    );
    expect(draft.connectionNote).toHaveLength(300);
    expect(draft.coffeeQuestions).toHaveLength(5);
  });
});
