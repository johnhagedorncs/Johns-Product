import { describe, expect, it } from "vitest";
import { locationLabel, locationMatches } from "@/lib/locations";
import { getProfile } from "@/lib/profile";
import {
  defaultSeekerPrefs,
  normalizeSeeker,
  parseSeekerPrefs,
  profileForSeeker,
  tailorCacheKey,
} from "@/lib/seeker";

describe("seeker prefs", () => {
  it("defaults when storage is empty or broken", () => {
    expect(parseSeekerPrefs(null)).toEqual(defaultSeekerPrefs());
    expect(parseSeekerPrefs("{")).toEqual(defaultSeekerPrefs());
    expect(parseSeekerPrefs(JSON.stringify({ locationId: "mars" })).locationId).toBe(
      "nyc"
    );
  });

  it("keeps a valid location and trims oversized fields", () => {
    const seeker = normalizeSeeker({
      name: "A".repeat(200),
      locationId: "sf",
      resumeText: "B".repeat(21000),
      resumeFileName: "C".repeat(200),
    });
    expect(seeker.locationId).toBe("sf");
    expect(seeker.name).toHaveLength(80);
    expect(seeker.resumeText).toHaveLength(20000);
    expect(seeker.resumeFileName).toHaveLength(180);
  });

  it("keeps the saved profile until a name, resume, or new city is set", () => {
    const base = getProfile();
    expect(profileForSeeker(base, defaultSeekerPrefs())).toEqual(base);
    expect(profileForSeeker(base, { ...defaultSeekerPrefs(), locationId: "sf" }).location).toBe(
      "San Francisco Bay Area"
    );
    const named = profileForSeeker(base, {
      ...defaultSeekerPrefs(),
      name: "Alex",
      locationId: "seattle",
    });
    expect(named.name).toBe("Alex");
    expect(named.school).toBe("");
    expect(named.proofPoints).toEqual([]);
    const uploaded = profileForSeeker(base, {
      ...defaultSeekerPrefs(),
      resumeText: "Built compilers and taught interns.",
    });
    expect(uploaded.name).toBe("Candidate");
    expect(uploaded.summary).toContain("compilers");
  });

  it("matches each target city", () => {
    expect(locationLabel("mars")).toBe("New York");
    expect(locationMatches("Seattle, WA", "seattle")).toBe(true);
    expect(locationMatches("Boston, MA", "boston")).toBe(true);
    expect(locationMatches("Los Angeles, CA", "la")).toBe(true);
    expect(locationMatches("Chicago, IL", "chicago")).toBe(true);
    expect(locationMatches("New York, NY", "sf")).toBe(false);
  });

  it("keys tailored resumes by uploaded text", () => {
    expect(tailorCacheKey("job-1", "  ")).toBe("job-1");
    expect(tailorCacheKey("job-1", "same resume")).toBe(
      tailorCacheKey("job-1", "same resume")
    );
    expect(tailorCacheKey("job-1", "other")).not.toBe(
      tailorCacheKey("job-1", "same resume")
    );
  });
});
