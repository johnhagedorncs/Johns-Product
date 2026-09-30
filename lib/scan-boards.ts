import companiesFile from "@/data/companies.json";
import {
  BOARD_USER_AGENT,
  isEarlyCareer,
  jobIdFromUrl,
  matchesRole,
  plainDescription,
  tierLetter,
  toPostedAt,
} from "@/lib/board-match";
import type { Job } from "@/lib/types";

export type WatchCompany = {
  name: string;
  tier: number;
  ats: string;
  slug: string | null;
  why: string;
};

type FetchLike = typeof fetch;

const companies = (companiesFile as { companies: WatchCompany[] }).companies;

export function watchCompanies(): WatchCompany[] {
  return companies.filter((c) => c.ats !== "manual" && c.slug);
}

async function fetchJson(
  url: string,
  fetchImpl: FetchLike
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": BOARD_USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function greenhouseJobs(
  company: WatchCompany,
  fetchImpl: FetchLike,
  locationId: string
): Promise<Job[]> {
  const data = asRecord(
    await fetchJson(
      `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs`,
      fetchImpl
    )
  );
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const matched: Job[] = [];
  for (const raw of jobs) {
    const row = asRecord(raw);
    if (!row) continue;
    const title = String(row.title ?? "");
    const location = String(asRecord(row.location)?.name ?? "");
    const url = String(row.absolute_url ?? "");
    if (!url || !matchesRole(title, location, locationId)) continue;
    let description = "";
    if (row.id != null) {
      try {
        const detail = asRecord(
          await fetchJson(
            `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs/${row.id}`,
            fetchImpl
          )
        );
        description = plainDescription(detail?.content);
      } catch {
        description = "";
      }
    }
    matched.push(
      toJob(company, title, location, url, row.updated_at, description)
    );
  }
  return matched;
}

async function ashbyJobs(
  company: WatchCompany,
  fetchImpl: FetchLike,
  locationId: string
): Promise<Job[]> {
  const data = asRecord(
    await fetchJson(
      `https://api.ashbyhq.com/posting-api/job-board/${company.slug}`,
      fetchImpl
    )
  );
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const matched: Job[] = [];
  for (const raw of jobs) {
    const row = asRecord(raw);
    if (!row) continue;
    const title = String(row.title ?? "");
    const secondary = Array.isArray(row.secondaryLocations)
      ? row.secondaryLocations
          .map((item) => String(asRecord(item)?.location ?? ""))
          .filter(Boolean)
      : [];
    const location = [String(row.location ?? ""), ...secondary]
      .filter(Boolean)
      .join(" / ");
    const url = String(row.jobUrl ?? "");
    if (!url || !matchesRole(title, location, locationId)) continue;
    const description = plainDescription(
      row.descriptionPlain ?? row.descriptionHtml
    );
    matched.push(
      toJob(company, title, location, url, row.publishedAt, description)
    );
  }
  return matched;
}

async function leverJobs(
  company: WatchCompany,
  fetchImpl: FetchLike,
  locationId: string
): Promise<Job[]> {
  const data = await fetchJson(
    `https://api.lever.co/v0/postings/${company.slug}?mode=json`,
    fetchImpl
  );
  const jobs = Array.isArray(data) ? data : [];
  const matched: Job[] = [];
  for (const raw of jobs) {
    const row = asRecord(raw);
    if (!row) continue;
    const title = String(row.text ?? "");
    const categories = asRecord(row.categories) ?? {};
    const extra = Array.isArray(categories.allLocations)
      ? categories.allLocations.map(String)
      : [];
    const location = [String(categories.location ?? ""), ...extra]
      .filter(Boolean)
      .join(" / ");
    const url = String(row.hostedUrl ?? "");
    if (!url || !matchesRole(title, location, locationId)) continue;
    const description = plainDescription(
      row.descriptionPlain ?? row.description
    );
    matched.push(toJob(company, title, location, url, row.createdAt, description));
  }
  return matched;
}

function toJob(
  company: WatchCompany,
  title: string,
  location: string,
  url: string,
  updated: unknown,
  description: string
): Job {
  return {
    id: `${company.slug}-${jobIdFromUrl(url)}`,
    company: company.name,
    title,
    location,
    tier: tierLetter(company.tier),
    jobUrl: url,
    postedAt: toPostedAt(updated),
    teamHint: company.why,
    requirements: [],
    description,
    early: isEarlyCareer(title),
  };
}

async function jobsFor(
  company: WatchCompany,
  fetchImpl: FetchLike,
  locationId: string
): Promise<Job[]> {
  if (company.ats === "greenhouse") {
    return greenhouseJobs(company, fetchImpl, locationId);
  }
  if (company.ats === "ashby") return ashbyJobs(company, fetchImpl, locationId);
  if (company.ats === "lever") return leverJobs(company, fetchImpl, locationId);
  return [];
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function scanLiveBoards(
  fetchImpl: FetchLike = fetch,
  locationId = "nyc"
): Promise<Job[]> {
  const list = watchCompanies();
  const batches = await pool(list, 8, async (company) => {
    try {
      return await jobsFor(company, fetchImpl, locationId);
    } catch {
      return [] as Job[];
    }
  });
  const jobs = batches.flat();
  jobs.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
    if (Boolean(a.early) !== Boolean(b.early)) return a.early ? -1 : 1;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });
  return jobs;
}
