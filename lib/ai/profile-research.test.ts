import { beforeEach, describe, expect, it, vi } from "vitest";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/client", () => ({
  getOpenAIClient: () => ({ responses: { parse } }),
  resolveModel: () => "gpt-4o-mini",
}));

const target = {
  name: "Elai Ronen",
  title: "Business Development Representative",
  company: "Adobe",
  linkedinUrl: "https://www.linkedin.com/in/elai-ronen",
};

describe("researchProfile", () => {
  beforeEach(() => parse.mockReset());

  it("searches the web for this person and returns the brief", async () => {
    parse.mockResolvedValueOnce({ output_parsed: { found: true, profile: "  Headline: BDR at Adobe  " } });
    const { researchProfile } = await import("@/lib/ai/profile-research");
    expect(await researchProfile(target)).toBe("Headline: BDR at Adobe");
    const [request] = parse.mock.calls[0];
    expect(request.tools[0].type).toBe("web_search");
    expect(request.input).toContain("Elai Ronen");
    expect(request.input).toContain("linkedin.com/in/elai-ronen");
  });

  it("returns nothing when it can't confirm the person", async () => {
    parse.mockResolvedValueOnce({ output_parsed: { found: false, profile: "Some other Elai" } });
    const { researchProfile } = await import("@/lib/ai/profile-research");
    expect(await researchProfile(target)).toBe("");
  });
});
