import { hookAliases, type ResumeHooks } from "@/lib/resume-hooks";
import type { Job } from "@/lib/types";

export type WarmPathKind = "school" | "group" | "employer" | "function" | "recruiter";

export type WarmPath = {
  id: string;
  kind: WarmPathKind;
  label: string;
  why: string;
  /** Rank points: relationship (group 4, school 3, employer 2) or role relevance (function 4, recruiter 3) */
  points: number;
  linkedinUrl: string;
  googleUrl: string;
};

/** LinkedIn geo IDs for the people-search location filter. */
const GEO: Record<string, string> = { nyc: "90000070" };

const FUNCTIONS: Array<[RegExp, string, string]> = [
  [/forward[\s-]deployed/i, "forward deployed", "Forward deployed engineers"],
  [/solutions|sales engineer|field engineer/i, "solutions engineer", "Solutions engineers"],
  [/machine learning|\bml\b/i, "machine learning engineer", "ML engineers"],
  [/applied ai|\bai engineer|\bllm\b/i, "AI engineer", "AI engineers"],
  [/data engineer/i, "data engineer", "Data engineers"],
  [/product manager|\bapm\b/i, "product manager", "Product managers"],
  [/infrastructure|platform|devops|\bsre\b/i, "infrastructure engineer", "Infra engineers"],
];

export function roleFunction(title: string): { keyword: string; label: string } {
  for (const [pattern, keyword, label] of FUNCTIONS) {
    if (pattern.test(title)) return { keyword, label };
  }
  return { keyword: "software engineer", label: "Software engineers" };
}

export function searchCompanyName(company: string): string {
  return company.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s*\/.*$/, "").trim();
}

function quote(term: string): string {
  return term.includes(" ") || term.includes(",") ? `"${term}"` : term;
}

function anyOf(terms: string[]): string {
  const quoted = terms.map(quote);
  return quoted.length === 1 ? quoted[0] : `(${quoted.join(" OR ")})`;
}

export function linkedInPeopleUrl(keywords: string, locationId?: string): string {
  const params = new URLSearchParams({ keywords, origin: "GLOBAL_SEARCH_HEADER" });
  const geo = locationId ? GEO[locationId] : undefined;
  if (geo) params.set("geoUrn", JSON.stringify([geo]));
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

export function googleProfilesUrl(query: string): string {
  return `https://www.google.com/search?${new URLSearchParams({ q: `site:linkedin.com/in ${query}` }).toString()}`;
}

function path(
  kind: WarmPathKind,
  id: string,
  label: string,
  why: string,
  points: number,
  keywords: string,
  locationId?: string
): WarmPath {
  return {
    id: `${kind}:${id}`,
    kind,
    label,
    why,
    points,
    linkedinUrl: linkedInPeopleUrl(keywords, locationId),
    googleUrl: googleProfilesUrl(keywords),
  };
}

/**
 * Ranked people searches for a role: shared school, group, and past employer
 * first (anywhere — warm ties travel), then same-function and recruiting in
 * the target city. You open each search in your own logged-in browser.
 */
export function warmPaths(job: Pick<Job, "company" | "title">, hooks: ResumeHooks, locationId: string): WarmPath[] {
  const company = searchCompanyName(job.company);
  const co = quote(company);
  const paths: WarmPath[] = [];

  for (const group of hooks.groups) {
    paths.push(
      path("group", group, `${group} at ${company}`, `Shared group — the warmest cold note you can send`, 4,
        `${co} ${anyOf(hookAliases(group))}`)
    );
  }
  for (const school of hooks.schools) {
    paths.push(
      path("school", school, `${school} alumni at ${company}`, `Same school — lead with it in the first line`, 3,
        `${co} ${anyOf(hookAliases(school))}`)
    );
  }
  for (const employer of hooks.employers) {
    if (employer.toLowerCase() === company.toLowerCase()) continue;
    paths.push(
      path("employer", employer, `Ex-${employer} at ${company}`, `Shared employer — ask how they made the jump`, 2,
        `${co} ${quote(employer)}`)
    );
  }

  const fn = roleFunction(job.title);
  paths.push(
    path("function", fn.keyword, `${fn.label} at ${company}`, `Same function — can speak to the team and refer`, 4,
      `${co} ${quote(fn.keyword)}`, locationId)
  );
  paths.push(
    path("recruiter", "recruiting", `Recruiters at ${company}`, `Recruiting — can confirm the req and route your application`, 3,
      `${co} ${anyOf(["university recruiter", "technical recruiter", "talent acquisition"])}`, locationId)
  );

  return paths.sort((a, b) => b.points - a.points);
}

/** Drop a path only when a search confirmed it has no LinkedIn profiles. Unknown stays. */
export function pathsWithLinkedInResults(
  paths: WarmPath[],
  hasResults: Record<string, boolean>
): WarmPath[] {
  return paths.filter((path) => hasResults[path.id] !== false);
}
