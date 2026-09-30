import { jobIdFromUrl, matchesRole, tierLetter } from "@/lib/board-match";
import { watchEntry } from "@/lib/sources/ats";
import { asRecord, fetchJson, type FetchLike } from "@/lib/sources/http";
import type { Job } from "@/lib/types";

/** SimplifyJobs' community-maintained new-grad list (the JSON behind the GitHub README). */
export const SIMPLIFY_NEW_GRAD_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json";

const SKIP_CATEGORIES = /hardware/i;
const MAX_AGE_DAYS = 45;

export function simplifyJobs(data: unknown, locationId: string, now = Date.now()): Job[] {
  const rows = Array.isArray(data) ? data : [];
  const jobs: Job[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row || row.active === false || row.is_visible === false) continue;
    if (typeof row.category === "string" && SKIP_CATEGORIES.test(row.category)) continue;
    const company = String(row.company_name ?? "").trim();
    const title = String(row.title ?? "").trim();
    const url = String(row.url ?? "").trim();
    const locations = Array.isArray(row.locations) ? row.locations.map(String) : [];
    const location = locations.join(" / ");
    if (!company || !title || !/^https?:\/\//.test(url)) continue;
    if (!matchesRole(title, location, locationId)) continue;
    const postedSeconds = Number(row.date_posted);
    const postedMs = Number.isFinite(postedSeconds) && postedSeconds > 0 ? postedSeconds * 1000 : now;
    if (now - postedMs > MAX_AGE_DAYS * 86_400_000) continue;
    const watch = watchEntry(company);
    jobs.push({
      id: `simplify-${jobIdFromUrl(url)}`,
      company,
      title,
      location,
      tier: watch ? tierLetter(watch.tier) : "C",
      jobUrl: url,
      postedAt: new Date(postedMs).toISOString(),
      teamHint: watch?.why ?? (typeof row.category === "string" ? row.category : ""),
      requirements: [],
      early: true,
      source: "simplify",
      sources: ["simplify"],
      onWatchList: Boolean(watch),
    });
  }
  return jobs;
}

export async function scanSimplify(fetchImpl: FetchLike = fetch, locationId = "nyc"): Promise<Job[]> {
  return simplifyJobs(await fetchJson(SIMPLIFY_NEW_GRAD_URL, fetchImpl, 20000), locationId);
}
