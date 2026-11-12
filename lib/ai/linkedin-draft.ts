import "server-only";

import { z } from "zod";
import { parseStructuredResponse } from "@/lib/ai/client";
import { clampConnectionNote } from "@/lib/draft-text";
import type { Job } from "@/lib/types";
import type { Profile } from "@/lib/profile";

export const LinkedInDraftSchema = z.object({
  personName: z.string(),
  linkedinUrl: z.string(),
  sharedHook: z.string(),
  rankReason: z.string(),
  subject: z.string(),
  connectionNote: z.string(),
});

/** The model's draft plus the looked-up email it is addressed to. */
export type LinkedInDraft = z.infer<typeof LinkedInDraftSchema> & { email?: string };

/** Who the email goes to, as the email lookup matched them. */
export type DraftRecipient = { name: string; title: string; company: string; email: string; linkedinUrl: string };

const NameSchema = z.object({ name: z.string() });

/** Their full name from a pasted LinkedIn profile ("" if it isn't there). */
export async function nameFromPaste(pastedProfile: string): Promise<string> {
  const parsed = await parseStructuredResponse({
    modelTier: "fast",
    schema: NameSchema,
    schemaName: "profile_name",
    input: `What is the full name of the person whose LinkedIn profile this is? Ignore names of people in "People also viewed", recommendations, or the viewer. Return "" if unclear.

"""
${pastedProfile.slice(0, 4000)}
"""`,
  });
  return parsed.name.trim();
}

const MESSAGE_TEMPLATE = `Hi {their first name},

I hope your week is going well! My name is {your full name}. I'm a recent {your undergrad} grad from {your school} and am now getting my {your grad program} there. I saw that you're also a {school nickname, e.g. Gaucho} and wanted to reach out.

I noticed that you {one specific arc from their profile — e.g. went from frontend engineering to product and now lead engineering programs}, which is the mix of technical + business work I'm hoping to build a career around. I'm looking for {target roles} in {your target city} after I graduate, and {company}'s {city/office if known} is one of my top choices!

I know you're busy, but if you'd be open to a 15-20 minute chat, I'd really like to hear {two or three concrete topics from their role/team, woven into one sentence}.

Thank you for your time, and I hope to hear back soon!

Best,
{your full name}
LinkedIn
{phone from resume if present, else omit the line}`;

export async function draftFromLinkedInPaste(
  job: Job,
  profile: Profile,
  resumeText: string,
  pastedProfile: string,
  recipient: DraftRecipient
): Promise<LinkedInDraft> {
  const parsed = await parseStructuredResponse({
    modelTier: "smart",
    schema: LinkedInDraftSchema,
    schemaName: "linkedin_outreach",
    input: `Draft outreach from ${profile.name} to the person in the pasted LinkedIn profile. ${profile.name} sends it themselves.

Candidate resume:
"""
${resumeText.slice(0, 6000)}
"""

Candidate profile (use for location and school when resume is thin):
School: ${profile.school || "from resume"}
Target location: ${profile.location}
Pitch: ${profile.pitch}

Role they applied to (or are applying to today):
${job.company} — ${job.title} in ${job.location}
${(job.description || "").slice(0, 3000)}

Recipient (the email goes to ${recipient.email}):
${recipient.name}${recipient.title ? ` — ${recipient.title}` : ""}${recipient.company ? ` at ${recipient.company}` : ""}

Pasted LinkedIn profile:
"""
${pastedProfile.slice(0, 8000)}
"""

Return:
- personName: the recipient's name above.
- linkedinUrl: their linkedin.com/in URL if it appears in the paste, else "".
- subject: a short, specific email subject line (under 70 characters), e.g. "UCSB grad interested in {company}'s {team}". No clickbait.
- sharedHook: the single strongest real overlap (same school, past employer, group, team, or tech) — "" if none. Never invent one.
- rankReason: one line on why this person is worth a note for this role.
- connectionNote: the email they will send, following this structure (personalize every bracket; skip school paragraphs if there is no real shared school). Use plain text with line breaks between paragraphs. No "pick your brain", no referral ask yet. At most 4000 characters.

Template to follow:
${MESSAGE_TEMPLATE}`,
  });
  return {
    ...parsed,
    personName: recipient.name || parsed.personName,
    linkedinUrl: recipient.linkedinUrl || parsed.linkedinUrl,
    email: recipient.email,
    connectionNote: clampConnectionNote(parsed.connectionNote),
  };
}
