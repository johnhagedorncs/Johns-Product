import { afterEach, describe, expect, it } from "vitest";
import {
  PEOPLE_CACHE_KEY,
  readPeopleCache,
  writePeopleCache,
} from "@/lib/people-cache";

const job = { company: "Sierra", title: "Software Engineer" };

describe("people cache", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips people for a role and ignores bad json", () => {
    writePeopleCache(job, "UCSB resume", {
      hooks: ["UCSB"],
      people: [
        { name: "Ada Lovelace", detail: "Engineer", url: "https://company.example/ada" },
      ],
    });
    expect(readPeopleCache(job, "UCSB resume")?.people[0]?.name).toBe("Ada Lovelace");
    expect(readPeopleCache(job, "other resume")).toBeNull();
    expect(readPeopleCache({ company: "Other", title: "SWE" }, "UCSB resume")).toBeNull();
    sessionStorage.setItem(PEOPLE_CACHE_KEY, "{");
    expect(readPeopleCache(job, "UCSB resume")).toBeNull();
    writePeopleCache(job, "UCSB resume", {
      hooks: ["UCSB"],
      people: [{ name: "Sam Okonkwo", detail: "Recruiter" }],
    });
    expect(readPeopleCache(job, "UCSB resume")?.people[0]?.name).toBe("Sam Okonkwo");
  });
});