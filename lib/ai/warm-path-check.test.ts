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

function path(id: string, query: string, kind: WarmPath["kind"] = "employer"): WarmPath {
  return {
    id,
    kind,
    label: id,
    why: "shared",
    points: 2,
    linkedinUrl: "https://www.linkedin.com/search/results/people/?keywords=x",
    googleUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    scoped: false,
  };
}

describe("warmPathsThatHit", () => {
  beforeEach(() => {
    parse.mockReset();
    state.configured = true;
  });

  it("keeps every path when the model is not configured", async () => {
    state.configured = false;
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    const paths = [path("employer:none", "site:linkedin.com/in empty-company-xyz")];
    await expect(warmPathsThatHit(paths)).resolves.toEqual(paths);
    expect(parse).not.toHaveBeenCalled();
  });

  it("drops searches with no profiles and keeps an unchecked one", async () => {
    parse.mockResolvedValue({
      output_parsed: {
        hits: [
          { id: "employer:empty", hasResults: false },
          { id: "employer:empty", hasResults: true },
          { id: "missing", hasResults: false },
        ],
      },
    });
    const { warmPathsThatHit, warmPathCheckPrompt } = await import("@/lib/ai/warm-path-check");
    const empty = path("employer:empty", `site:linkedin.com/in "BrightAI" "No Such Co ${Date.now()}"`);
    const unknown = path("employer:keep", `site:linkedin.com/in UCSB keep-${Date.now()}`);
    const school = path("school:ucsb", `site:linkedin.com/in school-${Date.now()}`, "school");
    const visible = await warmPathsThatHit([empty, unknown, school]);
    expect(visible.map((item) => item.id).sort()).toEqual(["employer:keep", "school:ucsb"]);
    expect(warmPathCheckPrompt([empty])).toContain("BrightAI");
    expect(parse).toHaveBeenCalledOnce();
  });

  it("keeps paths when the model returns nothing", async () => {
    parse.mockResolvedValue({ output_parsed: null });
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    const item = path("school:blank", `site:linkedin.com/in blank-${Date.now()}`);
    await expect(warmPathsThatHit([item])).resolves.toEqual([item]);
  });

  it("reuses a confirmed hit without searching again", async () => {
    const hit = path("school:cached", `site:linkedin.com/in cached-${Date.now()}`);
    parse.mockResolvedValue({
      output_parsed: { hits: [{ id: hit.id, hasResults: true }] },
    });
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    await warmPathsThatHit([hit]);
    await warmPathsThatHit([hit]);
    expect(parse).toHaveBeenCalledOnce();
    await expect(warmPathsThatHit([])).resolves.toEqual([]);
  });
});
