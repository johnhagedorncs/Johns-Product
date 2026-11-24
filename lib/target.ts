/**
 * What an uploaded resume is looking for: the person's name, the job titles
 * to search, the words a matching title contains, and whether they're early
 * career or experienced. `null` means "the saved resume" — the app keeps its
 * original new-grad software defaults for that.
 */
import { gradYear } from "@/lib/resume-hooks";

export type CareerLevel = "entry" | "experienced";

export type ResumeTarget = {
  name: string;
  /** Job titles to search for, e.g. ["data analyst", "business intelligence analyst"] */
  roles: string[];
  /** Lowercase words/phrases a matching job title contains, e.g. ["analyst", "analytics"] */
  titleTerms: string[];
  level: CareerLevel;
  /** Full-time years of experience (0 for students) */
  years: number;
};

function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().toLowerCase().slice(0, 60);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

export function normalizeTarget(input: unknown): ResumeTarget | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const roles = cleanList(raw.roles, 5);
  if (roles.length === 0) return null;
  const titleTerms = cleanList(raw.titleTerms, 12);
  const years = typeof raw.years === "number" && Number.isFinite(raw.years) ? Math.max(0, Math.min(40, Math.round(raw.years))) : 0;
  return {
    name: typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : "",
    roles,
    titleTerms: titleTerms.length > 0 ? titleTerms : roles,
    level: raw.level === "experienced" ? "experienced" : "entry",
    years,
  };
}

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
}

/** Matches job titles in the target's role family. */
export function titleFamily(target: ResumeTarget): RegExp {
  const terms = [...new Set([...target.titleTerms, ...target.roles])];
  return new RegExp(`(?<![a-z])(?:${terms.map(escape).join("|")})(?![a-z])`, "i");
}

const ALWAYS_EXCLUDE = /director|head of|\bvp\b|vice president|chief|\bintern(ship)?\b|\bphd\b/i;
const SENIOR = /senior|\bsr\.?\b|staff|principal|\blead\b|\bmanager\b|architect|\biii\b|\biv\b/i;

/** True when a title is too senior (or too junior) for the target. */
export function titleExcluded(title: string, target: ResumeTarget): boolean {
  if (ALWAYS_EXCLUDE.test(title)) return true;
  if (target.level === "experienced") return false;
  // An entry-level "product manager" target should still see manager titles.
  const match = title.match(SENIOR)?.[0]?.toLowerCase();
  if (!match) return false;
  return !target.roles.some((role) => role.includes(match));
}

/** LinkedIn's experience filter: 2 = entry, 3 = associate, 4 = mid-senior. */
export function linkedInExperience(target: ResumeTarget | null | undefined): string {
  return target?.level === "experienced" ? "3,4" : "2";
}

// --- Fallback when no AI key is set: rough guesses from keywords. ---

const FAMILIES: Array<{ pattern: RegExp; roles: string[]; titleTerms: string[] }> = [
  {
    pattern: /data analyst|analista de datos|business intelligence|power ?bi|tableau|looker|\banalytics\b|reporting/gi,
    roles: ["data analyst", "business intelligence analyst", "analytics analyst"],
    titleTerms: ["data analyst", "business analyst", "bi analyst", "insights analyst", "reporting analyst", "analytics", "business intelligence", "bi"],
  },
  {
    pattern: /data scientist|cient[ií]fico de datos|machine learning|statistical model/gi,
    roles: ["data scientist", "machine learning engineer"],
    titleTerms: ["data scientist", "data science", "machine learning", "ml", "analytics"],
  },
  {
    pattern: /software engineer|developer|desarrollador|full[\s-]?stack|backend|frontend/gi,
    roles: ["software engineer", "software developer"],
    titleTerms: ["software", "engineer", "developer", "backend", "frontend", "full stack"],
  },
  {
    pattern: /product manager|product owner|gerente de producto/gi,
    roles: ["product manager", "associate product manager"],
    titleTerms: ["product manager", "product owner", "apm"],
  },
  {
    pattern: /financial analyst|finance|fp&a|accounting|contador|finanzas/gi,
    roles: ["financial analyst", "finance associate"],
    titleTerms: ["financial", "finance", "fp&a", "analyst", "accounting"],
  },
  {
    pattern: /marketing|growth|brand|social media|mercadotecnia/gi,
    roles: ["marketing associate", "marketing analyst"],
    titleTerms: ["marketing", "growth", "brand", "content"],
  },
  {
    pattern: /ux|ui designer|product design|figma|dise[nñ]ador/gi,
    roles: ["product designer", "ux designer"],
    titleTerms: ["designer", "design", "ux", "ui"],
  },
];

/** First line that looks like "First Last" (2–4 capitalized words). */
export function nameFromResume(text: string): string {
  for (const line of text.split(/\n+/).slice(0, 6)) {
    const clean = line.trim();
    if (/^[A-ZÁÉÍÓÚÑ][\p{L}'.-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'.-]+){1,3}$/u.test(clean)) return clean;
  }
  return "";
}

const RANGE = /\b((?:19|20)\d{2})\s*(?:[–—-]|to|a|hasta)\s*((?:19|20)\d{2}|present|presente|actual|actualidad|current|now|today|hoy)\b/gi;
const INTERN = /intern|internship|pasant|practicante|becari/i;
const SCHOOL = /universit|universidad|college|school|escuela|licenciatura|bachelor|master|maestr|b\.?s\.|m\.?s\.|degree|education|educaci/i;

/**
 * Rough full-time years: from the earliest non-internship date range
 * ("2022 – present", "2021 - 2022") to now. Falls back to years since the
 * latest graduation year.
 */
export function yearsOfWork(text: string, now = new Date()): number {
  const thisYear = now.getFullYear();
  let earliest: number | null = null;
  for (const line of text.split(/\n+/)) {
    if (INTERN.test(line) || SCHOOL.test(line)) continue;
    for (const match of line.matchAll(RANGE)) {
      const start = Number(match[1]);
      if (start > thisYear || start < thisYear - 45) continue;
      if (earliest === null || start < earliest) earliest = start;
    }
  }
  if (earliest !== null) return thisYear - earliest;
  const grad = gradYear(text);
  return grad && grad < thisYear ? thisYear - grad : 0;
}

export function guessTarget(resumeText: string, now = new Date()): ResumeTarget | null {
  const text = resumeText.slice(0, 20000);
  let best: (typeof FAMILIES)[number] | null = null;
  let bestHits = 0;
  for (const family of FAMILIES) {
    const hits = text.match(family.pattern)?.length ?? 0;
    if (hits > bestHits) {
      best = family;
      bestHits = hits;
    }
  }
  if (!best) return null;
  const years = yearsOfWork(text, now);
  return {
    name: nameFromResume(text),
    roles: best.roles,
    titleTerms: best.titleTerms,
    level: years >= 2 ? "experienced" : "entry",
    years,
  };
}
