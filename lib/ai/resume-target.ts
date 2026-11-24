import "server-only";

import { z } from "zod";
import { parseStructuredResponse } from "@/lib/ai/client";
import { normalizeTarget, type ResumeTarget } from "@/lib/target";

const TargetSchema = z.object({
  name: z.string(),
  roles: z.array(z.string()).min(1).max(5),
  titleTerms: z.array(z.string()).min(1).max(12),
  level: z.enum(["entry", "experienced"]),
  years: z.number(),
});

/** Reads a resume (any language) and returns what jobs this person should be searching for. */
export async function readResumeTarget(resumeText: string): Promise<ResumeTarget | null> {
  const parsed = await parseStructuredResponse({
    modelTier: "fast",
    schema: TargetSchema,
    schemaName: "resume_target",
    input: `Read this resume. It may be in any language; answer in English. Decide what jobs this person should search for next, based on their actual work experience, skills and education — not on what's fashionable.

Return:
- name: the candidate's full name as written at the top ("" if missing).
- roles: 2–4 job titles to type into a job search, lowercase, most likely first (e.g. "data analyst", "business intelligence analyst"). Match their real field and seniority; don't add "senior" unless they have 5+ years.
- titleTerms: 4–10 lowercase words or short phrases that appear in the titles of jobs that fit them (e.g. "data analyst", "business analyst", "analytics", "business intelligence", "bi"). A job title matches if it contains any term, so be specific: prefer "data analyst" over "analyst" (which also matches actuarial and credit roles), and avoid generic words like "associate", "specialist", "insights" or "reporting" on their own.
- level: "entry" if they are a student or have under 2 years of full-time work, else "experienced".
- years: full-time years of work experience (internships don't count; 0 for students).

Resume:
"""
${resumeText.slice(0, 9000)}
"""`,
  });
  return normalizeTarget(parsed);
}
