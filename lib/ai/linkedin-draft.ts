import "server-only";

import { z } from "zod";
import { parseStructuredResponse } from "@/lib/ai/client";
import { clampConnectionNote, clampEmail } from "@/lib/draft-text";
import type { Job } from "@/lib/types";
import type { Profile } from "@/lib/profile";

export const LinkedInDraftSchema = z.object({
  personName: z.string(),
  rankReason: z.string(),
  connectionNote: z.string(),
  email: z.string(),
  coffeeQuestions: z.array(z.string()).length(5),
});

export type LinkedInDraft = z.infer<typeof LinkedInDraftSchema>;

export async function draftFromLinkedInPaste(
  job: Job,
  profile: Profile,
  pastedProfile: string
): Promise<LinkedInDraft> {
  const parsed = await parseStructuredResponse({
    modelTier: "smart",
    schema: LinkedInDraftSchema,
    schemaName: "linkedin_outreach",
    input: `Draft outreach for ${profile.name}. They will send it themselves. Do not invent shared history.

Candidate:
${JSON.stringify(profile)}

Role:
${job.company} — ${job.title} in ${job.location}
${(job.description || "").slice(0, 4000)}

Pasted LinkedIn profile:
${pastedProfile.slice(0, 8000)}

Return:
- personName from the profile
- rankReason: one line on why this person is worth a note for this role
- connectionNote: at most 300 characters, one specific hook, small ask
- email: at most 6 sentences
- coffeeQuestions: exactly 5 questions specific to this person's background, not generic career advice`,
  });
  return {
    ...parsed,
    connectionNote: clampConnectionNote(parsed.connectionNote),
    email: clampEmail(parsed.email),
  };
}
