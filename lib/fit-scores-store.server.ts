import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FitScoreResult } from "@/lib/ai/score-fit";
import type { FitScoreStore } from "@/lib/fit-merge";

export function getFitScoresPath(): string {
  return (
    process.env.WARM_APPLY_FIT_SCORES_PATH ??
    path.join(process.cwd(), "data/fit-scores.json")
  );
}

export async function loadFitScores(): Promise<FitScoreStore> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ getFitScoresPath(), "utf8");
    const parsed = JSON.parse(raw) as FitScoreStore;
    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export async function saveFitScores(store: FitScoreStore): Promise<void> {
  await writeFile(
    /*turbopackIgnore: true*/ getFitScoresPath(),
    `${JSON.stringify(store, null, 2)}\n`,
    "utf8"
  );
}

export async function upsertFitScore(
  jobId: string,
  result: FitScoreResult
): Promise<FitScoreStore> {
  const store = await loadFitScores();
  store[jobId] = result;
  await saveFitScores(store);
  return store;
}
