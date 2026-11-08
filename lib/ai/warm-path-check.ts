import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, hasOpenAIConfig, resolveModel } from "@/lib/ai/client";
import { NEEDS_PROOF, pathsWithPeople, quoteProves, uncheckedPaths, type WarmPath } from "@/lib/warm-paths";

const ProofSchema = z.object({
  proofs: z.array(z.object({ id: z.string(), profileUrl: z.string(), quote: z.string() })),
});

const memory = new Map<string, boolean>();

function cacheKey(path: WarmPath): string {
  return `v4|${path.checkQuery}`;
}

/** "https://uk.linkedin.com/in/Jane-Doe/?x" → "jane-doe"; null for anything that is not a profile. */
export function profileSlug(url: string): string | null {
  const match = url.trim().match(/^https?:\/\/(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([^/?#\s]+)/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
}

export function warmPathCheckPrompt(paths: WarmPath[]): string {
  const lines = paths
    .map((path) => `- id: ${path.id}\n  looking for: ${path.label}\n  search: ${path.checkQuery}`)
    .join("\n");
  return `For each people search below, run a web search for public LinkedIn profiles.

${lines}

For each id, find ONE real person who currently works at the company AND matches "looking for" (went to that school, belongs to that group, or used to work at that employer).
- profileUrl: their linkedin.com/in/... URL, copied exactly from a search result.
- quote: excerpts copied exactly from that ONE search result's title and snippet, joined with " … ": one excerpt showing where they work now (must name the company) and one showing the school, group, or past employer. LinkedIn result titles usually read "Name - Title - Company | LinkedIn", so include the title.
If no single search result shows both, try another result; if none does, return an empty profileUrl and quote. Never guess, combine results, or invent anything.`;
}

type SearchResponse = {
  output?: Array<{
    type: string;
    action?: { sources?: Array<{ url?: string }> };
    content?: Array<{ annotations?: Array<{ type: string; url?: string }> }>;
  }>;
};

/** Profile slugs the web search actually returned or cited. */
export function searchedProfiles(response: SearchResponse): Set<string> {
  const slugs = new Set<string>();
  const add = (url?: string) => {
    const slug = url ? profileSlug(url) : null;
    if (slug) slugs.add(slug);
  };
  for (const item of response.output ?? []) {
    for (const source of item.action?.sources ?? []) add(source.url);
    for (const part of item.content ?? []) {
      for (const note of part.annotations ?? []) if (note.type === "url_citation") add(note.url);
    }
  }
  return slugs;
}

/**
 * Keep a school, group, or past-employer path only when web search turns up a
 * real profile behind it: the URL must be one the search returned, and the
 * quoted result must name both the company and the tie. Without a model key
 * nothing can be checked, so those paths show flagged as unverified.
 */
export async function warmPathsThatHit(paths: WarmPath[]): Promise<WarmPath[]> {
  const checking = paths.filter((path) => NEEDS_PROOF.has(path.kind));
  if (checking.length === 0) return paths;
  if (!hasOpenAIConfig()) return uncheckedPaths(paths);

  const pending = checking.filter((path) => !memory.has(cacheKey(path)));
  // One search per tie: batching them gave each only a couple of results.
  await Promise.all(
    pending.map(async (path) => {
      const openai = getOpenAIClient();
      const response = await openai.responses.parse({
        model: resolveModel("fast"),
        tools: [{ type: "web_search", search_context_size: "high" }],
        include: ["web_search_call.action.sources"],
        input: warmPathCheckPrompt([path]),
        text: { format: zodTextFormat(ProofSchema, "warm_path_proofs") },
      });
      const searched = searchedProfiles(response as SearchResponse);
      const proof = response.output_parsed?.proofs?.find((item) => item.id === path.id) ?? response.output_parsed?.proofs?.[0];
      const slug = proof ? profileSlug(proof.profileUrl) : null;
      const inSearch = Boolean(slug && searched.has(slug));
      const quoteOk = Boolean(proof && quoteProves(proof.quote, path.proofTerms));
      memory.set(cacheKey(path), inSearch && quoteOk);
      console.info(
        `[warm-path-check] ${path.id} slug=${slug ?? "-"} inSearch=${inSearch} quoteOk=${quoteOk} searched=${searched.size} quote=${JSON.stringify((proof?.quote ?? "").slice(0, 120))}`
      );
    })
  );

  const found: Record<string, boolean> = {};
  for (const path of checking) found[path.id] = memory.get(cacheKey(path)) === true;
  return pathsWithPeople(paths, found);
}
