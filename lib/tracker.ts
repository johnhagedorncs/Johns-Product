import trackerSeed from "@/data/tracker.json";
import type { TrackerRow, TrackerStatus } from "@/lib/types";

export const TRACKER_STORAGE_KEY = "warm-apply-tracker";

export function getSeedTrackerRows(): TrackerRow[] {
  return trackerSeed as TrackerRow[];
}

export function mergeTrackerRows(
  seed: TrackerRow[],
  overrides: Record<string, Partial<TrackerRow>>
): TrackerRow[] {
  const byId = new Map(seed.map((r) => [r.id, { ...r }]));
  for (const [id, patch] of Object.entries(overrides)) {
    const existing = byId.get(id);
    if (existing) {
      byId.set(id, { ...existing, ...patch });
    } else if (patch.person && patch.company) {
      byId.set(id, patch as TrackerRow);
    }
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function isFollowUpDue(
  nextFollowup: string,
  todayIso: string
): boolean {
  if (!nextFollowup) return false;
  return nextFollowup <= todayIso;
}

export function parseTrackerOverrides(raw: string | null): Record<
  string,
  Partial<TrackerRow>
> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<TrackerRow>>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function formatStatusLabel(status: TrackerStatus): string {
  const labels: Record<TrackerStatus, string> = {
    queued: "Queued",
    messaged: "Messaged",
    replied: "Replied",
    chat: "Chat scheduled",
    referred: "Referred",
    no: "No / closed",
  };
  return labels[status];
}

/** Date string N business days after `from` (weekends skipped). */
export function addBusinessDays(from: Date, days: number): string {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}
