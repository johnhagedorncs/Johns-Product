/**
 * Hunter.io Email Finder: LinkedIn URL, or name + company → work email.
 * The free plan includes the API (50 credits a month); no credit is used
 * when no email is found.
 */
import { extractLinkedInUrl, type ContactQuery, type EmailContact } from "@/lib/apollo";

const FINDER_URL = "https://api.hunter.io/v2/email-finder";

export function hasHunterConfig(): boolean {
  return Boolean(process.env.HUNTER_API_KEY?.trim());
}

export function buildFinderParams(query: ContactQuery): URLSearchParams | null {
  const url = query.linkedinUrl ? extractLinkedInUrl(query.linkedinUrl) : "";
  const name = query.name?.trim() ?? "";
  const company = query.company?.trim() ?? "";
  if (!url && !(name && company)) return null;
  const params = new URLSearchParams();
  if (url) params.set("linkedin_handle", url);
  // Hunter falls back to name + company when the LinkedIn handle isn't on file.
  if (company) params.set("company", company);
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      params.set("first_name", parts[0]);
      params.set("last_name", parts.slice(1).join(" "));
    } else {
      params.set("full_name", name);
    }
  }
  params.set("max_duration", "15");
  return params;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseFinder(body: unknown): EmailContact | null {
  const data = (body as { data?: Record<string, unknown> } | null)?.data;
  if (!data || typeof data !== "object") return null;
  const email = str(data.email);
  const verification = (data.verification ?? {}) as Record<string, unknown>;
  const score = typeof data.score === "number" ? data.score : null;
  return {
    name: [str(data.first_name), str(data.last_name)].filter(Boolean).join(" "),
    title: str(data.position),
    company: str(data.company),
    email,
    // valid | accept_all | unknown — "" when Hunter didn't verify it
    emailStatus: email ? str(verification.status) || "unverified" : "unavailable",
    linkedinUrl: str(data.linkedin_url),
    confidence: score === null ? "" : `${score}%`,
    source: "hunter",
  };
}

function hunterError(status: number, body: unknown): string {
  const first = (body as { errors?: { id?: string; details?: string }[] } | null)?.errors?.[0];
  if (status === 401) return "Hunter rejected the API key. Check HUNTER_API_KEY.";
  if (status === 403) return "Hunter rate limit hit. Wait a moment and try again.";
  if (status === 429) return "Out of Hunter credits for this month.";
  if (status === 451) return "This person asked not to have their email looked up. Pick someone else.";
  if (first?.id === "invalid_linkedin_handle") return "Hunter couldn't read that LinkedIn URL. Paste their profile too.";
  return first?.details ? `Hunter: ${first.details}` : `Hunter lookup failed (${status}).`;
}

export async function findWithHunter(query: ContactQuery): Promise<EmailContact | null> {
  const apiKey = process.env.HUNTER_API_KEY?.trim();
  if (!apiKey) throw new Error("HUNTER_API_KEY is not set");
  const params = buildFinderParams(query);
  if (!params) throw new Error("Need their LinkedIn URL, or their name and company.");

  const response = await fetch(`${FINDER_URL}?${params}`, {
    headers: { "X-API-KEY": apiKey },
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(hunterError(response.status, body));
  return parseFinder(body);
}
