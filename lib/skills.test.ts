import { describe, expect, it } from "vitest";
import { extractSkills, matchSkills } from "@/lib/skills";

describe("extractSkills", () => {
  it("finds languages, infra, and AI terms", () => {
    const skills = extractSkills(
      "Python, TypeScript, Go, and C++. Kubernetes on AWS with Terraform. LLM evals, multi-agent systems, MCP."
    );
    expect(skills).toEqual(
      expect.arrayContaining(["Python", "TypeScript", "Go", "C++", "Kubernetes", "AWS", "Terraform", "LLMs", "LLM evaluation", "AI agents", "MCP"])
    );
  });

  it("ignores everyday words that look like skills", () => {
    const skills = extractSkills("The rest of the team will go to Series C. Nodes talk to customers.");
    expect(skills).not.toContain("REST APIs");
    expect(skills).not.toContain("Go");
    expect(skills).not.toContain("JavaScript");
    expect(extractSkills("")).toEqual([]);
  });
});

describe("matchSkills", () => {
  it("splits posting skills into on-resume and missing", () => {
    const result = matchSkills("Python, Kubernetes, PyTorch", "We use Python, Rust, Kubernetes, and Kafka.");
    expect(result.matched).toEqual(["Python", "Kubernetes"]);
    expect(result.missing).toEqual(["Rust", "Kafka"]);
    expect(result.coverage).toBe(0.5);
  });

  it("does not judge coverage from fewer than three skills", () => {
    expect(matchSkills("Python", "Python role").coverage).toBeNull();
  });
});
