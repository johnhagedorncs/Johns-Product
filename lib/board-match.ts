import { locationMatches } from "@/lib/locations";
import type { JobTier } from "@/lib/types";

export const FAMILY =
  /software|engineer|developer|forward deployed|forward-deployed|deployment|solutions|applied ai|machine learning|\bml\b|research engineer|infrastructure|platform|devops|\bsre\b|data engineer|data scientist|technical program|product manager|\bapm\b/i;

export const EXCLUDE =
  /account executive|business development|recruit|counsel|senior|\bsr\.?\b|staff|principal|\blead\b|manager(?!.*\bassociate\b)|director|head of|\bvp\b|architect|\biii\b|\biv\b|\b3\b|phd|intern\b/i;

export const EARLY =
  /new grad|new graduate|early career|university|entry|2027|\bi\b$|associate/i;

export const BOARD_USER_AGENT = "Mozilla/5.0 warm-apply";

export function matchesRole(
  title: string,
  location: string,
  locationId = "nyc"
): boolean {
  return (
    locationMatches(location, locationId) &&
    FAMILY.test(title) &&
    !EXCLUDE.test(title)
  );
}

export function isEarlyCareer(title: string): boolean {
  return EARLY.test(title);
}

export function tierLetter(tier: number): JobTier {
  if (tier <= 1) return "A";
  if (tier === 2) return "B";
  return "C";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    );
}

export function stripHtml(html: string): string {
  let text = html;
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = decodeEntities(text);
    if (decoded === text) break;
    text = decoded;
  }
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function plainDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = /[<&]/.test(value) ? stripHtml(value) : value.trim();
  return text.slice(0, 12000);
}

export function toPostedAt(updated: unknown): string {
  if (typeof updated === "number" && Number.isFinite(updated)) {
    return new Date(updated).toISOString();
  }
  if (typeof updated === "string" && updated) {
    const parsed = new Date(updated);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

export function jobIdFromUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
