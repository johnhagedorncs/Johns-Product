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
    url: "https://www.linkedin.com/search/results/people/?company=x",
    checkQuery: query,
  };
}

const team = path("function:swe", "site:linkedin.com/in team", "function");

describe("warmPathsThatHit", () => {
  beforeEach(() => {
    parse.mockReset();
    state.configured = true;
  });

  it("shows ties flagged unverified when the model is not configured", async () => {
    state.configured = false;
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    const tie = path("employer:none", `site:linkedin.com/in none-${Date.now()}`);
    await expect(warmPathsThatHit([tie, team])).resolves.toEqual([{ ...tie, unverified: true }, team]);
    expect(parse).not.toHaveBeenCalled();
  });

  it("keeps a tie only when the model returns a real profile URL", async () => {
    const found = path("employer:found", `site:linkedin.com/in found-${Date.now()}`);
    const empty = path("employer:empty", `site:linkedin.com/in empty-${Date.now()}`);
    const fake = path("school:fake", `site:linkedin.com/in fake-${Date.now()}`, "school");
    const missing = path("group:missing", `site:linkedin.com/in missing-${Date.now()}`, "group");
    parse.mockResolvedValue({
      output_parsed: {
        proofs: [
          { id: found.id, profileUrl: "https://www.linkedin.com/in/jane-doe-123" },
          { id: empty.id, profileUrl: "" },
          { id: fake.id, profileUrl: "https://example.com/in/someone" },
        ],
      },
    });
    const { warmPathsThatHit, warmPathCheckPrompt } = await import("@/lib/ai/warm-path-check");
    const visible = await warmPathsThatHit([found, empty, fake, missing, team]);
    expect(visible.map((item) => item.id)).toEqual(["employer:found", "function:swe"]);
    expect(warmPathCheckPrompt([found])).toContain(found.checkQuery);
    expect(parse).toHaveBeenCalledOnce();
  });

  it("hides ties when the model returns nothing", async () => {
    parse.mockResolvedValue({ output_parsed: null });
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    const item = path("school:blank", `site:linkedin.com/in blank-${Date.now()}`, "school");
    await expect(warmPathsThatHit([item])).resolves.toEqual([]);
  });

  it("reuses a confirmed hit without searching again", async () => {
    const hit = path("school:cached", `site:linkedin.com/in cached-${Date.now()}`, "school");
    parse.mockResolvedValue({
      output_parsed: { proofs: [{ id: hit.id, profileUrl: "https://linkedin.com/in/pat" }] },
    });
    const { warmPathsThatHit } = await import("@/lib/ai/warm-path-check");
    await expect(warmPathsThatHit([hit])).resolves.toEqual([hit]);
    await warmPathsThatHit([hit]);
    expect(parse).toHaveBeenCalledOnce();
    await expect(warmPathsThatHit([])).resolves.toEqual([]);
  });
});
