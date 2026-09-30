import { describe, expect, it } from "vitest";
import { savedResumeText } from "@/lib/profile";
import {
  gradYear,
  hookAliases,
  hookLabels,
  mentionsResumeHook,
  resumeHooks,
} from "@/lib/resume-hooks";

describe("resume hooks", () => {
  it("pulls school and employers from the saved resume", () => {
    const hooks = resumeHooks(savedResumeText());
    expect(hooks.schools).toEqual(["UCSB"]);
    expect(hooks.employers).toEqual(expect.arrayContaining(["BrightAI", "Handshake"]));
    expect(hooks.employers.some((employer) => /ucsb/i.test(employer))).toBe(false);
  });

  it("reads groups and dash-style roles", () => {
    const hooks = resumeHooks(`Zeta Beta Tau, Gamma Xi
BrightAI — AI Engineering Intern
Handshake — Software Engineering Intern
UCSB Information Technology — Team Lead`);
    expect(hooks.groups).toEqual(["Zeta Beta Tau"]);
    expect(hooks.employers).toEqual(["BrightAI", "Handshake"]);
    expect(hookLabels(hooks)).toEqual(["UCSB", "Zeta Beta Tau", "BrightAI", "Handshake"]);
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
    expect(hooks.schools).toEqual(["UCSB"]);
    expect(hooks.employers).toEqual(["BrightAI", "Handshake"]);
  });

  it("reads a named university and ignores a resume with no connections", () => {
    expect(resumeHooks("Stanford University\nB.S. Computer Science").schools).toEqual(["Stanford University"]);
    expect(resumeHooks("Studied at the university of somewhere").schools).toEqual(["Studied at the university of somewhere"]);
    expect(hookLabels(resumeHooks("Built APIs."))).toEqual([]);
  });

  it("matches a hook under any of its names", () => {
    expect(hookAliases("UCSB")).toEqual(["UCSB", "UC Santa Barbara", "University of California, Santa Barbara"]);
    expect(hookAliases("BrightAI")).toEqual(["BrightAI"]);
    expect(mentionsResumeHook("UC Santa Barbara alum in NYC", ["UCSB"])).toBe(true);
    expect(mentionsResumeHook("Fellow ZBT brother", ["Zeta Beta Tau"])).toBe(true);
    expect(mentionsResumeHook("Zeta Beta Tau at Penn", ["Zeta Beta Tau"])).toBe(true);
    expect(mentionsResumeHook("Works in the NYC office", ["UCSB"])).toBe(false);
    expect(mentionsResumeHook("UCSB alum", [])).toBe(false);
  });

  it("finds the latest graduation year on a degree line", () => {
    expect(gradYear(savedResumeText())).toBe(2027);
    expect(gradYear("B.S. Computer Science, May 2025\nWorked 2026 – 2028")).toBe(2025);
    expect(gradYear("Built things in 2024")).toBeNull();
  });
});
