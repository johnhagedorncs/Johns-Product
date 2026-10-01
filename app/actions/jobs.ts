"use server";

import { hasOpenAIConfig } from "@/lib/ai/client";
import { scoreFit } from "@/lib/ai/score-fit";
import { combineFit, ruleFit } from "@/lib/fit";
import { scanAllSources, type ScanResult } from "@/lib/job-scan";
import { getProfile } from "@/lib/profile";
import { effectiveResume, normalizeSeeker, profileForSeeker, type SeekerPrefs } from "@/lib/seeker";
import { pool } from "@/lib/sources/http";
import { normalizeCompany, watchEntry } from "@/lib/sources/ats";
import { fetchJobDetail, jobFromUrl } from "@/lib/sources/detail";
import { resolveCompanySlug } from "@/lib/sources/linkedin";
import { searchCompanyName } from "@/lib/warm-paths";
import type { Job, JobFitResult } from "@/lib/types";

const MAX_ENRICH = 8;

export async function scanJobs(seekerInput: Partial<SeekerPrefs>): Promise<ScanResult> {
  const seeker = normalizeSeeker(seekerInput);
  return scanAllSources({ resumeText: effectiveResume(seeker), locationId: seeker.locationId });
}

export type EnrichedJob = {
  id: string;
  description?: string;
  applicants?: string;
  fit: JobFitResult;
  error?: string;
};

export type EnrichResult = { jobs: EnrichedJob[]; aiAvailable: boolean };

/**
 * Fill in missing descriptions and score fit against the resume. The rule
 * check always runs; the model reads the resume + posting when a key is set.
 */
export async function enrichJobs(
  jobs: Job[],
  seekerInput: Partial<SeekerPrefs>,
  options: { ai?: boolean } = {}
): Promise<EnrichResult> {
  const seeker = normalizeSeeker(seekerInput);
  const resumeText = effectiveResume(seeker);
  const profile = profileForSeeker(getProfile(), seeker);
  const context = { resumeText, locationId: seeker.locationId };
  const aiAvailable = hasOpenAIConfig();
  const useAi = aiAvailable && options.ai !== false;

  const results = await pool(jobs.slice(0, MAX_ENRICH), 4, async (input): Promise<EnrichedJob> => {
    let job = input;
    let fetched: { description: string; applicants?: string } | null = null;
    let error: string | undefined;
    if (!job.description || (job.source === "linkedin" && !job.applicants)) {
      try {
        fetched = await fetchJobDetail(job);
        job = {
          ...job,
          description: fetched.description || job.description,
          applicants: fetched.applicants ?? job.applicants,
        };
      } catch {
        error = "Could not load the posting text — scored from the title.";
      }
    }
    const rules = ruleFit(job, context);
    let fit = rules;
    if (useAi) {
      try {
        fit = combineFit(rules, await scoreFit(job, profile, resumeText, rules));
      } catch {
        error = error ?? "AI scoring did not finish — showing the rule check.";
      }
    }
    return {
      id: job.id,
      description: fetched?.description || undefined,
      applicants: job.applicants,
      fit,
      error,
    };
  });

  return { jobs: results, aiAvailable };
}

export async function importJobUrl(
  url: string,
  seekerInput: Partial<SeekerPrefs>
): Promise<{ job?: Job; error?: string }> {
  try {
    const seeker = normalizeSeeker(seekerInput);
    const job = await jobFromUrl(url);
    const fit = ruleFit(job, { resumeText: effectiveResume(seeker), locationId: seeker.locationId });
    return { job: { ...job, fit, fitScore: fit.score } };
  } catch (err) {
    return { error: err instanceof Error ? err.message.slice(0, 200) : "Could not read that link." };
  }
}

const slugCache = new Map<string, string | null>();

/** LinkedIn company slug: watch list first, then an exact-name match from public job cards. */
export async function linkedInCompanySlug(company: string): Promise<string | null> {
  const known = watchEntry(company);
  if (known?.linkedin) return known.linkedin;
  const name = searchCompanyName(company);
  const key = normalizeCompany(name);
  if (!key) return null;
  if (slugCache.has(key)) return slugCache.get(key) ?? null;
  const slug = await resolveCompanySlug(name, normalizeCompany).catch(() => null);
  slugCache.set(key, slug);
  return slug;
}
