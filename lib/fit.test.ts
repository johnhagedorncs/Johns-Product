import { describe, expect, it } from "vitest";
import { combineFit, gradWindow, ruleFit, withFit, yearsRequired } from "@/lib/fit";
import type { Job } from "@/lib/types";

const resume = `John Hagedorn
University of California, Santa Barbara
M.S. in Technology Management Expected June 2027
Python, TypeScript, Go, Docker, Kubernetes, AWS, Terraform, PyTorch, LLM evaluation, MCP`;

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    company: "Cursor",
    title: "Software Engineer, New Grad 2027",
    location: "New York, NY",
    tier: "A",
    jobUrl: "https://jobs.example/j1",
    postedAt: "2026-09-29T00:00:00.000Z",
    teamHint: "",
    requirements: [],
    description:
      "Build infra in Python and Go on Kubernetes and AWS. New grads welcome. Graduating between December 2026 and June 2027.",
    ...overrides,
  };
}

const context = { resumeText: resume, locationId: "nyc" };

describe("yearsRequired", () => {
  it("reads the smallest required years and skips preferred lines", () => {
    expect(yearsRequired("5+ years of experience building APIs. 3-5 years of experience with Go.")).toBe(3);
    expect(yearsRequired("7+ years of experience preferred.")).toBeNull();
    expect(yearsRequired("Experience with 30 years of data.")).toBeNull();
    expect(yearsRequired("No years mentioned.")).toBeNull();
  });
});

describe("gradWindow", () => {
  it("collects years from graduation sentences only", () => {
    expect(gradWindow("Graduation Date: Fall 2026-Summer 2027. Founded in 2015.")).toEqual([2026, 2027]);
    expect(gradWindow("Founded in 2015.")).toEqual([]);
  });
});

describe("ruleFit", () => {
  it("scores a new-grad role that matches the resume as apply now", () => {
    const fit = ruleFit(job(), context);
    expect(fit.score).toBe(5);
    expect(fit.action).toBe("apply_now");
    expect(fit.basis).toBe("rules");
    expect(fit.matchedSkills).toEqual(expect.arrayContaining(["Python", "Go", "Kubernetes", "AWS"]));
    expect(fit.checks?.find((check) => check.label === "Grad date")?.detail).toBe("Targets your 2027 class");
    expect(fit.redFlags).toEqual([]);
  });

  it("caps blocked roles at 2 and says why", () => {
    const fit = ruleFit(
      job({
        title: "Software Engineer",
        description: "Requires 6+ years of experience. Active TS/SCI security clearance. PhD in CS required.",
      }),
      context
    );
    expect(fit.score).toBeLessThanOrEqual(2);
    expect(fit.action).toBe("skip");
    expect(fit.redFlags).toEqual(
      expect.arrayContaining(["6+ years of experience required", "Security clearance required", "PhD required"])
    );
  });

  it("flags a grad window that closes before the candidate graduates", () => {
    const fit = ruleFit(job({ description: "Must graduate by May 2026. Python and Go." }), context);
    expect(fit.redFlags).toContain("Wants grads by 2026; you finish in 2027");
    expect(fit.score).toBeLessThanOrEqual(2);
  });

  it("warns on later grad windows, mid-level years, citizenship, and location", () => {
    const fit = ruleFit(
      job({
        title: "Backend Engineer",
        location: "Austin, TX",
        description:
          "Graduating in 2028 or 2029. 3+ years of experience. Must be a U.S. citizen. Python, Rust, Kafka, Spark, Scala, Java.",
      }),
      context
    );
    const details = fit.checks?.map((check) => check.detail) ?? [];
    expect(details).toContain("Targets 2028/2029 grads; you finish in 2027");
    expect(details).toContain("Asks for 3+ years; you have internships");
    expect(details).toContain("US citizenship required");
    expect(details).toContain("Not listed in New York");
    expect(fit.checks?.find((check) => check.label === "Skills")?.level).toBe("warn");
  });

  it("handles small asks, off-target roles, and title-only scoring", () => {
    expect(ruleFit(job({ description: "2+ years of experience with Python." }), context).checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ detail: "Asks for 2+ years" })])
    );
    expect(ruleFit(job({ description: "1+ years of experience." }), context).checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ detail: "Asks for 1+ years", level: "good" })])
    );
    const analyst = ruleFit(job({ title: "Data Analyst", description: "SQL dashboards." }), context);
    expect(analyst.checks?.find((check) => check.label === "Role")?.level).toBe("warn");
    const titleOnly = ruleFit(job({ description: undefined, title: "Software Engineer" }), context);
    expect(titleOnly.reasons).toContain("No description yet — scored from the title only");
    const midSkills = ruleFit(
      job({ description: "Python, Go, Rust, Kafka, Kubernetes. New grad." }),
      context
    );
    expect(midSkills.checks?.find((check) => check.label === "Skills")?.level).toBe("good");
  });

  it("marks roles not posted as early career", () => {
    const fit = ruleFit(job({ title: "Software Engineer", description: "Build APIs in Python." }), context);
    expect(fit.checks?.find((check) => check.label === "Level")?.level).toBe("warn");
    expect(fit.redFlags).not.toContain("Not labeled early career — expect experienced applicants");
  });
});

describe("combineFit", () => {
  const model = { score: 5, reasons: ["Kubernetes at BrightAI matches infra ask"], gaps: ["Rust"], redFlags: ["On-site in NYC"] };

  it("uses the model score and reasons but keeps rule details", () => {
    const rules = ruleFit(job(), context);
    const fit = combineFit(rules, model);
    expect(fit.score).toBe(5);
    expect(fit.basis).toBe("ai");
    expect(fit.reasons).toEqual(model.reasons);
    expect(fit.gaps).toEqual(["Rust"]);
    expect(fit.redFlags).toContain("On-site in NYC");
    expect(fit.matchedSkills).toEqual(rules.matchedSkills);
  });

  it("caps blocked roles at 2 and non-early roles at 4", () => {
    const blocked = ruleFit(job({ description: "Security clearance required." }), context);
    expect(combineFit(blocked, model).score).toBe(2);
    expect(combineFit(blocked, model).action).toBe("skip");
    const experienced = ruleFit(job({ title: "Software Engineer", description: "Build APIs." }), context);
    expect(combineFit(experienced, model).score).toBe(4);
  });

  it("falls back to rule reasons and skips duplicate flags", () => {
    const rules = ruleFit(job({ description: "Must be a U.S. citizen. New grad." }), context);
    const fit = combineFit(rules, { score: 3, reasons: [], gaps: [], redFlags: ["us citizenship required"] });
    expect(fit.reasons).toEqual(rules.reasons);
    expect(fit.gaps).toEqual(rules.gaps);
    expect(fit.redFlags.filter((flag) => /citizenship/i.test(flag))).toHaveLength(1);
    expect(fit.action).toBe("apply_and_outreach");
  });

  it("attaches a fit to a job", () => {
    const fit = ruleFit(job(), context);
    expect(withFit(job(), fit).fitScore).toBe(fit.score);
  });
});
