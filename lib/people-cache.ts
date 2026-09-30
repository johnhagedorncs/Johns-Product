import type { RolePerson } from "@/lib/people";
import { tailorCacheKey } from "@/lib/seeker";

export const PEOPLE_CACHE_KEY = "warm-apply-people-v4";

export type PeopleCacheEntry = {
  hooks: string[];
  people: RolePerson[];
};

export function peopleCacheKey(
  job: { company: string; title: string },
  resumeText: string
): string {
  return `${job.company.trim().toLowerCase()}|${tailorCacheKey(job.title, resumeText)}`;
}

export function readPeopleCache(
  job: { company: string; title: string },
  resumeText: string
): PeopleCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PEOPLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, PeopleCacheEntry>;
    const entry = parsed[peopleCacheKey(job, resumeText)];
    if (!entry || !Array.isArray(entry.people)) return null;
    return {
      hooks: Array.isArray(entry.hooks) ? entry.hooks : [],
      people: entry.people.filter((person) => person && typeof person.name === "string"),
    };
  } catch {
    return null;
  }
}

export function writePeopleCache(
  job: { company: string; title: string },
  resumeText: string,
  entry: PeopleCacheEntry
): void {
  if (typeof window === "undefined") return;
  let store: Record<string, PeopleCacheEntry> = {};
  try {
    const raw = sessionStorage.getItem(PEOPLE_CACHE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, PeopleCacheEntry>)
      : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      store = parsed;
    }
  } catch {
    store = {};
  }
  store[peopleCacheKey(job, resumeText)] = entry;
  sessionStorage.setItem(PEOPLE_CACHE_KEY, JSON.stringify(store));
}
