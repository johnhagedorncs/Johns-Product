import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, resolveModel } from "@/lib/ai/client";

/** Who to read up on: what the email lookup returned. */
export type ResearchTarget = { name: string; title: string; company: string; linkedinUrl: string };

const ProfileSchema = z.object({
  found: z.boolean(),
  profile: z.string(),
});

const RESEARCH_TIMEOUT_MS = 30_000;
const PROFILE_MAX = 2500;

export function profileResearchPrompt(target: ResearchTarget): string {
  const who = [target.name, target.title, target.company].filter(Boolean).join(", ");
  return `Look up this person's public professional background so a student can write them a personal outreach email.

Person: ${who}
${target.linkedinUrl ? `LinkedIn: ${target.linkedinUrl}` : ""}

Search the web (e.g. "${target.name}" "${target.company}" linkedin, and their LinkedIn URL), then write a short profile in plain text with these lines when the sources say so:
Headline: ...
Current role: ...
Past roles: ...
Education: ...
Notable: (projects, posts, talks, teams, career switches)

Rules:
- Only facts the search results state about THIS person (same name and ${target.company || "company"}). Never guess or fill gaps.
- Skip a line if nothing was found for it.
- Under 1500 characters.
- found = false and profile = "" if you can't confirm it's the right person.`;
}

/** A short public-profile brief from web search, or "" if nothing reliable turned up. */
export async function researchProfile(target: ResearchTarget): Promise<string> {
  const response = await getOpenAIClient().responses.parse(
    {
      model: resolveModel("fast"),
      tools: [{ type: "web_search", search_context_size: "medium" }],
      input: profileResearchPrompt(target),
      text: { format: zodTextFormat(ProfileSchema, "public_profile") },
    },
    { signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS), maxRetries: 0 }
  );
  const parsed = response.output_parsed;
  if (!parsed?.found) return "";
  return parsed.profile.trim().slice(0, PROFILE_MAX);
}
