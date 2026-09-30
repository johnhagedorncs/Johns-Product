import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, resolveModel } from "@/lib/ai/client";
import { acceptFoundPeople, type RolePerson } from "@/lib/people";
import { hookAliases, hookLabels, resumeHooks } from "@/lib/resume-hooks";
import { searchCompanyName } from "@/lib/warm-paths";
import type { Job } from "@/lib/types";

const FoundPeopleSchema = z.object({
  people: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      why: z.string(),
      url: z.string(),
    })
  ),
});

const memory = new Map<string, RolePerson[]>();

export function peopleSearchPrompt(job: Job, hooks: string[]): string {
  const company = searchCompanyName(job.company);
  const queries = hooks
    .map((hook) => `site:linkedin.com/in "${company}" (${hookAliases(hook).map((a) => `"${a}"`).join(" OR ")})`)
    .join("\n");
  return `Find real people who work at ${company} now and share a school, past employer, or group with the candidate.

Run web searches like these (one per connection), and read the results:
${queries}

Connections to match: ${hooks.map((hook) => hookAliases(hook).join(" / ")).join("; ")}

Rules:
- Up to 6 people. Each must currently work at ${company} per the search result snippet or profile headline.
- Each must share at least one connection above — say which in "why" using the connection's name (e.g. "UCSB alum", "ex-BrightAI").
- "role" is their current title at ${company}.
- "url" is the linkedin.com/in/... profile URL from the search result, copied exactly.
- Full first and last name only. Never invent a person, title, or URL. If nobody qualifies, return an empty list.`;
}

export async function findConnectablePeople(
  job: Job,
  resumeText: string
): Promise<{ hooks: string[]; people: RolePerson[] }> {
  const hooks = hookLabels(resumeHooks(resumeText));
  if (hooks.length === 0) return { hooks, people: [] };

  const key = `${job.company.trim().toLowerCase()}|${hooks.join(",").toLowerCase()}`;
  const cached = memory.get(key);
  if (cached) return { hooks, people: cached };

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: resolveModel("smart"),
    tools: [{ type: "web_search", search_context_size: "medium" }],
    input: peopleSearchPrompt(job, hooks),
    text: { format: zodTextFormat(FoundPeopleSchema, "connectable_people") },
  });
  const people = acceptFoundPeople(response.output_parsed?.people ?? [], hooks);
  memory.set(key, people);
  return { hooks, people };
}
