import { describe, expect, it } from "vitest";
import { findCachedJob, recallScan, rememberScan } from "@/lib/scan-cache";
import type { Job } from "@/lib/types";

const job: Job = {
  id: "cached",
  company: "Co",
  title: "SWE",
  location: "NYC",
  tier: "A",
  jobUrl: "https://example.com",
  postedAt: "2026-01-01T00:00:00.000Z",
  teamHint: "",
  requirements: [],
};

describe("scan cache", () => {
  it("remembers a job", () => {
    rememberScan([job]);
    expect(findCachedJob("cached")?.company).toBe("Co");
    expect(recallScan(-1)).toBeNull();
  });
});
