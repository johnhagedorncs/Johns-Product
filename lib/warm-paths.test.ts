import { describe, expect, it } from "vitest";
import {
  googleProfilesUrl,
  linkedInPeopleUrl,
  pathsWithLinkedInResults,
  roleFunction,
  searchCompanyName,
  warmPaths,
} from "@/lib/warm-paths";

const hooks = { schools: ["UCSB"], groups: ["Zeta Beta Tau"], employers: ["BrightAI", "Anthropic"] };

describe("warmPaths", () => {
  it("ranks group, school, function, recruiter, then past employers", () => {
    const paths = warmPaths({ company: "Anthropic", title: "Forward Deployed Engineer" }, hooks, "nyc");
    expect(paths.map((path) => [path.kind, path.points])).toEqual([
      ["group", 4],
      ["function", 4],
      ["school", 3],
      ["recruiter", 3],
      ["employer", 2],
    ]);
    expect(paths.find((path) => path.kind === "employer")?.label).toBe("Ex-BrightAI at Anthropic");
  });

  it("searches every way people write the school, anywhere, and the team in the target city", () => {
    const paths = warmPaths({ company: "Anthropic", title: "Software Engineer" }, hooks, "nyc");
    const school = new URL(paths.find((path) => path.kind === "school")!.linkedinUrl);
    expect(school.searchParams.get("keywords")).toBe(
      'Anthropic (UCSB OR "UC Santa Barbara" OR "University of California, Santa Barbara")'
    );
    expect(school.searchParams.get("geoUrn")).toBeNull();
    const team = new URL(paths.find((path) => path.kind === "function")!.linkedinUrl);
    expect(team.searchParams.get("keywords")).toBe('Anthropic "software engineer"');
    expect(team.searchParams.get("geoUrn")).toBe('["90000070"]');
    const group = new URL(paths[0].linkedinUrl);
    expect(group.searchParams.get("keywords")).toBe('Anthropic ("Zeta Beta Tau" OR ZBT)');
  });

  it("still gives team and recruiter paths with no resume hooks", () => {
    const paths = warmPaths({ company: "Google (NYC)", title: "APM" }, { schools: [], groups: [], employers: [] }, "sf");
    expect(paths.map((path) => path.kind)).toEqual(["function", "recruiter"]);
    expect(paths[0].label).toBe("Product managers at Google");
    expect(
      pathsWithLinkedInResults(paths, { [`${paths[0].id}`]: false }).map((path) => path.kind)
    ).toEqual(["recruiter"]);
    expect(pathsWithLinkedInResults(paths, {}).map((path) => path.kind)).toEqual([
      "function",
      "recruiter",
    ]);
    expect(new URL(paths[0].linkedinUrl).searchParams.get("geoUrn")).toBeNull();
  });
});

describe("search helpers", () => {
  it("maps titles to the people to search for", () => {
    expect(roleFunction("Solutions Engineer").keyword).toBe("solutions engineer");
    expect(roleFunction("ML Engineer, New Grad").keyword).toBe("machine learning engineer");
    expect(roleFunction("Applied AI Engineer").keyword).toBe("AI engineer");
    expect(roleFunction("Data Engineer").keyword).toBe("data engineer");
    expect(roleFunction("Platform Engineer").keyword).toBe("infrastructure engineer");
    expect(roleFunction("Backend Engineer").keyword).toBe("software engineer");
  });

  it("cleans company names and builds search links", () => {
    expect(searchCompanyName("Amazon / AWS (NYC)")).toBe("Amazon");
    expect(linkedInPeopleUrl("x")).toContain("linkedin.com/search/results/people/");
    expect(new URL(googleProfilesUrl('"Ramp" UCSB')).searchParams.get("q")).toBe('site:linkedin.com/in "Ramp" UCSB');
  });
});
