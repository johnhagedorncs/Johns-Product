import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  formatStatusLabel,
  getSeedTrackerRows,
  isFollowUpDue,
  mergeTrackerRows,
  parseTrackerOverrides,
} from "@/lib/tracker";
import type { TrackerRow } from "@/lib/types";

const seed: TrackerRow[] = [
  {
    id: "a",
    date: "2026-03-01",
    company: "X",
    role: "Eng",
    jobUrl: "https://example.com",
    person: "Pat",
    linkedinUrl: "https://linkedin.com/in/pat",
    reason: "alum",
    status: "messaged",
    nextFollowup: "2026-03-29",
  },
];

describe("tracker", () => {
  it("starts with no seeded outreach", () => {
    expect(getSeedTrackerRows()).toEqual([]);
  });

  it("schedules follow-ups in business days", () => {
    expect(addBusinessDays(new Date("2026-09-30T12:00:00"), 3)).toBe("2026-10-05");
    expect(addBusinessDays(new Date("2026-10-02T12:00:00"), 1)).toBe("2026-10-05");
  });

  it("merges new override row when person and company set", () => {
    const merged = mergeTrackerRows([], {
      new: {
        id: "new",
        date: "2026-03-29",
        company: "Co",
        person: "Sam",
        role: "Eng",
        jobUrl: "https://example.com",
        linkedinUrl: "https://linkedin.com/in/sam",
        reason: "alum",
        status: "messaged",
        nextFollowup: "2026-04-01",
      },
    });
    expect(merged).toHaveLength(1);
  });

  it("merges local overrides into seed", () => {
    const merged = mergeTrackerRows(seed, {
      a: { status: "replied" },
    });
    expect(merged.find((r) => r.id === "a")?.status).toBe("replied");
  });

  it("detects follow-up due", () => {
    expect(isFollowUpDue("2026-03-29", "2026-03-29")).toBe(true);
    expect(isFollowUpDue("2026-04-01", "2026-03-29")).toBe(false);
    expect(isFollowUpDue("", "2026-03-29")).toBe(false);
  });

  it("parseTrackerOverrides handles null input", () => {
    expect(parseTrackerOverrides(null)).toEqual({});
  });

  it("returns empty object for bad json", () => {
    expect(parseTrackerOverrides("not-json")).toEqual({});
  });

  it("returns empty object for null parse", () => {
    expect(parseTrackerOverrides("null")).toEqual({});
  });

  it("formatStatusLabel covers statuses", () => {
    expect(formatStatusLabel("referred")).toBe("Referred");
  });
});
