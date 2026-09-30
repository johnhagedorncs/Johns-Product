import { hasOpenAIConfig } from "@/lib/ai/client";
import { scoreFit } from "@/lib/ai/score-fit";
import {
  jobNeedsFitScore,
  mergeJobsWithFits,
  type FitScoreStore,
} from "@/lib/fit-merge";
import { loadFitScores, saveFitScores } from "@/lib/fit-scores-store.server";
import { getProfile } from "@/lib/profile";
import { rememberScan } from "@/lib/scan-cache";
import { scanLiveBoards } from "@/lib/scan-boards";
import { profileForSeeker, type SeekerPrefs } from "@/lib/seeker";
import type { Job } from "@/lib/types";

const SCORE_CAP = 8;

export type BoardScanResult = {
  jobs: Job[];
  scoredJobIds: string[];
  skippedReason?: string;
};

export async function runBoardScanWithFitScoring(
  seeker?: Partial<SeekerPrefs>
): Promise<BoardScanResult> {
  const locationId = seeker?.locationId || "nyc";
  const jobs = await scanLiveBoards(fetch, locationId);
  let store: FitScoreStore = await loadFitScores();
  const scoredJobIds: string[] = [];
  const profile = profileForSeeker(getProfile(), {
    name: seeker?.name ?? "",
    locationId,
    resumeText: seeker?.resumeText ?? "",
    resumeFileName: seeker?.resumeFileName ?? "",
  });

  if (!hasOpenAIConfig()) {
    const merged = mergeJobsWithFits(jobs, store);
    rememberScan(merged);
    return {
      jobs: merged,
      scoredJobIds,
      skippedReason: "missing_openai_config",
    };
  }

  for (const job of jobs) {
    if (scoredJobIds.length >= SCORE_CAP) break;
    if (!jobNeedsFitScore(job, store)) continue;
    const fit = await scoreFit(job, profile);
    store[job.id] = fit;
    scoredJobIds.push(job.id);
  }

  if (scoredJobIds.length > 0) {
    await saveFitScores(store);
  }

  const merged = mergeJobsWithFits(jobs, store);
  rememberScan(merged);
  return {
    jobs: merged,
    scoredJobIds,
  };
}
