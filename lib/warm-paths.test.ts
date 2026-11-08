import { describe, expect, it } from "vitest";
import {
  companyFilterName,
  linkedInPeopleSearchUrl,
  pathsWithPeople,
  quoteProves,
  roleFunction,
  searchCompanyName,
  warmPaths,
} from "@/lib/warm-paths";

const hooks = { schools: ["UCSB"], groups: ["Zeta Beta Tau"], employers: ["BrightAI", "Anthropic"] };
const none = { schools: [], groups: [], employers: [] };

function params(url: string) {
  return new URL(url).searchParams;
}

describe("warmPaths", () => {
  it("ranks group, school, function, recruiter, then past employers", () => {
    const paths = warmPaths({ company: "Anthropic", title: "Forward Deployed Engineer" }, hooks);
    expect(paths.map((path) => [path.kind, path.points])).toEqual([
      ["group", 4],
      ["function", 4],
      ["school", 3],
      ["recruiter", 3],
      ["employer", 2],
    ]);
    expect(paths.find((path) => path.kind === "employer")?.label).toBe("Ex-BrightAI at Anthropic");
  });

  it("links each path to a people search filtered to exactly that group", () => {
    const paths = warmPaths({ company: "BeaconFire Inc.", title: "Software Engineer" }, hooks);
    const byKind = (kind: string) => params(paths.find((path) => path.kind === kind)!.url);

    expect(paths[0].url.startsWith("https://www.linkedin.com/search/results/people/?")).toBe(true);
    expect(byKind("function").get("company")).toBe("BeaconFire");
    expect(byKind("function").get("title")).toBe("software engineer");
    expect(byKind("recruiter").get("title")).toBe("recruiter");
    expect(byKind("school").get("school")).toBe("University of California Santa Barbara");
    expect(byKind("school").get("keywords")).toBeNull();
    expect(byKind("employer").get("keywords")).toBe("BrightAI");
    expect(byKind("group").get("keywords")).toBe('"Zeta Beta Tau"');
    expect(paths.find((path) => path.kind === "employer")!.checkQuery).toBe('site:linkedin.com/in BeaconFire BrightAI');
  });

  it("still gives team and recruiter paths with no resume hooks", () => {
    const paths = warmPaths({ company: "Google (NYC)", title: "APM" }, none);
    expect(paths.map((path) => path.kind)).toEqual(["function", "recruiter"]);
    expect(paths[0].label).toBe("Product managers at Google");
  });
});

describe("pathsWithPeople", () => {
  it("hides a shared tie unless someone was found, and always keeps team and recruiter", () => {
    const paths = warmPaths({ company: "BeaconFire Inc.", title: "SWE" }, { schools: ["UCSB"], groups: [], employers: ["BrightAI"] });
    expect(pathsWithPeople(paths, {}).map((path) => path.kind)).toEqual(["function", "recruiter"]);
    expect(
      pathsWithPeople(paths, { "school:UCSB": true, "employer:BrightAI": false }).map((path) => path.kind)
    ).toEqual(["function", "school", "recruiter"]);
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
    expect(companyFilterName("BeaconFire Inc.")).toBe("BeaconFire");
    expect(companyFilterName("Acme, LLC")).toBe("Acme");
    expect(companyFilterName("Two Sigma")).toBe("Two Sigma");
    expect(params(linkedInPeopleSearchUrl({ company: "Ramp", title: "recruiter" })).get("origin")).toBe("FACETED_SEARCH");
  });
});
