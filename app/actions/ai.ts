"use server";

import { uncheckedPaths } from "@/lib/warm-paths";
import { hasOpenAIConfig } from "@/lib/ai/client";
import { findConnectablePeople } from "@/lib/ai/find-people";
import { warmPathsThatHit } from "@/lib/ai/warm-path-check";
import { draftFromLinkedInPaste, type LinkedInDraft } from "@/lib/ai/linkedin-draft";
import { tailorResume, type TailorResult } from "@/lib/ai/tailor-resume";
import { getProfile } from "@/lib/profile";
import { effectiveResume, normalizeSeeker, profileForSeeker, type SeekerPrefs } from "@/lib/seeker";
import type { RolePerson } from "@/lib/people";
import type { WarmPath } from "@/lib/warm-paths";
import type { Job } from "@/lib/types";

const NO_KEY = "Add OPENAI_API_KEY to the project's environment variables to use this.";

function failure(err: unknown, fallback: string): string {
  return (err instanceof Error ? err.message : fallback).slice(0, 240);
}

export async function visibleWarmPaths(paths: WarmPath[]): Promise<WarmPath[]> {
  try {
    return await warmPathsThatHit(paths);
  } catch {
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

export async function draftLinkedInForJob(
  job: Job,
  pastedProfile: string,
  seekerInput: SeekerPrefs
): Promise<{ draft?: LinkedInDraft; error?: string }> {
  const text = pastedProfile.trim();
  if (!text) return { error: "Paste a LinkedIn profile first." };
  if (!hasOpenAIConfig()) return { error: NO_KEY };
  try {
    const seeker = normalizeSeeker(seekerInput);
    const profile = profileForSeeker(getProfile(), seeker);
    return { draft: await draftFromLinkedInPaste(job, profile, effectiveResume(seeker), text) };
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
