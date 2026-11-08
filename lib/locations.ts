export const TARGET_LOCATIONS = [
  { id: "nyc", label: "New York" },
  { id: "sf", label: "San Francisco Bay Area" },
  { id: "seattle", label: "Seattle" },
  { id: "boston", label: "Boston" },
  { id: "austin", label: "Austin" },
  { id: "la", label: "Los Angeles" },
  { id: "chicago", label: "Chicago" },
  { id: "remote", label: "Remote" },
  { id: "any", label: "Any location" },
] as const;

export type LocationId = (typeof TARGET_LOCATIONS)[number]["id"];

export const DEFAULT_LOCATION: LocationId = "nyc";
const MAX_CUSTOM = 80;

const LOCATION_PATTERNS: Record<Exclude<LocationId, "any">, RegExp> = {
  nyc: /new york|nyc|brooklyn|manhattan|queens|bronx/i,
  sf: /san francisco|\bsf\b|bay area|oakland|berkeley|palo alto|mountain view|sunnyvale|san jose|menlo|redwood|cupertino/i,
  seattle: /seattle|bellevue|redmond/i,
  boston: /boston|cambridge|somerville/i,
  austin: /austin/i,
  la: /los angeles|\bla\b|santa monica|culver/i,
  chicago: /chicago/i,
  remote: /remote/i,
};

export function isLocationId(value: unknown): value is LocationId {
  return (
    typeof value === "string" &&
    TARGET_LOCATIONS.some((location) => location.id === value)
  );
}

/**
 * A preset id, or any city the user typed ("Denver, CO", "London"). Typed text
 * that matches a preset label maps to that preset so it keeps its metro regex.
 */
export function normalizeLocation(value: unknown): string {
  if (isLocationId(value)) return value;
  if (typeof value !== "string") return DEFAULT_LOCATION;
  const text = value.replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM);
  if (!text) return DEFAULT_LOCATION;
  const preset = TARGET_LOCATIONS.find(
    (location) => location.label.toLowerCase() === text.toLowerCase()
  );
  if (preset) return preset.id;
  const alias = (Object.keys(LOCATION_PATTERNS) as Array<keyof typeof LOCATION_PATTERNS>).find(
    (id) => id !== "remote" && new RegExp(`^(?:${LOCATION_PATTERNS[id].source})$`, "i").test(text)
  );
  return alias ?? text;
}

export function locationLabel(locationId: string): string {
  const match = TARGET_LOCATIONS.find((location) => location.id === locationId);
  if (match) return match.label;
  const custom = typeof locationId === "string" ? locationId.trim() : "";
  return custom || "New York";
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "Denver, CO" matches postings in Denver; the region alone is too broad. */
function customPattern(location: string): RegExp {
  const city = location.split(",")[0].trim() || location.trim();
  return new RegExp(`\\b${escapeRegex(city)}\\b`, "i");
}

export function locationMatches(location: string, locationId: string): boolean {
  const id = normalizeLocation(locationId);
  if (id === "any") return true;
  if (isLocationId(id)) return LOCATION_PATTERNS[id as Exclude<LocationId, "any">].test(location);
  return customPattern(id).test(location);
}
