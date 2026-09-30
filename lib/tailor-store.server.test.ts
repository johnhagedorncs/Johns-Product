import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("tailor store", () => {
  beforeEach(async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tailor-"));
    vi.stubEnv("WARM_APPLY_TAILOR_PATH", path.join(dir, "tailors.json"));
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("saves and reloads a tailor", async () => {
    const { saveTailor, loadTailors } = await import("@/lib/tailor-store.server");
    await saveTailor("job", {
      leadBullets: ["a", "b", "c"],
      rewordings: [{ original: "old", suggested: "new" }],
      missingKeywords: [],
    });
    const store = await loadTailors();
    expect(store.job.leadBullets).toHaveLength(3);
  });
});
