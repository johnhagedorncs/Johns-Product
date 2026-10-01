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
  /** True when linkedinUrl searches the company's own employee list; false = keyword search that can match names */
  scoped: boolean;
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

/** The company's People tab, filtered — lists only people who work there now. */
export function companyPeopleUrl(slug: string, keywords: string): string {
  return `https://www.linkedin.com/company/${encodeURIComponent(slug)}/people/?${new URLSearchParams({ keywords }).toString()}`;
}

export function googleProfilesUrl(query: string): string {
  return `https://www.google.com/search?${new URLSearchParams({ q: `site:linkedin.com/in ${query}` }).toString()}`;
}

type Search = {
  /** Full keyword search, company name included */
  keywords: string;
  /** What to type into the company's People tab search box */
  employeeKeywords: string;
  locationId?: string;
};

function path(
  kind: WarmPathKind,
  id: string,
  label: string,
  why: string,
  points: number,
  search: Search,
  slug?: string
): WarmPath {
  return {
    id: `${kind}:${id}`,
    kind,
    label,
    why,
    points,
    linkedinUrl: slug
      ? companyPeopleUrl(slug, search.employeeKeywords)
      : linkedInPeopleUrl(search.keywords, search.locationId),
    googleUrl: googleProfilesUrl(search.keywords),
    scoped: Boolean(slug),
  };
}

/**
 * The most formal alias, commas dropped — LinkedIn's People-tab search stops
 * at a comma, so "University of California, Santa Barbara" would search
 * every UC campus.
 */
function longest(terms: string[]): string {
  const best = terms.reduce((top, term) => (term.length > top.length ? term : top), terms[0] ?? "");
  return best.replace(/\s*,\s*/g, " ");
}

/**
 * Ranked people searches for a role: shared school, group, and past employer
 * first (anywhere — warm ties travel), then same-function and recruiting in
 * the target city. You open each search in your own logged-in browser.
 */
export function warmPaths(
  job: Pick<Job, "company" | "title" | "companyLinkedIn">,
  hooks: ResumeHooks,
  locationId: string
): WarmPath[] {
  const slug = job.companyLinkedIn || undefined;
  const company = searchCompanyName(job.company);
  const co = quote(company);
  const paths: WarmPath[] = [];

  for (const group of hooks.groups) {
    paths.push(
      path("group", group, `${group} at ${company}`, `Shared group — the warmest cold note you can send`, 4,
        { keywords: `${co} ${anyOf(hookAliases(group))}`, employeeKeywords: hookAliases(group)[0] }, slug)
    );
  }
  for (const school of hooks.schools) {
    paths.push(
      path("school", school, `${school} alumni at ${company}`, `Same school — lead with it in the first line`, 3,
        { keywords: `${co} ${anyOf(hookAliases(school))}`, employeeKeywords: longest(hookAliases(school)) }, slug)
    );
  }
  for (const employer of hooks.employers) {
    if (employer.toLowerCase() === company.toLowerCase()) continue;
    paths.push(
      path("employer", employer, `Ex-${employer} at ${company}`, `Shared employer — ask how they made the jump`, 2,
        { keywords: `${co} ${quote(employer)}`, employeeKeywords: employer }, slug)
    );
  }

  const fn = roleFunction(job.title);
  paths.push(
    path("function", fn.keyword, `${fn.label} at ${company}`, `Same function — can speak to the team and refer`, 4,
      { keywords: `${co} ${quote(fn.keyword)}`, employeeKeywords: fn.keyword, locationId }, slug)
  );
  paths.push(
    path("recruiter", "recruiting", `Recruiters at ${company}`, `Recruiting — can confirm the req and route your application`, 3,
      {
        keywords: `${co} ${anyOf(["university recruiter", "technical recruiter", "talent acquisition"])}`,
        employeeKeywords: "recruiter",
        locationId,
      }, slug)
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
