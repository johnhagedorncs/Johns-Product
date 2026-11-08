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
  /** LinkedIn people search filtered to exactly this path: current company plus title, school, or keyword */
  url: string;
  /** Public-web query used to confirm at least one such person exists */
  checkQuery: string;
  /** Set when the existence check could not run (no AI key or it failed), so the tie may be empty */
  unverified?: boolean;
};

/** Paths that only make sense if someone actually shares the tie. */
export const NEEDS_PROOF = new Set<WarmPathKind>(["school", "group", "employer"]);

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

/** "BeaconFire Inc." → "BeaconFire": LinkedIn's company filter matches the name people list on profiles. */
export function companyFilterName(company: string): string {
  return searchCompanyName(company)
    .replace(/,?\s+(inc|llc|l\.l\.c|corp|corporation|co|ltd|limited|plc|gmbh)\.?$/i, "")
    .trim();
}

function quote(term: string): string {
  return term.includes(" ") || term.includes(",") ? `"${term}"` : term;
}

function anyOf(terms: string[]): string {
  const quoted = terms.map(quote);
  return quoted.length === 1 ? quoted[0] : `(${quoted.join(" OR ")})`;
}

export type PeopleFilters = {
  /** Current company name */
  company: string;
  title?: string;
  school?: string;
  keywords?: string;
};

/**
 * Logged-in LinkedIn people search with real filters. The company People tab
 * drops ?keywords=, so it always landed on the bare People page; the search
 * page honors company, title, and school.
 */
export function linkedInPeopleSearchUrl(filters: PeopleFilters): string {
  const params = new URLSearchParams({ company: filters.company });
  if (filters.title) params.set("title", filters.title);
  if (filters.school) params.set("school", filters.school);
  if (filters.keywords) params.set("keywords", filters.keywords);
  params.set("origin", "FACETED_SEARCH");
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

/**
 * The most formal alias, commas dropped — "University of California, Santa
 * Barbara" is what LinkedIn's school field holds.
 */
function longest(terms: string[]): string {
  const best = terms.reduce((top, term) => (term.length > top.length ? term : top), terms[0] ?? "");
  return best.replace(/\s*,\s*/g, " ");
}

function path(
  kind: WarmPathKind,
  id: string,
  label: string,
  why: string,
  points: number,
  filters: PeopleFilters,
  tie: string
): WarmPath {
  return {
    id: `${kind}:${id}`,
    kind,
    label,
    why,
    points,
    url: linkedInPeopleSearchUrl(filters),
    checkQuery: `site:linkedin.com/in ${quote(filters.company)} ${tie}`,
  };
}

/**
 * Ranked people searches for a role: shared school, group, and past employer
 * first, then same-function and recruiting. Each opens in your own
 * logged-in LinkedIn.
 */
export function warmPaths(
  job: Pick<Job, "company" | "title">,
  hooks: ResumeHooks
): WarmPath[] {
  const company = searchCompanyName(job.company);
  const filter = companyFilterName(job.company) || company;
  const paths: WarmPath[] = [];

  for (const group of hooks.groups) {
    const aliases = hookAliases(group);
    paths.push(
      path("group", group, `${group} at ${company}`, `Shared group — the warmest cold note you can send`, 4,
        { company: filter, keywords: quote(aliases[0]) }, anyOf(aliases))
    );
  }
  for (const school of hooks.schools) {
    const aliases = hookAliases(school);
    paths.push(
      path("school", school, `${school} alumni at ${company}`, `Same school — lead with it in the first line`, 3,
        { company: filter, school: longest(aliases) }, anyOf(aliases))
    );
  }
  for (const employer of hooks.employers) {
    if (employer.toLowerCase() === filter.toLowerCase() || employer.toLowerCase() === company.toLowerCase()) continue;
    paths.push(
      path("employer", employer, `Ex-${employer} at ${company}`, `Shared employer — ask how they made the jump`, 2,
        { company: filter, keywords: quote(employer) }, quote(employer))
    );
  }

  const fn = roleFunction(job.title);
  paths.push(
    path("function", fn.keyword, `${fn.label} at ${company}`, `Same function — can speak to the team and refer`, 4,
      { company: filter, title: fn.keyword }, quote(fn.keyword))
  );
  paths.push(
    path("recruiter", "recruiting", `Recruiters at ${company}`, `Recruiting — can confirm the req and route your application`, 3,
      { company: filter, title: "recruiter" }, anyOf(["recruiter", "talent acquisition"]))
  );

  return paths.sort((a, b) => b.points - a.points);
}

/**
 * Show a school, group, or past-employer path only when a search found at
 * least one real person behind it. Team and recruiter paths always show.
 */
export function pathsWithPeople(paths: WarmPath[], found: Record<string, boolean>): WarmPath[] {
  return paths.filter((path) => !NEEDS_PROOF.has(path.kind) || found[path.id] === true);
}

/** When nothing could be checked, keep every path but flag the shared ties as unverified. */
export function uncheckedPaths(paths: WarmPath[]): WarmPath[] {
  return paths.map((path) => (NEEDS_PROOF.has(path.kind) ? { ...path, unverified: true } : path));
}
