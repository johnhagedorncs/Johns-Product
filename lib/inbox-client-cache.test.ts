import { afterEach, describe, expect, it } from "vitest";
import {
  clearInboxCache,
  INBOX_CACHE_KEY,
  readInboxCache,
  writeInboxCache,
} from "@/lib/inbox-client-cache";
import type { Job } from "@/lib/types";

const job: Job = {
  id: "j1",
  company: "Co",
  title: "SWE",
  location: "NYC",
  tier: "A",
  jobUrl: "https://example.com",
  postedAt: "2026-01-01T00:00:00.000Z",
  teamHint: "",
  requirements: [],
};

describe("inbox client cache", () => {
  afterEach(() => {
    clearInboxCache();
  });

  it("round-trips jobs and note", () => {
    writeInboxCache([job], "Scored 1 new role.");
    expect(readInboxCache()?.jobs).toHaveLength(1);
    expect(readInboxCache()?.note).toContain("Scored");
  });

  it("returns null for bad json", () => {
    sessionStorage.setItem(INBOX_CACHE_KEY, "{");
    expect(readInboxCache()).toBeNull();
  });
});
