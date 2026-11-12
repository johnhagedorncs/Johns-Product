/**
 * Apollo.io people match: turns a person the user picked (LinkedIn URL, or
 * name + company) into a work email. Each successful email lookup costs one
 * Apollo credit, so it only runs when the user asks for it.
 */

const MATCH_URL = "https://api.apollo.io/api/v1/people/match";

export type ContactQuery = {
  linkedinUrl?: string;
  name?: string;
  company?: string;
};

/** A person matched by an email-lookup service (Hunter or Apollo). */
export type EmailContact = {
  name: string;
  title: string;
  company: string;
  email: string;
  /** Apollo's label, e.g. "verified", "guessed", "unavailable" */
  emailStatus: string;
  linkedinUrl: string;
  /** Apollo: "high" | "medium" | "low"; Hunter: a score like "92%"; "" when unknown */
  confidence: string;
  source?: "hunter" | "apollo";
};

/** Kept for older saved drafts and imports. */
export type ApolloContact = EmailContact;

export function hasApolloConfig(): boolean {
  return Boolean(process.env.APOLLO_API_KEY?.trim());
}

/** First linkedin.com/in/<slug> URL in some text, normalized; "" if none. */
export function extractLinkedInUrl(text: string): string {
  const match = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]+)/i);
  return match ? `https://www.linkedin.com/in/${match[1]}` : "";
}

export function buildMatchParams(query: ContactQuery): URLSearchParams | null {
  const params = new URLSearchParams();
  const url = query.linkedinUrl ? extractLinkedInUrl(query.linkedinUrl) : "";
  const name = query.name?.trim() ?? "";
  const company = query.company?.trim() ?? "";
  if (!url && !(name && company)) return null;
  if (url) params.set("linkedin_url", url);
  if (name) params.set("name", name);
  if (company) params.set("organization_name", company);
  params.set("reveal_personal_emails", "false");
  params.set("reveal_phone_number", "false");
  return params;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Pulls the fields we use out of Apollo's response; null when no one matched. */
export function parseMatch(body: unknown): ApolloContact | null {
  const person = (body as { person?: Record<string, unknown> } | null)?.person;
  if (!person || typeof person !== "object") return null;
  const confidence = str(person.match_confidence);
  if (confidence === "none") return null;
  const org = (person.organization ?? {}) as Record<string, unknown>;
  const email = str(person.email);
  // Apollo masks emails it hasn't unlocked, e.g. "email_not_unlocked@domain.com".
  const usable = email.includes("@") && !email.startsWith("email_not_unlocked");
  return {
    name: str(person.name) || [str(person.first_name), str(person.last_name)].filter(Boolean).join(" "),
    title: str(person.title),
    company: str(org.name),
    email: usable ? email : "",
    emailStatus: usable ? str(person.email_status) : "unavailable",
    linkedinUrl: str(person.linkedin_url),
    confidence,
    source: "apollo",
  };
}

export async function matchContact(query: ContactQuery): Promise<ApolloContact | null> {
  const apiKey = process.env.APOLLO_API_KEY?.trim();
  if (!apiKey) throw new Error("APOLLO_API_KEY is not set");
  const params = buildMatchParams(query);
  if (!params) throw new Error("Need their LinkedIn URL, or their name and company.");

  const response = await fetch(`${MATCH_URL}?${params}`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Apollo rejected the API key (or the plan has no API access).");
  }
  if (response.status === 429) throw new Error("Apollo rate limit hit. Wait a minute and try again.");
  if (!response.ok) throw new Error(`Apollo lookup failed (${response.status}).`);
  return parseMatch(await response.json());
}
