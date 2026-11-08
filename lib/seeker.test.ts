import { describe, expect, it } from "vitest";
import { locationLabel, locationMatches, normalizeLocation } from "@/lib/locations";
import { linkedInLocation } from "@/lib/sources/linkedin";
import { getProfile } from "@/lib/profile";
import {
  defaultSeekerPrefs,
  normalizeSeeker,
  parseSeekerPrefs,
  effectiveResume,
  profileForSeeker,
  resumeSnapshot,
  tailorCacheKey,
  textHash,
} from "@/lib/seeker";

describe("seeker prefs", () => {
  it("defaults when storage is empty or broken", () => {
    expect(parseSeekerPrefs(null)).toEqual(defaultSeekerPrefs());
    expect(parseSeekerPrefs("{")).toEqual(defaultSeekerPrefs());
    expect(parseSeekerPrefs(JSON.stringify({ locationId: 42 })).locationId).toBe("nyc");
    expect(parseSeekerPrefs(JSON.stringify({ locationId: "  " })).locationId).toBe("nyc");
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
    expect(uploaded.name).toBe("John");
    expect(uploaded.school).toBe("UC Santa Barbara");
    expect(uploaded.summary).toContain("compilers");
  });

  it("matches each target city", () => {
    expect(locationLabel("")).toBe("New York");
    expect(locationMatches("Seattle, WA", "seattle")).toBe(true);
    expect(locationMatches("Boston, MA", "boston")).toBe(true);
    expect(locationMatches("Los Angeles, CA", "la")).toBe(true);
    expect(locationMatches("Chicago, IL", "chicago")).toBe(true);
    expect(locationMatches("New York, NY", "sf")).toBe(false);
  });

  it("accepts any typed city", () => {
    expect(normalizeLocation("Denver, CO")).toBe("Denver, CO");
    expect(normalizeLocation("  san francisco bay area ")).toBe("sf");
    expect(normalizeLocation("NYC")).toBe("nyc");
    expect(locationLabel("Denver, CO")).toBe("Denver, CO");
    expect(locationMatches("Denver, Colorado, United States", "Denver, CO")).toBe(true);
    expect(locationMatches("Austin, TX", "Denver, CO")).toBe(false);
    expect(locationMatches("St. Louis, MO", "St. Louis")).toBe(true);
    expect(normalizeSeeker({ locationId: "London" }).locationId).toBe("London");
    expect(linkedInLocation("Denver, CO")).toBe("Denver, CO");
    expect(linkedInLocation("nyc")).toBe("New York City Metropolitan Area");
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

  it("scores against the saved resume until a PDF is uploaded", () => {
    expect(effectiveResume(defaultSeekerPrefs())).toContain("BrightAI");
    expect(effectiveResume({ ...defaultSeekerPrefs(), resumeText: "Uploaded text" })).toBe("Uploaded text");
    expect(textHash("a")).toBe(textHash(" a "));
    expect(textHash("a")).not.toBe(textHash("b"));
  });

  it("summarizes what the scorer will read", () => {
    const saved = resumeSnapshot(defaultSeekerPrefs());
    expect(saved).toMatchObject({ source: "saved", fileName: "Saved resume", gradYear: 2027 });
    expect(saved.skills).toEqual(expect.arrayContaining(["Python", "Kubernetes", "PyTorch"]));
    expect(saved.hooks).toContain("UCSB");
    const uploaded = resumeSnapshot({ ...defaultSeekerPrefs(), resumeText: "Rust only", resumeFileName: "" });
    expect(uploaded).toMatchObject({ source: "upload", fileName: "Uploaded PDF", gradYear: null, skills: ["Rust"], hooks: [] });
  });
});
