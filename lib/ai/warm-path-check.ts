import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, hasOpenAIConfig, resolveModel } from "@/lib/ai/client";
import { pathsWithLinkedInResults, type WarmPath } from "@/lib/warm-paths";

const HitSchema = z.object({
  hits: z.array(z.object({ id: z.string(), hasResults: z.boolean() })),
});

const memory = new Map<string, boolean>();

function cacheKey(path: WarmPath): string {
  return `v2|${path.googleUrl}`;
}

function searchQuery(path: WarmPath): string {
  return new URL(path.googleUrl).searchParams.get("q") ?? path.label;
}

export function warmPathCheckPrompt(paths: WarmPath[]): string {
  const lines = paths.map((path) => `- id: ${path.id}\n  search: ${searchQuery(path)}`).join("\n");
  return `For each people search below, run a web search for public LinkedIn profiles (linkedin.com/in).

${lines}

Return a hit only for a search you are sure has zero matching profiles, with hasResults false. Omit every search that has at least one matching profile, and omit any search you are not sure about.`;
}

const CHECKED_KINDS = new Set<WarmPath["kind"]>(["employer", "group"]);

export async function warmPathsThatHit(paths: WarmPath[]): Promise<WarmPath[]> {
  const checking = paths.filter((path) => CHECKED_KINDS.has(path.kind));
  const kept = paths.filter((path) => !CHECKED_KINDS.has(path.kind));
  if (checking.length === 0 || !hasOpenAIConfig()) return paths;

  const pending = checking.filter((path) => !memory.has(cacheKey(path)));
  if (pending.length > 0) {
    const openai = getOpenAIClient();
    const response = await openai.responses.parse({
      model: resolveModel("fast"),
      tools: [{ type: "web_search", search_context_size: "low" }],
      input: warmPathCheckPrompt(pending),
      text: { format: zodTextFormat(HitSchema, "warm_path_hits") },
    });
    const seen = new Set<string>();
    for (const hit of response.output_parsed?.hits ?? []) {
      const path = checking.find((item) => item.id === hit.id);
      if (!path || seen.has(path.id)) continue;
      seen.add(path.id);
      memory.set(cacheKey(path), hit.hasResults);
    }
  }

  const flags: Record<string, boolean> = {};
  for (const path of checking) {
    const hit = memory.get(cacheKey(path));
    if (hit !== undefined) flags[path.id] = hit;
  }
  return [...pathsWithLinkedInResults(checking, flags), ...kept].sort((a, b) => b.points - a.points);
}
