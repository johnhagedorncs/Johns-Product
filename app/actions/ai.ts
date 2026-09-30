"use server";

import { hasOpenAIConfig } from "@/lib/ai/client";
import { findConnectablePeople } from "@/lib/ai/find-people";
import { draftFromLinkedInPaste } from "@/lib/ai/linkedin-draft";
import { readResumeText, tailorResume } from "@/lib/ai/tailor-resume";
import { getProfile } from "@/lib/profile";
import {
  normalizeSeeker,
  profileForSeeker,
  tailorCacheKey,
  type SeekerPrefs,
} from "@/lib/seeker";
import { loadTailors, saveTailor } from "@/lib/tailor-store.server";
import type { TailorResult } from "@/lib/ai/tailor-resume";
import type { LinkedInDraft } from "@/lib/ai/linkedin-draft";
import type { RolePerson } from "@/lib/people";
import type { Job } from "@/lib/types";

export async function tailorResumeForJob(
  job: Job,
  seekerInput: SeekerPrefs
): Promise<TailorResult> {
  const seeker = normalizeSeeker(seekerInput);
  const key = tailorCacheKey(job.id, seeker.resumeText);
  const existing = (await loadTailors())[key];
  if (existing) return existing;
  const resume = seeker.resumeText.trim() || (await readResumeText());
  const result = await tailorResume(
    job,
    profileForSeeker(getProfile(), seeker),
    resume
  );
  return saveTailor(key, result);
}

export async function findPeopleForJob(
  job: Job,
  seekerInput: SeekerPrefs
): Promise<{ hooks: string[]; people: RolePerson[] }> {
  if (!hasOpenAIConfig()) {
    throw new Error("Add the model names in .env to look up people.");
  }
  const seeker = normalizeSeeker(seekerInput);
  const resume = seeker.resumeText.trim() || (await readResumeText());
  return findConnectablePeople(
    job,
    profileForSeeker(getProfile(), seeker),
    resume
  );
}

export async function draftLinkedInForJob(
  job: Job,
  pastedProfile: string,
  seekerInput: SeekerPrefs
): Promise<LinkedInDraft> {
  const text = pastedProfile.trim();
  if (!text) throw new Error("Paste a LinkedIn profile first.");
  const seeker = normalizeSeeker(seekerInput);
  return draftFromLinkedInPaste(
    job,
    profileForSeeker(getProfile(), seeker),
    text
  );
}
