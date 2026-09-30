import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, resolveModel } from "@/lib/ai/client";
import { acceptFoundPeople, type RolePerson } from "@/lib/people";
import { hookLabels, resumeHooks } from "@/lib/resume-hooks";
import type { Profile } from "@/lib/profile";
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

function cacheKey(job: Job, hooks: string[]): string {
  return `${job.company.trim().toLowerCase()}|${job.title.trim().toLowerCase()}|${hooks.join(",").toLowerCase()}`;
}

function prompt(job: Job, profile: Profile, hooks: string[]): string {
  return `Find real people at this company the candidate can connect with because of something on their resume. Search the public web. Return JSON only.

Candidate:
${profile.name}. ${profile.location}.

Resume connections to match (school is one example; also match shared employers and groups):
${hooks.join(", ")}

Role:
${job.company} — ${job.title}
${job.location}
${(job.description || "").slice(0, 2500)}

Rules:
- Up to 5 people who work at ${job.company} now.
- Each person must share at least one resume connection above. School alumni are the first example. Also include a former coworker or someone in the same group when you can verify it.
- Do not include someone only because they work at ${job.company}, sit in ${job.location}, or are a recruiter with no shared resume connection.
- why must name the shared connection using one of: ${hooks.join(", ")}.
- Every person needs a full first and last name and a real public profile or staff-page URL (https).
- Skip titles, teams, and anyone whose last name you cannot find.
- Do not invent names, employers, or URLs. If nobody shares a resume connection, return an empty list.`;
}

export async function findConnectablePeople(
  job: Job,
  profile: Profile,
  resumeText: string
): Promise<{ hooks: string[]; people: RolePerson[] }> {
  const hooks = hookLabels(resumeHooks(resumeText));
  if (hooks.length === 0) return { hooks, people: [] };

  const key = cacheKey(job, hooks);
  const cached = memory.get(key);
  if (cached) return { hooks, people: cached };

  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: resolveModel("smart"),
    tools: [{ type: "web_search", search_context_size: "low" }],
    input: prompt(job, profile, hooks),
    text: { format: zodTextFormat(FoundPeopleSchema, "connectable_people") },
  });
  const people = acceptFoundPeople(response.output_parsed?.people ?? [], hooks);
  memory.set(key, people);
  return { hooks, people };
}
