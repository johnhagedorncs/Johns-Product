import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, hasOpenAIConfig, resolveModel } from "@/lib/ai/client";
import { NEEDS_PROOF, pathsWithPeople, uncheckedPaths, type WarmPath } from "@/lib/warm-paths";

const ProofSchema = z.object({
  proofs: z.array(z.object({ id: z.string(), profileUrl: z.string() })),
});

const memory = new Map<string, boolean>();

function cacheKey(path: WarmPath): string {
  return `v3|${path.checkQuery}`;
}

const PROFILE_URL = /^https?:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/in\/[^/?#\s]+/i;

export function warmPathCheckPrompt(paths: WarmPath[]): string {
  const lines = paths
    .map((path) => `- id: ${path.id}\n  looking for: ${path.label}\n  search: ${path.checkQuery}`)
    .join("\n");
  return `For each people search below, run a web search for public LinkedIn profiles.

${lines}

For each id, return profileUrl: the linkedin.com/in/... URL of ONE real person who currently works at the company AND matches "looking for" (went to that school, belongs to that group, or used to work at that employer), copied exactly from a search result. If you did not find such a person, return an empty string. Never guess or invent a URL.`;
}

/**
 * Keep a school, group, or past-employer path only when web search turns up a
 * real profile behind it. Without a model key nothing can be checked, so
 * they show flagged as unverified.
 */
export async function warmPathsThatHit(paths: WarmPath[]): Promise<WarmPath[]> {
  const checking = paths.filter((path) => NEEDS_PROOF.has(path.kind));
  if (checking.length === 0) return paths;
  if (!hasOpenAIConfig()) return uncheckedPaths(paths);

  const pending = checking.filter((path) => !memory.has(cacheKey(path)));
  if (pending.length > 0) {
    const openai = getOpenAIClient();
    const response = await openai.responses.parse({
      model: resolveModel("fast"),
      tools: [{ type: "web_search", search_context_size: "medium" }],
      input: warmPathCheckPrompt(pending),
      text: { format: zodTextFormat(ProofSchema, "warm_path_proofs") },
    });
    const proofs = new Map<string, string>();
    for (const proof of response.output_parsed?.proofs ?? []) {
      if (!proofs.has(proof.id)) proofs.set(proof.id, proof.profileUrl.trim());
    }
    for (const path of pending) {
      memory.set(cacheKey(path), PROFILE_URL.test(proofs.get(path.id) ?? ""));
    }
  }

  const found: Record<string, boolean> = {};
  for (const path of checking) found[path.id] = memory.get(cacheKey(path)) === true;
  return pathsWithPeople(paths, found);
}
