import "server-only";

import { z } from "zod";
import { parseStructuredResponse } from "@/lib/ai/client";
import type { Job } from "@/lib/types";

export const TailorSchema = z.object({
  leadBullets: z.array(z.string()).length(3),
  rewordings: z.array(
    z.object({
      original: z.string(),
      suggested: z.string(),
    })
  ).max(4),
  missingKeywords: z.array(z.string()).max(8),
});

export type TailorResult = z.infer<typeof TailorSchema>;

export async function tailorResume(job: Job, resumeText: string): Promise<TailorResult> {
  return parseStructuredResponse({
    modelTier: "smart",
    schema: TailorSchema,
    schemaName: "resume_tailor",
    input: `Tailor this resume for one posting. Stay truthful: never invent employers, dates, tools, or metrics that are not on the resume.

Resume:
"""
${resumeText.slice(0, 12000)}
"""

Posting:
${job.company} — ${job.title} (${job.location})
"""
${(job.description || "").slice(0, 8000)}
"""

Return:
- leadBullets: the 3 existing resume bullets to move to the top for this posting (quote them closely, shortened).
- rewordings: up to 4 existing bullet points rewritten to mirror the posting's language. "original" must be copied from the resume. Only reword bullets — never job titles, employer names, dates, or headings — and keep every number that was in the original.
- missingKeywords: exact phrases from the posting that an ATS would look for and the resume lacks, only where the candidate plausibly has the experience.`,
  });
}
