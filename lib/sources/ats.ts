import companiesFile from "@/data/companies.json";
import {
  isEarlyCareer,
  jobIdFromUrl,
  matchesRole,
  plainDescription,
  tierLetter,
  toPostedAt,
} from "@/lib/board-match";
import { asRecord, fetchJson, pool, type FetchLike } from "@/lib/sources/http";
import type { Job, JobSource } from "@/lib/types";

export type WatchCompany = {
  name: string;
  tier: number;
  ats: string;
  slug: string | null;
  why: string;
};

const companies = (companiesFile as { companies: WatchCompany[] }).companies;

export function watchList(): WatchCompany[] {
  return companies;
}

export function watchCompanies(): WatchCompany[] {
  return companies.filter(
    (c) => (c.ats === "greenhouse" || c.ats === "ashby" || c.ats === "lever") && c.slug
  );
}

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s*\/.*$/, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|technologies|labs|ai|hq)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Watch-list entry for a company name from any board, so off-list sources still get a tier. */
export function watchEntry(company: string): WatchCompany | undefined {
  const key = normalizeCompany(company);
  if (!key) return undefined;
  return companies.find((c) => normalizeCompany(c.name) === key);
}

type Raw = {
  title: string;
  location: string;
  url: string;
  posted: unknown;
  description: string;
  team?: string;
};

function toJob(company: WatchCompany, source: JobSource, raw: Raw): Job {
  return {
    id: `${company.slug}-${jobIdFromUrl(raw.url)}`,
    company: company.name,
    title: raw.title.trim(),
    location: raw.location,
    tier: tierLetter(company.tier),
    jobUrl: raw.url,
    postedAt: toPostedAt(raw.posted),
    teamHint: raw.team || company.why,
    requirements: [],
    description: raw.description,
    early: isEarlyCareer(raw.title),
    source,
    sources: [source],
    onWatchList: true,
  };
}

function greenhouseDetail(row: Record<string, unknown> | null): {
  description: string;
  team?: string;
} {
  const departments = Array.isArray(row?.departments) ? row.departments : [];
  const team = departments
    .map((item) => String(asRecord(item)?.name ?? ""))
    .filter(Boolean)
    .join(" · ");
  return { description: plainDescription(row?.content), team: team || undefined };
}

async function greenhouseJobs(
  company: WatchCompany,
  fetchImpl: FetchLike,
  locationId: string
): Promise<Job[]> {
  const data = asRecord(
    await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs`, fetchImpl)
  );
  const rows = (Array.isArray(data?.jobs) ? data.jobs : [])
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .filter((row) =>
      matchesRole(String(row.title ?? ""), String(asRecord(row.location)?.name ?? ""), locationId)
    )
    .filter((row) => row.absolute_url);

  return pool(rows, 6, async (row) => {
    let detail: { description: string; team?: string } = { description: "" };
    try {
      detail = greenhouseDetail(
        asRecord(
          await fetchJson(
            `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs/${row.id}`,
            fetchImpl
          )
        )
      );
    } catch {
      // The list still has title/location; the job page fetches the text again.
    }
    return toJob(company, "greenhouse", {
      title: String(row.title ?? ""),
      location: String(asRecord(row.location)?.name ?? ""),
      url: String(row.absolute_url),
      posted: row.first_published ?? row.updated_at,
      ...detail,
    });
  });
}

function ashbyRaw(row: Record<string, unknown>): Raw {
  const secondary = Array.isArray(row.secondaryLocations)
    ? row.secondaryLocations.map((item) => String(asRecord(item)?.location ?? "")).filter(Boolean)
    : [];
  return {
    title: String(row.title ?? ""),
    location: [String(row.location ?? ""), ...secondary].filter(Boolean).join(" / "),
    url: String(row.jobUrl ?? ""),
    posted: row.publishedAt,
    description: plainDescription(row.descriptionPlain ?? row.descriptionHtml),
    team: [row.department, row.team].filter((v) => typeof v === "string" && v).join(" · ") || undefined,
  };
}

async function ashbyJobs(company: WatchCompany, fetchImpl: FetchLike, locationId: string): Promise<Job[]> {
  const data = asRecord(
    await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${company.slug}`, fetchImpl)
  );
  const jobs: Job[] = [];
  for (const raw of Array.isArray(data?.jobs) ? data.jobs : []) {
    const row = asRecord(raw);
    if (!row || row.isListed === false) continue;
    const item = ashbyRaw(row);
    if (!item.url || !matchesRole(item.title, item.location, locationId)) continue;
    jobs.push(toJob(company, "ashby", item));
  }
  return jobs;
}

function leverRaw(row: Record<string, unknown>): Raw {
  const categories = asRecord(row.categories) ?? {};
  const extra = Array.isArray(categories.allLocations) ? categories.allLocations.map(String) : [];
  const lists = (Array.isArray(row.lists) ? row.lists : [])
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => `${String(item.text ?? "")}\n${plainDescription(item.content)}`)
    .join("\n\n");
  const description = [
    plainDescription(row.descriptionPlain ?? row.description),
    lists,
    plainDescription(row.additionalPlain ?? row.additional),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
  return {
    title: String(row.text ?? ""),
    location: [...new Set([String(categories.location ?? ""), ...extra].filter(Boolean))].join(" / "),
    url: String(row.hostedUrl ?? ""),
    posted: row.createdAt,
    description,
    team: typeof categories.team === "string" ? categories.team : undefined,
  };
}

async function leverJobs(company: WatchCompany, fetchImpl: FetchLike, locationId: string): Promise<Job[]> {
  const data = await fetchJson(`https://api.lever.co/v0/postings/${company.slug}?mode=json`, fetchImpl);
  const jobs: Job[] = [];
  for (const raw of Array.isArray(data) ? data : []) {
    const row = asRecord(raw);
    if (!row) continue;
    const item = leverRaw(row);
    if (!item.url || !matchesRole(item.title, item.location, locationId)) continue;
    jobs.push(toJob(company, "lever", item));
  }
  return jobs;
}

export async function jobsForCompany(
  company: WatchCompany,
  fetchImpl: FetchLike,
  locationId: string
): Promise<Job[]> {
  if (company.ats === "greenhouse") return greenhouseJobs(company, fetchImpl, locationId);
  if (company.ats === "ashby") return ashbyJobs(company, fetchImpl, locationId);
  if (company.ats === "lever") return leverJobs(company, fetchImpl, locationId);
  return [];
}

export async function scanWatchList(
  fetchImpl: FetchLike = fetch,
  locationId = "nyc"
): Promise<{ jobs: Job[]; failed: string[] }> {
  const failed: string[] = [];
  const batches = await pool(watchCompanies(), 8, async (company) => {
    try {
      return await jobsForCompany(company, fetchImpl, locationId);
    } catch {
      failed.push(company.name);
      return [] as Job[];
    }
  });
  return { jobs: batches.flat(), failed };
}

/** Single posting from a pasted Greenhouse / Ashby / Lever link. */
export async function atsJobFromUrl(url: string, fetchImpl: FetchLike = fetch): Promise<Job | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split("/").filter(Boolean);

  const ghId = parsed.searchParams.get("gh_jid");
  if (host.includes("greenhouse.io") || ghId) {
    const slug = host.includes("greenhouse.io") ? parts[0] : parsed.searchParams.get("for") ?? "";
    const id = ghId ?? parts[parts.indexOf("jobs") + 1];
    if (!slug || !id) return null;
    const row = asRecord(
      await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${id}`, fetchImpl)
    );
    if (!row?.title) return null;
    return pastedJob(slug, String(row.company_name ?? slug), "greenhouse", {
      title: String(row.title),
      location: String(asRecord(row.location)?.name ?? ""),
      url: String(row.absolute_url ?? url),
      posted: row.first_published ?? row.updated_at,
      ...greenhouseDetail(row),
    });
  }

  if (host === "jobs.ashbyhq.com" && parts.length >= 2) {
    const [slug, id] = parts;
    const data = asRecord(
      await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, fetchImpl)
    );
    const row = (Array.isArray(data?.jobs) ? data.jobs : [])
      .map(asRecord)
      .find((item) => item?.id === id);
    if (!row) return null;
    return pastedJob(slug, slug, "ashby", ashbyRaw(row));
  }

  if (host === "jobs.lever.co" && parts.length >= 2) {
    const [slug, id] = parts;
    const row = asRecord(await fetchJson(`https://api.lever.co/v0/postings/${slug}/${id}`, fetchImpl));
    if (!row?.text) return null;
    return pastedJob(slug, slug, "lever", leverRaw(row));
  }

  return null;
}

function pastedJob(slug: string, name: string, source: JobSource, raw: Raw): Job {
  const known = companies.find((c) => c.slug === slug) ?? watchEntry(name);
  if (known) return toJob({ ...known, slug }, source, raw);
  const label = name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { ...toJob({ name: label, tier: 3, ats: source, slug, why: "" }, source, raw), onWatchList: false };
}
