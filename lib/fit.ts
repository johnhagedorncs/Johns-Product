import { isEarlyCareer } from "@/lib/board-match";
import { locationLabel, locationMatches } from "@/lib/locations";
import { gradYear } from "@/lib/resume-hooks";
import { matchSkills } from "@/lib/skills";
import type { FitAction, FitCheck, Job, JobFitResult } from "@/lib/types";

export type FitContext = {
  resumeText: string;
  locationId: string;
};

const TARGET_FAMILY =
  /software|engineer|developer|forward deployed|forward-deployed|deployment|solutions|applied ai|\bai\b|machine learning|\bml\b|infrastructure|platform|backend|full[\s-]?stack|data engineer|technical program|product manager|\bapm\b/i;

const OFF_TARGET =
  /\b(analyst|accountant|designer|recruiter|sales|marketing|firmware|hardware|electrical|mechanical|civil|clinical|nurse|security engineer|penetration|red team|intern(ship)?)\b/i;

const EARLY_TEXT =
  /new grad|new graduate|recent graduate|recent grads?|early[\s-]career|entry[\s-]level|university grad|campus|0\s*[-–]\s*2 years|graduating in/i;

const CLEARANCE = /security clearance|ts\/sci|top secret|secret clearance|active clearance|clearance is required/i;
const CITIZEN = /u\.?s\.? citizenship (?:is )?required|must be a u\.?s\.? citizen|only u\.?s\.? citizens/i;
const PHD_REQUIRED =
  /ph\.?\s?d\.?[^.\n]{0,60}\brequired\b|currently (?:pursuing|enrolled in) a ph\.?\s?d|ph\.?\s?d\.? (?:degree )?in [^.\n]{0,60}(?:is )?required/i;
const SOFT_SENTENCE = /prefer|preferred|bonus|nice to have|a plus|plus if|ideally/i;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Smallest "N+ years of experience" the posting requires (preferred-only lines ignored). */
export function yearsRequired(description: string): number | null {
  let min: number | null = null;
  for (const line of sentences(description)) {
    if (!/experience/i.test(line) || SOFT_SENTENCE.test(line)) continue;
    const match = line.match(/(\d{1,2})\s*\+?\s*(?:[-–]|to)?\s*(?:\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b/i);
    if (!match) continue;
    const years = Number(match[1]);
    if (years > 20) continue;
    if (min === null || years < min) min = years;
  }
  return min;
}

/** Graduation years a posting targets, e.g. [2026, 2027] for "Graduation Date: Fall 2026-Summer 2027". */
export function gradWindow(text: string): number[] {
  const years = new Set<number>();
  for (const line of sentences(text)) {
    if (!/graduat|class of|degree (?:by|between)/i.test(line)) continue;
    for (const match of line.matchAll(/\b(20[2-3]\d)\b/g)) years.add(Number(match[1]));
  }
  return [...years].sort((a, b) => a - b);
}

function clamp(score: number): number {
  return Math.min(5, Math.max(1, Math.round(score)));
}

function actionFor(score: number, blocked: boolean): FitAction {
  if (blocked || score <= 2) return "skip";
  if (score >= 4) return "apply_now";
  return "apply_and_outreach";
}

/**
 * Instant fit check that reads the posting against the resume. Used for every
 * role right after a scan and as the guard rail on the model's score.
 */
export function ruleFit(job: Job, context: FitContext): JobFitResult {
  const description = job.description ?? "";
  const posting = `${job.title}\n${description}`;
  const skills = matchSkills(context.resumeText, posting);
  const checks: FitCheck[] = [];
  let score = 2.75;

  if (skills.coverage !== null) {
    const pct = Math.round(skills.coverage * 100);
    const detail = `${skills.matched.length} of ${skills.matched.length + skills.missing.length} skills in the posting are on your resume (${pct}%)`;
    if (skills.coverage >= 0.6) {
      score += 1;
      checks.push({ label: "Skills", level: "good", detail });
    } else if (skills.coverage >= 0.4) {
      score += 0.5;
      checks.push({ label: "Skills", level: "good", detail });
    } else {
      score -= 0.5;
      checks.push({ label: "Skills", level: "warn", detail });
    }
  }

  if (OFF_TARGET.test(job.title)) {
    score -= 1.25;
    checks.push({ label: "Role", level: "warn", detail: "Outside your target role families" });
  } else if (TARGET_FAMILY.test(job.title)) {
    score += 0.5;
    checks.push({ label: "Role", level: "good", detail: "Matches your target role families" });
  }

  const early = isEarlyCareer(job.title) || EARLY_TEXT.test(description);
  if (early) {
    score += 0.75;
    checks.push({ label: "Level", level: "good", detail: "Posted as new grad / early career" });
  } else if (description) {
    checks.push({
      label: "Level",
      level: "warn",
      detail: "Not labeled early career — expect experienced applicants",
    });
  }

  const blocks: string[] = [];
  const years = yearsRequired(description);
  if (years !== null) {
    if (years >= 5) {
      score -= 2.5;
      blocks.push(`${years}+ years of experience required`);
    } else if (years >= 3) {
      score -= 1.5;
      checks.push({ label: "Experience", level: "warn", detail: `Asks for ${years}+ years; you have internships` });
    } else if (years === 2) {
      score -= 0.5;
      checks.push({ label: "Experience", level: "warn", detail: "Asks for 2+ years" });
    } else {
      checks.push({ label: "Experience", level: "good", detail: `Asks for ${years}+ years` });
    }
  }

  const youGrad = gradYear(context.resumeText);
  const window = gradWindow(posting);
  if (youGrad && window.length > 0) {
    const low = window[0];
    const high = window[window.length - 1];
    if (youGrad >= low && youGrad <= high) {
      score += 0.5;
      checks.push({ label: "Grad date", level: "good", detail: `Targets your ${youGrad} class` });
    } else if (youGrad > high) {
      blocks.push(`Wants grads by ${high}; you finish in ${youGrad}`);
    } else {
      checks.push({ label: "Grad date", level: "warn", detail: `Targets ${window.join("/")} grads; you finish in ${youGrad}` });
    }
  }

  if (CLEARANCE.test(description)) blocks.push("Security clearance required");
  if (PHD_REQUIRED.test(description)) blocks.push("PhD required");
  if (CITIZEN.test(description)) {
    checks.push({ label: "Eligibility", level: "warn", detail: "US citizenship required" });
  }

  if (!locationMatches(job.location, context.locationId)) {
    score -= 1.5;
    checks.push({
      label: "Location",
      level: "warn",
      detail: `Not listed in ${locationLabel(context.locationId)}`,
    });
  }

  for (const block of blocks) checks.push({ label: "Blocker", level: "block", detail: block });

  const blocked = blocks.length > 0;
  const final = blocked ? Math.min(2, clamp(score)) : clamp(score);

  const reasons = checks
    .filter((check) => check.level === "good")
    .map((check) => check.detail)
    .slice(0, 3);
  if (!description) reasons.push("No description yet — scored from the title only");

  return {
    score: final,
    reasons,
    gaps: skills.missing.slice(0, 6).map((skill) => `${skill} is not on your resume`),
    redFlags: [
      ...blocks,
      ...checks.filter((check) => check.level === "warn" && check.label !== "Skills" && check.label !== "Level").map((check) => check.detail),
    ],
    action: actionFor(final, blocked),
    basis: "rules",
    matchedSkills: skills.matched,
    missingSkills: skills.missing,
    checks,
  };
}

export type ModelFit = {
  score: number;
  reasons: string[];
  gaps: string[];
  redFlags: string[];
};

/**
 * Model score with the rule check as a guard rail: hard blockers cap it at 2,
 * and skill/check detail always comes from the rules so the UI can show it.
 */
export function combineFit(rules: JobFitResult, model: ModelFit): JobFitResult {
  const checks = rules.checks ?? [];
  const blocked = checks.some((check) => check.level === "block");
  const notEarly = checks.some((check) => check.label === "Level" && check.level === "warn");
  const cap = blocked ? 2 : notEarly ? 4 : 5;
  const score = Math.min(cap, clamp(model.score));
  const redFlags = [...rules.redFlags];
  for (const flag of model.redFlags) {
    if (!redFlags.some((existing) => existing.toLowerCase() === flag.toLowerCase())) {
      redFlags.push(flag);
    }
  }
  return {
    ...rules,
    score,
    reasons: model.reasons.length > 0 ? model.reasons.slice(0, 4) : rules.reasons,
    gaps: model.gaps.length > 0 ? model.gaps.slice(0, 6) : rules.gaps,
    redFlags: redFlags.slice(0, 6),
    action: actionFor(score, blocked),
    basis: "ai",
  };
}

export function withFit(job: Job, fit: JobFitResult): Job {
  return { ...job, fit, fitScore: fit.score };
}
