"use server";

import { runBoardScanWithFitScoring } from "@/lib/board-scan-pipeline";
import type { SeekerPrefs } from "@/lib/seeker";

export async function runBoardScan(seeker?: Partial<SeekerPrefs>) {
  return runBoardScanWithFitScoring(seeker);
}
