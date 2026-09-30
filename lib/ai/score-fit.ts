import "server-only";

import { z } from "zod";
import { parseStructuredResponse } from "@/lib/ai/client";
import type { Job } from "@/lib/types";
import type { Profile } from "@/lib/profile";

export const FitScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  reasons: z.array(z.string()).length(3),
  gaps: z.array(z.string()),
  redFlags: z.array(z.string()),
  action: z.enum(["apply_now", "apply_and_outreach", "skip"]),
});

export type FitScoreResult = z.infer<typeof FitScoreSchema>;

function buildFitPrompt(job: Job, profile: Profile): string {
  return `You are scoring job fit for a candidate. Return JSON only per schema.

Candidate profile:
${JSON.stringify(profile, null, 2)}

Job:
Company: ${job.company}
Title: ${job.title}
Location: ${job.location}
Team hint: ${job.teamHint}
Description:
${(job.description || job.requirements.join("; ") || "No description").slice(0, 8000)}

Rules:
- score 1-5 (5 = excellent fit for target roles and location)
- reasons: exactly 3 short bullets explaining the score
- gaps: skills or constraints missing vs the posting (empty array if none)
- redFlags: concrete blockers only — grad-date window, citizenship/clearance, minimum years of experience, on-site or relocation. Empty array if none.
- action: "apply_now" when score >= 4 and no hard blocker; "apply_and_outreach" when score >= 3 and worth a warm note; "skip" when the role is a poor fit or a hard blocker
- Penalize heavily if the job location does not match the candidate location (${profile.location})
- Favor new-grad / early-career roles matching the profile`;
}

export async function scoreFit(
  job: Job,
  profile: Profile
): Promise<FitScoreResult> {
  return parseStructuredResponse({
    modelTier: "fast",
    schema: FitScoreSchema,
    schemaName: "job_fit_score",
    input: buildFitPrompt(job, profile),
  });
}
