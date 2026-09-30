import { isEarlyCareer, matchesRole, plainDescription, stripHtml, tierLetter } from "@/lib/board-match";
import { watchEntry } from "@/lib/sources/ats";
import { fetchText, pool, type FetchLike } from "@/lib/sources/http";
import type { Job } from "@/lib/types";

/**
 * LinkedIn's public (logged-out) job search — the same cards anyone sees on
 * linkedin.com/jobs without signing in. No profiles, no login, a handful of
 * requests per scan.
 */
const SEARCH = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const POSTING = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";

const LOCATIONS: Record<string, string> = {
  nyc: "New York City Metropolitan Area",
  sf: "San Francisco Bay Area",
  seattle: "Greater Seattle Area",
  boston: "Greater Boston",
  austin: "Austin, Texas Metropolitan Area",
  la: "Los Angeles Metropolitan Area",
  chicago: "Greater Chicago Area",
  remote: "United States",
  any: "United States",
};

export const LINKEDIN_QUERIES = [
  "software engineer new grad",
  "software engineer",
  "forward deployed engineer",
  "machine learning engineer",
  "solutions engineer",
  "AI engineer",
];

export function linkedInSearchUrl(keywords: string, locationId: string, start = 0): string {
  const params = new URLSearchParams({
    keywords,
    location: LOCATIONS[locationId] ?? LOCATIONS.nyc,
    f_TPR: "r604800", // past week
    f_E: "2", // entry level
    start: String(start),
  });
  if (locationId === "remote") params.set("f_WT", "2");
  return `${SEARCH}?${params.toString()}`;
}

function text(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? stripHtml(match[1]).replace(/\s+/g, " ").trim() : "";
}

export type LinkedInCard = {
  linkedinId: string;
  title: string;
  company: string;
  location: string;
  postedAt: string;
  url: string;
};

export function parseLinkedInCards(html: string): LinkedInCard[] {
  const cards: LinkedInCard[] = [];
  for (const chunk of html.split(/<li[\s>]/).slice(1)) {
    const linkedinId = chunk.match(/urn:li:jobPosting:(\d+)/)?.[1];
    if (!linkedinId) continue;
    const title = text(chunk, /base-search-card__title"?[^>]*>([\s\S]*?)<\/h3>/);
    const company = text(chunk, /base-search-card__subtitle"?[^>]*>([\s\S]*?)<\/h4>/);
    const location = text(chunk, /job-search-card__location"?[^>]*>([\s\S]*?)<\/span>/);
    const date = chunk.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
    if (!title || !company) continue;
    const parsedDate = date ? new Date(`${date}T12:00:00Z`) : null;
    cards.push({
      linkedinId,
      title,
      company,
      location,
      postedAt:
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? parsedDate.toISOString()
          : new Date().toISOString(),
      url: `https://www.linkedin.com/jobs/view/${linkedinId}/`,
    });
  }
  return cards;
}

export function linkedInCardToJob(card: LinkedInCard): Job {
  const watch = watchEntry(card.company);
  return {
    id: `li-${card.linkedinId}`,
    company: card.company,
    title: card.title,
    location: card.location,
    tier: watch ? tierLetter(watch.tier) : "C",
    jobUrl: card.url,
    postedAt: card.postedAt,
    teamHint: watch?.why ?? "",
    requirements: [],
    early: isEarlyCareer(card.title),
    source: "linkedin",
    sources: ["linkedin"],
    onWatchList: Boolean(watch),
  };
}

export async function scanLinkedIn(
  fetchImpl: FetchLike = fetch,
  locationId = "nyc",
  queries = LINKEDIN_QUERIES
): Promise<Job[]> {
  const seen = new Set<string>();
  const jobs: Job[] = [];
  let blocked = 0;
  const pages = await pool(queries, 2, async (query) => {
    try {
      return parseLinkedInCards(await fetchText(linkedInSearchUrl(query, locationId), fetchImpl, 12000));
    } catch {
      blocked += 1;
      return [];
    }
  });
  if (blocked === queries.length) throw new Error("LinkedIn did not answer (rate limited)");
  for (const card of pages.flat()) {
    if (seen.has(card.linkedinId)) continue;
    seen.add(card.linkedinId);
    if (!matchesRole(card.title, card.location, locationId)) continue;
    jobs.push(linkedInCardToJob(card));
  }
  return jobs;
}

export function linkedInIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("linkedin.com")) return null;
    const current = parsed.searchParams.get("currentJobId");
    if (current && /^\d+$/.test(current)) return current;
    return parsed.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export type LinkedInPosting = {
  title: string;
  company: string;
  location: string;
  description: string;
  applicants: string;
  postedAt?: string;
};

/** "4 days ago" / "Reposted 3 weeks ago" → ISO date. */
export function postedFromAgo(text: string, now = Date.now()): string | undefined {
  const match = text.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) return undefined;
  const unit: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 30 * 86_400_000,
    year: 365 * 86_400_000,
  };
  return new Date(now - Number(match[1]) * unit[match[2].toLowerCase()]).toISOString();
}

export function parseLinkedInPosting(html: string): LinkedInPosting {
  const start = html.indexOf("show-more-less-html__markup");
  let description = "";
  if (start >= 0) {
    const open = html.indexOf(">", start) + 1;
    const end = html.indexOf("</section>", open);
    description = plainDescription(html.slice(open, end > open ? end : undefined));
  }
  return {
    title: text(html, /topcard__title"?[^>]*>([\s\S]*?)<\/h2>/),
    company: text(html, /topcard__org-name-link"?[^>]*>([\s\S]*?)<\/a>/),
    location: text(html, /topcard__flavor topcard__flavor--bullet"?[^>]*>([\s\S]*?)<\/span>/),
    description,
    applicants: text(html, /num-applicants__caption"?[^>]*>([\s\S]*?)<\/(?:figcaption|span)>/),
    postedAt: postedFromAgo(text(html, /posted-time-ago__text[^>]*>([\s\S]*?)<\/span>/)),
  };
}

export async function fetchLinkedInPosting(id: string, fetchImpl: FetchLike = fetch): Promise<LinkedInPosting> {
  return parseLinkedInPosting(await fetchText(`${POSTING}/${id}`, fetchImpl, 12000));
}
