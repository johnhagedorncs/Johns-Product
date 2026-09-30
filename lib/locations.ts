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

export function locationLabel(locationId: string): string {
  const match = TARGET_LOCATIONS.find((location) => location.id === locationId);
  return match?.label ?? "New York";
}

export function locationMatches(location: string, locationId: string): boolean {
  const id: LocationId = isLocationId(locationId) ? locationId : "nyc";
  if (id === "any") return true;
  return LOCATION_PATTERNS[id].test(location);
}
