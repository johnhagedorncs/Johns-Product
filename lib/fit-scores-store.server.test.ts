import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let tempDir = "";

describe("fit-scores-store", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "warm-apply-fit-"));
    vi.stubEnv("WARM_APPLY_FIT_SCORES_PATH", path.join(tempDir, "fit-scores.json"));
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loadFitScores returns empty object on missing file", async () => {
    const { loadFitScores } = await import("@/lib/fit-scores-store.server");
    await expect(loadFitScores()).resolves.toEqual({});
  });

  it("saveFitScores writes JSON", async () => {
    const { saveFitScores, getFitScoresPath } = await import(
      "@/lib/fit-scores-store.server"
    );
    await saveFitScores({
      "job-1": { score: 4, reasons: ["a", "b", "c"], gaps: [], redFlags: [], action: "apply_now" },
    });
    const raw = await readFile(getFitScoresPath(), "utf8");
    expect(JSON.parse(raw)).toHaveProperty("job-1");
  });

  it("loadFitScores returns empty for non-object json", async () => {
    const { loadFitScores, getFitScoresPath } = await import(
      "@/lib/fit-scores-store.server"
    );
    const { writeFile } = await import("node:fs/promises");
    await writeFile(getFitScoresPath(), "[]", "utf8");
    await expect(loadFitScores()).resolves.toEqual({});
  });

  it("loadFitScores returns empty for invalid json", async () => {
    const { saveFitScores, loadFitScores, getFitScoresPath } = await import(
      "@/lib/fit-scores-store.server"
    );
    const { writeFile } = await import("node:fs/promises");
    await writeFile(getFitScoresPath(), "not-json", "utf8");
    await expect(loadFitScores()).resolves.toEqual({});
  });

  it("upsertFitScore merges and persists", async () => {
    const { upsertFitScore, loadFitScores } = await import(
      "@/lib/fit-scores-store.server"
    );
    await upsertFitScore("job-2", {
      score: 3,
      reasons: ["r1", "r2", "r3"],
      gaps: ["gap"],
      redFlags: [],
      action: "apply_and_outreach",
    });
    const store = await loadFitScores();
    expect(store["job-2"].score).toBe(3);
  });
});
