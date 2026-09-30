import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  hookLabels,
  mentionsResumeHook,
  resumeHooks,
} from "@/lib/resume-hooks";

describe("resume hooks", () => {
  it("pulls school, group, and employers from a resume", () => {
    const resume = readFileSync("data/resume.txt", "utf8");
    const hooks = resumeHooks(resume);
    expect(hooks.schools).toEqual(["UCSB", "UC Santa Barbara"]);
    expect(hooks.groups).toEqual(["Zeta Beta Tau"]);
    expect(hooks.employers).toEqual(["BrightAI", "Handshake"]);
    expect(hookLabels(hooks)).toEqual([
      "UCSB",
      "UC Santa Barbara",
      "Zeta Beta Tau",
      "BrightAI",
      "Handshake",
    ]);
  });

  it("reads employers from a pdf-style experience section", () => {
    const resume = `Education
University of California, Santa Barbara
B.S. in Computer Engineering June 2026
Work Experience
AI Engineer Intern June 2026 – September 2026
BrightAI Palo Alto, CA
• Shipped inference.
AI Software Engineer Intern September 2025 – December 2025
Handshake Remote
Software Engineer Team Lead June 2025 – June 2026
UCSB Information Technology Santa Barbara, CA`;
    const hooks = resumeHooks(resume);
    expect(hooks.schools).toEqual(["UCSB", "UC Santa Barbara"]);
    expect(hooks.employers).toEqual(["BrightAI", "Handshake"]);
  });

  it("reads a named university and ignores a resume with no connections", () => {
    expect(resumeHooks("Stanford University\nB.S. Computer Science").schools).toEqual([
      "Stanford University",
    ]);
    expect(hookLabels(resumeHooks("Built APIs."))).toEqual([]);
    expect(mentionsResumeHook("UCSB alum in NYC", ["UCSB"])).toBe(true);
    expect(mentionsResumeHook("Works in the NYC office", ["UCSB"])).toBe(false);
    expect(mentionsResumeHook("UCSB alum", [])).toBe(false);
  });
});