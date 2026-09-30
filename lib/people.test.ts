import { describe, expect, it } from "vitest";
import { peopleForRole } from "@/lib/people";
import type { OutreachContact, TrackerRow } from "@/lib/types";

const contact: OutreachContact = {
  jobId: "job-1",
  name: "Maya Lin",
  linkedinUrl: "https://example.com",
  relationship: "ucsb",
  roleRelevance: "same_function",
  why: "Same school",
  draftMessage: "Hi",
  rankScore: 7,
};

const row: TrackerRow = {
  id: "trk-1",
  date: "2026-03-01",
  company: "Cursor",
  role: "SWE",
  jobUrl: "https://example.com",
  person: "Maya Lin",
  linkedinUrl: "",
  reason: "alum",
  status: "messaged",
  nextFollowup: "",
};

describe("peopleForRole", () => {
  it("lists outreach and tracker people once, for this company", () => {
    const people = peopleForRole(
      { id: "job-1", company: "cursor" },
      [
        row,
        { ...row, id: "trk-2", person: "  ", company: "Cursor" },
        { ...row, id: "trk-3", person: "Sam Okonkwo", company: "Palantir" },
        {
          ...row,
          id: "trk-4",
          person: "Jordan Park",
          company: "Cursor",
          role: "",
          status: "queued",
        },
      ],
      [{ ...contact, why: "" }, { ...contact, jobId: "other", name: "Alex Rivera" }]
    );
    expect(people.map((person) => person.name)).toEqual([
      "Maya Lin",
      "Jordan Park",
    ]);
    expect(people[0]?.detail).toBe("ucsb");
    expect(people[1]?.detail).toBe("queued");
  });
});
