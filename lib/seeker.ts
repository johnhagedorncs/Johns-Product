import { DEFAULT_LOCATION, locationLabel, normalizeLocation } from "@/lib/locations";
import { savedResumeText, type Profile } from "@/lib/profile";
import { gradYear, hookLabels, resumeHooks } from "@/lib/resume-hooks";
import { extractSkills } from "@/lib/skills";
import { guessTarget, nameFromResume, normalizeTarget, type ResumeTarget } from "@/lib/target";

export const SEEKER_STORAGE_KEY = "warm-apply-seeker";

export type SeekerPrefs = {
  name: string;
  locationId: string;
  resumeText: string;
  resumeFileName: string;
  /** What the uploaded resume searches for; null for the saved resume. */
  target: ResumeTarget | null;
};

export function defaultSeekerPrefs(): SeekerPrefs {
  return {
    name: "",
    locationId: DEFAULT_LOCATION,
    resumeText: "",
    resumeFileName: "",
    target: null,
  };
}

export function normalizeSeeker(
  input: Partial<SeekerPrefs> | null | undefined
): SeekerPrefs {
  const fallback = defaultSeekerPrefs();
  return {
    name: typeof input?.name === "string" ? input.name.slice(0, 80) : fallback.name,
    locationId: normalizeLocation(input?.locationId ?? fallback.locationId),
    resumeText:
      typeof input?.resumeText === "string"
        ? input.resumeText.slice(0, 20000)
        : fallback.resumeText,
    resumeFileName:
      typeof input?.resumeFileName === "string"
        ? input.resumeFileName.slice(0, 180)
        : fallback.resumeFileName,
    target: normalizeTarget(input?.target),
  };
}

/**
 * The uploaded resume's target, or a keyword guess when it hasn't been read
 * yet. null for the saved resume, which keeps the app's original defaults.
 */
export function seekerTarget(prefs: Pick<SeekerPrefs, "resumeText" | "target">): ResumeTarget | null {
  const resume = prefs.resumeText.trim();
  if (!resume) return null;
  return prefs.target ?? guessTarget(resume);
}

export function parseSeekerPrefs(raw: string | null): SeekerPrefs {
  if (!raw) return defaultSeekerPrefs();
  try {
    return normalizeSeeker(JSON.parse(raw) as Partial<SeekerPrefs>);
  } catch {
    return defaultSeekerPrefs();
  }
}

export function profileForSeeker(base: Profile, prefs: SeekerPrefs): Profile {
  const seeker = normalizeSeeker(prefs);
  const location = locationLabel(seeker.locationId);
  const resume = seeker.resumeText.trim();
  const custom = Boolean(seeker.name.trim() || resume);
  if (!custom) {
    if (seeker.locationId === DEFAULT_LOCATION) return base;
    return { ...base, location };
  }
  const target = seekerTarget(seeker);
  // An uploaded resume is someone else's (or a new version): never fall back
  // to the saved profile's name, school or target roles.
  const name = seeker.name.trim() || target?.name || (resume ? nameFromResume(resume) : "") || (resume ? "" : base.name);
  return {
    name,
    summary: resume || `${name} is targeting roles in ${location}.`,
    school: resume || seeker.name.trim() ? "" : base.school,
    fraternity: resume || seeker.name.trim() ? "" : base.fraternity,
    location,
    targetRoles: target?.roles ?? base.targetRoles,
    level: target?.level ?? base.level,
    proofPoints: [],
    pitch: resume ? resume.slice(0, 280) : `${name} · ${location}`,
  };
}

/** Uploaded resume, or the saved one until a PDF is uploaded. */
export function effectiveResume(prefs: Pick<SeekerPrefs, "resumeText">): string {
  return prefs.resumeText.trim() || savedResumeText();
}

export function textHash(text: string): string {
  let hash = 0;
  const sample = text.trim();
  for (let i = 0; i < sample.length; i += 1) {
    hash = (hash * 31 + sample.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function tailorCacheKey(jobId: string, resumeText: string): string {
  const text = resumeText.trim();
  if (!text) return jobId;
  return `${jobId}:${textHash(text.slice(0, 4000))}`;
}

export type ResumeSnapshot = {
  source: "upload" | "saved";
  fileName: string;
  gradYear: number | null;
  skills: string[];
  hooks: string[];
  /** Job titles the scan searches for; empty for the saved resume's defaults. */
  roles: string[];
  level: ResumeTarget["level"] | null;
};

/** What the scorer will read — shown on the home page so a bad PDF parse is obvious. */
export function resumeSnapshot(prefs: SeekerPrefs): ResumeSnapshot {
  const text = effectiveResume(prefs);
  const uploaded = Boolean(prefs.resumeText.trim());
  return {
    source: uploaded ? "upload" : "saved",
    fileName: uploaded ? prefs.resumeFileName || "Uploaded PDF" : "Saved resume",
    gradYear: gradYear(text),
    skills: extractSkills(text),
    hooks: hookLabels(resumeHooks(text)),
    roles: seekerTarget(prefs)?.roles ?? [],
    level: seekerTarget(prefs)?.level ?? null,
  };
}
