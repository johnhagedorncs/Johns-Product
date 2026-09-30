import { describe, expect, it } from "vitest";
import { acceptFoundPeople, mergeRolePeople, peopleForRole } from "@/lib/people";
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
    expect(people[0]?.url).toBeUndefined();
  });

  it("keeps found people who have a real profile url", () => {
    const accepted = acceptFoundPeople([
      {
        name: "Ada Lovelace",
        role: "Engineer",
        why: "Same team",
        url: "https://company.example/ada",
      },
      {
        name: "Ada Lovelace",
        role: "Engineer",
        why: "dup",
        url: "https://company.example/ada-2",
      },
      { name: " ", role: "x", why: "x", url: "https://company.example/blank" },
      {
        name: "No Url",
        role: "x",
        why: "x",
        url: "not-a-url",
      },
      {
        name: "Example",
        role: "x",
        why: "x",
        url: "https://example.com/in/example",
      },
      ...["Lee", "Ng", "Wu", "Cho", "Kim", "Park"].map((last, index) => ({
        name: `Alex ${last}`,
        role: "SWE",
        why: "",
        url: `https://company.example/p${index}`,
      })),
    ]);
    expect(accepted[0]).toEqual({
      name: "Ada Lovelace",
      detail: "Engineer · Same team",
      url: "https://company.example/ada",
    });
    expect(accepted).toHaveLength(5);
    expect(accepted.some((person) => person.name === "Example")).toBe(false);
    const named = acceptFoundPeople([
      {
        name: "Charles Tang",
        role: "Engineer",
        why: "NYC infra",
        url: "https://company.example/charles",
      },
      {
        name: "Andrias (last name not specified)",
        role: "Engineer",
        why: "blog",
        url: "https://company.example/andrias",
      },
      {
        name: "Talent Coordinator, Palantir Technologies",
        role: "Recruiter",
        why: "NYC",
        url: "https://company.example/talent",
      },
    ]);
    expect(named.map((person) => person.name)).toEqual(["Charles Tang"]);
  });

  it("lists saved people before newly found ones", () => {
    const merged = mergeRolePeople(
      [{ name: "Priya Shah", detail: "saved" }],
      [
        { name: "priya shah", detail: "found", url: "https://company.example/p" },
        { name: "Sam Okonkwo", detail: "recruiter", url: "https://company.example/s" },
        { name: "  ", detail: "skip" },
      ]
    );
    expect(merged.map((person) => person.name)).toEqual([
      "Priya Shah",
      "Sam Okonkwo",
    ]);
  });
});
