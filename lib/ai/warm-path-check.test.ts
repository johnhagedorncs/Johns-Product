import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WarmPath } from "@/lib/warm-paths";

const { parse, state } = vi.hoisted(() => ({
  parse: vi.fn(),
  state: { configured: true },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/client", () => ({
  getOpenAIClient: () => ({ responses: { parse } }),
  resolveModel: () => "gpt-4o-mini",
  hasOpenAIConfig: () => state.configured,
}));

function path(id: string, tie: string, kind: WarmPath["kind"] = "employer"): WarmPath {
  return {
    id,
    kind,
    label: id,
    why: "shared",
    points: 2,
    url: "https://www.linkedin.com/search/results/people/?company=Deloitte",
    checkQuery: `site:linkedin.com/in Deloitte ${tie} ${Math.random()}`,
    proofTerms: { company: ["Deloitte"], tie: [tie] },
  };
}

/** A response whose web search returned these profile URLs. */
function searched(urls: string[], proofs: Array<{ id: string; profileUrl: string; quote: string }>) {
  return {
    output: [{ type: "web_search_call", action: { sources: urls.map((url) => ({ url })) } }],
    output_parsed: { proofs },
  };
}

const team = { ...path("function:swe", "software engineer", "function") };

describe("warmPathsThatHit", () => {
  beforeEach(() => {
    parse.mockReset();
    state.configured = true;
  });

  it("shows ties flagged unverified when the model is not configured", async () => {
    state.configured = false;
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    const tie = path("employer:none", "BrightAI");
    await expect(warmPathsThatHit([tie, team])).resolves.toEqual([{ ...tie, unverified: true }, team]);
    expect(parse).not.toHaveBeenCalled();
  });

  it("keeps a tie only with a searched profile and a quote naming company and tie", async () => {
    const real = path("school:ucsb", "UCSB", "school");
    const invented = path("employer:brightai", "BrightAI");
    const weakQuote = path("employer:handshake", "Handshake");
    const empty = path("group:zbt", "ZBT", "group");
    parse.mockResolvedValue(
      searched(
        ["https://www.linkedin.com/in/jane-doe", "https://uk.linkedin.com/in/sam-lee/"],
        [
          { id: real.id, profileUrl: "https://www.linkedin.com/in/Jane-Doe/", quote: "Jane Doe - Consultant - Deloitte | LinkedIn ... UCSB" },
          { id: invented.id, profileUrl: "https://www.linkedin.com/in/made-up", quote: "Deloitte, ex-BrightAI" },
          { id: weakQuote.id, profileUrl: "https://www.linkedin.com/in/sam-lee", quote: "Sam Lee - Deloitte" },
          { id: empty.id, profileUrl: "", quote: "" },
        ]
      )
    );
    const { warmPathsThatHit, warmPathCheckPrompt } = await import("@/lib/ai/warm-path-check");
    const visible = await warmPathsThatHit([real, invented, weakQuote, empty, team]);
    expect(visible.map((item) => item.id)).toEqual(["school:ucsb", "function:swe"]);
    expect(warmPathCheckPrompt([real])).toContain(real.checkQuery);
    expect(parse.mock.calls[0][0].include).toEqual(["web_search_call.action.sources"]);
  });

  it("accepts a cited profile URL as searched", async () => {
    const { searchedProfiles, profileSlug } = await import("@/lib/ai/warm-path-check");
    const slugs = searchedProfiles({
      output: [{ type: "message", content: [{ annotations: [{ type: "url_citation", url: "https://linkedin.com/in/pat?trk=x" }] }] }],
    });
    expect([...slugs]).toEqual(["pat"]);
    expect(profileSlug("https://www.linkedin.com/company/deloitte")).toBeNull();
  });

  it("hides ties when the model returns nothing, and caches the answer", async () => {
    parse.mockResolvedValue({ output_parsed: null });
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    const item = path("school:blank", "UCSB", "school");
    await expect(warmPathsThatHit([item])).resolves.toEqual([]);
    await warmPathsThatHit([item]);
    expect(parse).toHaveBeenCalledOnce();
    await expect(warmPathsThatHit([])).resolves.toEqual([]);
  });
});
