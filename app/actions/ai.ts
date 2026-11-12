"use server";

import { uncheckedPaths } from "@/lib/warm-paths";
import { hasOpenAIConfig } from "@/lib/ai/client";
import { findConnectablePeople } from "@/lib/ai/find-people";
import { warmPathsThatHit } from "@/lib/ai/warm-path-check";
import {
  draftFromLinkedInPaste,
  nameFromPaste,
  type DraftRecipient,
  type LinkedInDraft,
} from "@/lib/ai/linkedin-draft";
import { extractLinkedInUrl, hasApolloConfig, matchContact, type EmailContact } from "@/lib/apollo";
import { findWithHunter, hasHunterConfig } from "@/lib/hunter";
import { researchProfile, type ResearchTarget } from "@/lib/ai/profile-research";
import { tailorResume, type TailorResult } from "@/lib/ai/tailor-resume";
import { getProfile } from "@/lib/profile";
import { effectiveResume, normalizeSeeker, profileForSeeker, type SeekerPrefs } from "@/lib/seeker";
import type { RolePerson } from "@/lib/people";
import type { WarmPath } from "@/lib/warm-paths";
import type { Job } from "@/lib/types";

const NO_KEY = "Add OPENAI_API_KEY to the project's environment variables to use this.";
const NO_LOOKUP_KEY = "Add HUNTER_API_KEY (or APOLLO_API_KEY) to the project's environment variables to look up emails.";

function failure(err: unknown, fallback: string): string {
  return (err instanceof Error ? err.message : fallback).slice(0, 240);
}

export async function visibleWarmPaths(paths: WarmPath[]): Promise<WarmPath[]> {
  try {
    return await warmPathsThatHit(paths);
  } catch (err) {
    console.error(`[warm-path-check] failed: ${err instanceof Error ? err.message : String(err)}`);
    // The check failed (e.g. expired key): show ties, flagged as unverified.
    return uncheckedPaths(paths);
  }
}

export async function findPeopleForJob(
  job: Job,
  seekerInput: SeekerPrefs
): Promise<{ hooks: string[]; people: RolePerson[]; error?: string }> {
  if (!hasOpenAIConfig()) return { hooks: [], people: [], error: NO_KEY };
  try {
    return await findConnectablePeople(job, effectiveResume(normalizeSeeker(seekerInput)));
  } catch (err) {
    return { hooks: [], people: [], error: failure(err, "Could not search for people") };
  }
}

/**
 * Step 2: the user picked someone. Look up their work email (1 credit when
 * one is found) with Hunter, or Apollo when only an Apollo key is set. Uses
 * the LinkedIn URL when there is one, plus the name read from the paste and
 * the role's company.
 */
export async function findContactEmail(
  job: Job,
  linkedinUrl: string,
  pastedProfile: string
): Promise<{ contact?: EmailContact; error?: string }> {
  const useHunter = hasHunterConfig();
  if (!useHunter && !hasApolloConfig()) return { error: NO_LOOKUP_KEY };
  const service = useHunter ? "Hunter" : "Apollo";
  const url = extractLinkedInUrl(linkedinUrl) || extractLinkedInUrl(pastedProfile);
  try {
    let name = "";
    if (pastedProfile.trim() && hasOpenAIConfig()) {
      // Best effort: a name lets the lookup fall back to name + company.
      name = await nameFromPaste(pastedProfile).catch(() => "");
    }
    if (!url && !name) {
      if (!pastedProfile.trim()) return { error: "Add their LinkedIn URL or paste their profile first." };
      return { error: "Couldn't read a name from the paste. Add their LinkedIn URL instead." };
    }
    const query = { linkedinUrl: url, name, company: job.company };
    const contact = useHunter ? await findWithHunter(query) : await matchContact(query);
    if (!contact) return { error: `${service} couldn't find this person. Check the URL or try someone else.` };
    if (!contact.name && name) contact.name = name;
    if (!contact.email) return { contact, error: `${service} found ${contact.name || "them"} but has no email on file.` };
    return { contact };
  } catch (err) {
    return { error: failure(err, "Could not look up their email") };
  }
}

/**
 * Between steps 2 and 3: read up on the person from public web results, so
 * the user doesn't have to paste their LinkedIn profile.
 */
export async function researchContact(target: ResearchTarget): Promise<{ profile: string; error?: string }> {
  if (!target?.name?.trim()) return { profile: "" };
  if (!hasOpenAIConfig()) return { profile: "", error: NO_KEY };
  try {
    return { profile: await researchProfile(target) };
  } catch (err) {
    console.error(`[profile-research] failed: ${err instanceof Error ? err.message : String(err)}`);
    return { profile: "", error: "Couldn't read their public profile. You can paste it, or draft anyway." };
  }
}

/** Step 3: draft the email. Refuses without a looked-up email to send it to. */
export async function draftLinkedInForJob(
  job: Job,
  pastedProfile: string,
  recipient: DraftRecipient,
  seekerInput: SeekerPrefs
): Promise<{ draft?: LinkedInDraft; error?: string }> {
  if (!recipient?.email?.includes("@")) return { error: "Find their email first." };
  // No profile found or pasted: draft from what the email lookup knows.
  const text =
    pastedProfile.trim() ||
    [recipient.name, recipient.title, recipient.company].filter(Boolean).join(" — ") +
      "\n(No profile details available — keep the note general; don't invent specifics about them.)";
  if (!hasOpenAIConfig()) return { error: NO_KEY };
  try {
    const seeker = normalizeSeeker(seekerInput);
    const profile = profileForSeeker(getProfile(), seeker);
    return { draft: await draftFromLinkedInPaste(job, profile, effectiveResume(seeker), text, recipient) };
  } catch (err) {
    return { error: failure(err, "Could not draft outreach") };
  }
}

export async function tailorResumeForJob(
  job: Job,
  seekerInput: SeekerPrefs
): Promise<{ tailor?: TailorResult; error?: string }> {
  if (!hasOpenAIConfig()) return { error: NO_KEY };
  if (!job.description) return { error: "This posting has no description to tailor against yet." };
  try {
    return { tailor: await tailorResume(job, effectiveResume(normalizeSeeker(seekerInput))) };
  } catch (err) {
    return { error: failure(err, "Could not tailor the resume") };
  }
}
