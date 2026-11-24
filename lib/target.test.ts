import { describe, expect, it } from "vitest";
import { matchesRole } from "@/lib/board-match";
import { ruleFit } from "@/lib/fit";
import { guessTarget, linkedInExperience, nameFromResume, normalizeTarget, titleExcluded, titleFamily } from "@/lib/target";
import type { Job } from "@/lib/types";

const analyst = normalizeTarget({
  name: "Frida Luna",
  roles: ["data analyst", "business intelligence analyst"],
  titleTerms: ["data analyst", "analytics", "business intelligence", "bi"],
  level: "experienced",
  years: 3,
})!;

function job(title: string, description = ""): Job {
  return {
    id: title,
    company: "Acme",
    title,
    location: "New York, NY",
    tier: "B",
    jobUrl: "https://example.com",
    postedAt: new Date().toISOString(),
    teamHint: "",
    requirements: [],
    description,
  } as Job;
}

describe("resume target", () => {
  it("normalizes model output and rejects empty roles", () => {
    expect(normalizeTarget({ roles: [] })).toBeNull();
    expect(normalizeTarget(null)).toBeNull();
    expect(analyst.level).toBe("experienced");
    expect(normalizeTarget({ roles: ["Data Analyst"] })?.titleTerms).toEqual(["data analyst"]);
  });

  it("matches titles in the resume's field instead of software roles", () => {
    expect(titleFamily(analyst).test("Senior Data Analyst, Marketing")).toBe(true);
    expect(titleFamily(analyst).test("BI Developer")).toBe(true);
    expect(titleFamily(analyst).test("Software Engineer, New Grad")).toBe(false);
    expect(matchesRole("Data Analyst", "New York, NY", "nyc", analyst)).toBe(true);
    expect(matchesRole("Software Engineer", "New York, NY", "nyc", analyst)).toBe(false);
    // The saved resume keeps the original software defaults.
    expect(matchesRole("Software Engineer", "New York, NY", "nyc")).toBe(true);
  });

  it("filters seniority by level", () => {
    expect(titleExcluded("Senior Data Analyst", analyst)).toBe(false);
    expect(titleExcluded("Director of Analytics", analyst)).toBe(true);
    const entry = { ...analyst, level: "entry" as const };
    expect(titleExcluded("Senior Data Analyst", entry)).toBe(true);
    expect(titleExcluded("Associate Product Manager", { ...entry, roles: ["associate product manager"] })).toBe(false);
    expect(linkedInExperience(analyst)).toBe("3,4");
    expect(linkedInExperience(null)).toBe("2");
  });

  it("scores analyst roles up and software roles down for an analyst resume", () => {
    const context = { resumeText: "SQL Tableau Power BI dashboards", locationId: "nyc", target: analyst };
    const fit = ruleFit(job("Data Analyst"), context);
    const off = ruleFit(job("Software Engineer, New Grad"), context);
    expect(fit.score).toBeGreaterThan(off.score);
    expect(fit.checks?.some((check) => check.label === "Level")).toBe(false);
  });

  it("guesses a target from keywords when there's no AI key", () => {
    const guess = guessTarget("Frida Luna\nData Analyst — NDT\nPower BI, Tableau, SQL reporting\nB.S. Economics 2021", new Date("2026-11-24"));
    expect(guess?.roles[0]).toBe("data analyst");
    expect(guess?.name).toBe("Frida Luna");
    expect(guess?.level).toBe("experienced");
    expect(nameFromResume("Education\nStuff")).toBe("");
    const spanish = guessTarget(
      "Maria Torres\nAnalista de Datos — Grupo (2022 – presente)\nUniversidad Ejemplo 2017 - 2021\nPower BI, Tableau",
      new Date("2026-11-24")
    );
    expect(spanish?.level).toBe("experienced");
    expect(spanish?.years).toBe(4);
  });
});
