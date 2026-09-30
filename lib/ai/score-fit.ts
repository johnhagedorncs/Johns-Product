import "server-only";

import { z } from "zod";
import { parseStructuredResponse } from "@/lib/ai/client";
import type { ModelFit } from "@/lib/fit";
import type { Profile } from "@/lib/profile";
import type { Job, JobFitResult } from "@/lib/types";

export const FitScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  reasons: z.array(z.string()).min(1).max(4),
  gaps: z.array(z.string()).max(6),
  redFlags: z.array(z.string()).max(4),
});

export function buildFitPrompt(job: Job, profile: Profile, resumeText: string, rules: JobFitResult): string {
  const checks = (rules.checks ?? []).map((check) => `- [${check.level}] ${check.label}: ${check.detail}`).join("\n");
  return `You are a blunt new-grad recruiter scoring how well THIS resume fits THIS posting. Return JSON per schema.

Candidate targets: ${profile.targetRoles.join(", ")} in ${profile.location}.

Resume:
"""
${resumeText.slice(0, 9000)}
"""

Posting:
${job.company} — ${job.title}
Location: ${job.location}
Team: ${job.teamHint || "n/a"}
"""
${(job.description || "No description available — judge from the title only and say so.").slice(0, 9000)}
"""

Automatic checks already run (trust these facts):
${checks || "- none"}
Skills on both: ${(rules.matchedSkills ?? []).join(", ") || "none"}
Skills in posting, not on resume: ${(rules.missingSkills ?? []).join(", ") || "none"}

Scoring rubric:
5 = early-career role in a target family; the resume already shows most must-haves; no blockers.
4 = good fit; one or two gaps a new grad could credibly close.
3 = plausible stretch; worth applying with a warm note.
2 = real mismatch (experience level, domain, or core stack) — likely auto-reject.
1 = not a fit or blocked (clearance, PhD, wrong grad year, senior level).

Rules:
- reasons: up to 4 short bullets, each tying a specific resume line to a specific requirement (name both).
- gaps: must-have requirements the resume does not show. Skip nice-to-haves.
- redFlags: hard blockers only (years required, grad window, clearance/citizenship, PhD, on-site elsewhere). Empty if none.
- Do not reward keyword overlap alone; judge whether the candidate could pass the screen.
- If the posting is not labeled new grad / early career / entry level, assume the bar is 2+ years of full-time work unless it says otherwise: score 3 at most unless the resume clearly beats every must-have. Research engineer/scientist roles at frontier labs expect published research or years of experience.
- Internships count as experience, but not as full-time years.
- Never invent experience that is not on the resume.`;
}

export async function scoreFit(
  job: Job,
  profile: Profile,
  resumeText: string,
  rules: JobFitResult
): Promise<ModelFit> {
  return parseStructuredResponse({
    modelTier: "fast",
    schema: FitScoreSchema,
    schemaName: "job_fit_score",
    input: buildFitPrompt(job, profile, resumeText, rules),
  });
}
