import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { parseStructuredResponse } from "@/lib/ai/client";
import type { Job } from "@/lib/types";
import type { Profile } from "@/lib/profile";

export const TailorSchema = z.object({
  leadBullets: z.array(z.string()).length(3),
  rewordings: z.array(
    z.object({
      original: z.string(),
      suggested: z.string(),
    })
  ),
  missingKeywords: z.array(z.string()),
});

export type TailorResult = z.infer<typeof TailorSchema>;

export async function readResumeText(): Promise<string> {
  const file = path.join(process.cwd(), "data/resume.txt");
  return readFile(file, "utf8");
}

export async function tailorResume(
  job: Job,
  profile: Profile,
  resumeText: string
): Promise<TailorResult> {
  return parseStructuredResponse({
    modelTier: "smart",
    schema: TailorSchema,
    schemaName: "resume_tailor",
    input: `Tailor resume advice for this candidate. Stay truthful. Do not invent employers, dates, or metrics.

Profile:
${JSON.stringify(profile)}

Resume:
${resumeText.slice(0, 12000)}

Job:
${job.company} — ${job.title}
${job.location}
${(job.description || "").slice(0, 8000)}

Return the 3 bullets they should lead with, suggested rewordings of existing resume lines, and keywords from the posting missing on the resume.`,
  });
}
