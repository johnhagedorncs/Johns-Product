import { isEarlyCareer, jobIdFromUrl, plainDescription, tierLetter, toPostedAt } from "@/lib/board-match";
import { atsJobFromUrl, watchEntry } from "@/lib/sources/ats";
import { asRecord, fetchJson, fetchText, type FetchLike } from "@/lib/sources/http";
import { fetchLinkedInPosting, linkedInIdFromUrl } from "@/lib/sources/linkedin";
import type { Job } from "@/lib/types";

/** Workday's JSON endpoint for a public job link (myworkdayjobs.com or myworkdaysite.com). */
export function workdayApiUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split("/").filter(Boolean);
  const jobAt = parts.indexOf("job");
  if (jobAt < 1) return null;
  const rest = parts.slice(jobAt).join("/");
  if (host.endsWith(".myworkdayjobs.com")) {
    const tenant = host.split(".")[0];
    const site = parts[jobAt - 1];
    return `https://${host}/wday/cxs/${tenant}/${site}/${rest}`;
  }
  if (host.endsWith(".myworkdaysite.com") && parts[0] === "recruiting" && jobAt >= 3) {
    return `https://${host}/wday/cxs/${parts[1]}/${parts[2]}/${rest}`;
  }
  return null;
}

type Posting = {
  title: string;
  company: string;
  location: string;
  description: string;
  postedAt?: string;
  applicants?: string;
  companySlug?: string;
};

async function workdayPosting(apiUrl: string, fetchImpl: FetchLike): Promise<Posting | null> {
  const data = asRecord(await fetchJson(apiUrl, fetchImpl));
  const info = asRecord(data?.jobPostingInfo);
  if (!info?.title) return null;
  return {
    title: String(info.title),
    company: String(asRecord(data?.hiringOrganization)?.name ?? ""),
    location: String(info.location ?? ""),
    description: plainDescription(info.jobDescription),
    postedAt: typeof info.startDate === "string" ? toPostedAt(info.startDate) : undefined,
  };
}

/** schema.org JobPosting embedded in most career pages, with a plain-text fallback. */
export function postingFromHtml(html: string): Posting {
  for (const block of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1]) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed, ...(asRecord(parsed)?.["@graph"] as unknown[] ?? [])];
      const posting = items.map(asRecord).find((item) => item?.["@type"] === "JobPosting");
      if (!posting) continue;
      const place = asRecord(Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation);
      const address = asRecord(place?.address);
      return {
        title: String(posting.title ?? ""),
        company: String(asRecord(posting.hiringOrganization)?.name ?? ""),
        location: [address?.addressLocality, address?.addressRegion].filter(Boolean).join(", "),
        description: plainDescription(posting.description),
        postedAt: typeof posting.datePosted === "string" ? toPostedAt(posting.datePosted) : undefined,
      };
    } catch {
      // Malformed JSON-LD — try the next block, then fall back to page text.
    }
  }
  const title =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    "";
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return {
    title: plainDescription(title),
    company: "",
    location: "",
    description: plainDescription(body.replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " ")),
  };
}

async function postingFor(url: string, fetchImpl: FetchLike): Promise<Posting | null> {
  const linkedinId = linkedInIdFromUrl(url);
  if (linkedinId) return fetchLinkedInPosting(linkedinId, fetchImpl);
  const ats = await atsJobFromUrl(url, fetchImpl);
  if (ats) {
    return {
      title: ats.title,
      company: ats.company,
      location: ats.location,
      description: ats.description ?? "",
      postedAt: ats.postedAt,
    };
  }
  const workday = workdayApiUrl(url);
  if (workday) return workdayPosting(workday, fetchImpl);
  return postingFromHtml(await fetchText(url, fetchImpl));
}

/** Description (and LinkedIn applicant count) for a role found without one. */
export async function fetchJobDetail(
  job: Pick<Job, "jobUrl">,
  fetchImpl: FetchLike = fetch
): Promise<{ description: string; applicants?: string }> {
  const posting = await postingFor(job.jobUrl, fetchImpl);
  return {
    description: posting?.description ?? "",
    applicants: posting?.applicants || undefined,
  };
}

function companyFromHost(url: string): string {
  const host = new URL(url).hostname.replace(/^(www|jobs|careers|boards)\./, "");
  const name = host.split(".")[0] ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Build a role from any pasted job link. */
export async function jobFromUrl(url: string, fetchImpl: FetchLike = fetch): Promise<Job> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) throw new Error("Paste a full job link that starts with https://");
  const ats = await atsJobFromUrl(trimmed, fetchImpl).catch(() => null);
  if (ats) return { ...ats, source: "url", sources: [ats.source ?? "url"] };
  const posting = await postingFor(trimmed, fetchImpl);
  if (!posting?.title) throw new Error("Could not read a job posting at that link.");
  const company = posting.company || companyFromHost(trimmed);
  const watch = watchEntry(company);
  const linkedinId = linkedInIdFromUrl(trimmed);
  return {
    id: linkedinId ? `li-${linkedinId}` : `url-${jobIdFromUrl(trimmed)}`,
    company,
    title: posting.title,
    location: posting.location,
    tier: watch ? tierLetter(watch.tier) : "C",
    jobUrl: linkedinId ? `https://www.linkedin.com/jobs/view/${linkedinId}/` : trimmed,
    postedAt: posting.postedAt ?? new Date().toISOString(),
    teamHint: watch?.why ?? "",
    requirements: [],
    description: posting.description,
    early: isEarlyCareer(posting.title),
    source: "url",
    sources: [linkedinId ? "linkedin" : "url"],
    onWatchList: Boolean(watch),
    companyLinkedIn: posting.companySlug ?? watch?.linkedin ?? undefined,
    applicants: posting.applicants || undefined,
  };
}
