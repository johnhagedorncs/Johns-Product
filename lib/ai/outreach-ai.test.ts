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
      "Resume body"
    );
    expect(result.missingKeywords).toEqual(["Kubernetes"]);
    expect(parseStructuredResponse.mock.calls[0][0].input).toContain("Resume body");
    expect(parseStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({ modelTier: "smart" })
    );
  });

  it("clamps linkedin drafts", async () => {
    parseStructuredResponse.mockResolvedValueOnce({
      personName: "Maya Lin",
      linkedinUrl: "",
      sharedHook: "UCSB",
      rankReason: "UCSB",
      connectionNote: "x".repeat(5000),
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
      "UCSB B.S. Computer Engineering",
      "Headline: SWE"
    );
    expect(parseStructuredResponse.mock.calls.at(-1)?.[0].input).toContain("UCSB B.S. Computer Engineering");
    expect(draft.connectionNote).toHaveLength(4000);
    expect(parseStructuredResponse.mock.calls.at(-1)?.[0].input).toContain(
      "I hope your week is going well"
    );
  });
});
