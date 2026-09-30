import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TailorResult } from "@/lib/ai/tailor-resume";

const FILE =
  process.env.WARM_APPLY_TAILOR_PATH ??
  path.join(process.cwd(), "data/resume-tailors.json");

export type TailorStore = Record<string, TailorResult>;

export async function loadTailors(): Promise<TailorStore> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ FILE, "utf8");
    const parsed = JSON.parse(raw) as TailorStore;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export async function saveTailor(
  jobId: string,
  result: TailorResult
): Promise<TailorResult> {
  const store = await loadTailors();
  store[jobId] = result;
  await writeFile(/*turbopackIgnore: true*/ FILE, `${JSON.stringify(store, null, 2)}\n`);
  return result;
}
