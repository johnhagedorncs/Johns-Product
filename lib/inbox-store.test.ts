import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_FIT_KEY,
  applyCachedFits,
  DESCRIPTIONS_KEY,
  findInboxJob,
  INBOX_KEY,
  markSeen,
  readAiFit,
  readInbox,
  readJobStatuses,
  saveAiFits,
  saveDescriptions,
  setJobStatus,
  upsertInboxJob,
  writeInbox,
} from "@/lib/inbox-store";
import type { Job, JobFitResult } from "@/lib/types";

function job(id: string, description?: string): Job {
  return {
    id,
    company: "Cursor",
    title: "Software Engineer",
    location: "New York",
    tier: "A",
    jobUrl: `https://x/${id}`,
    postedAt: "2026-09-29T00:00:00.000Z",
    teamHint: "",
    requirements: [],
    description,
  };
}

const aiFit: JobFitResult = { score: 5, reasons: ["r"], gaps: [], redFlags: [], action: "apply_now", basis: "ai" };

describe("inbox store", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty and survives a reload with descriptions stored apart", () => {
    expect(readInbox()).toBeNull();
    writeInbox({ jobs: [job("a", "Build APIs"), job("b")], sources: [], scannedAt: "2026-09-30", locationId: "nyc", newIds: ["a"] });
    const raw = JSON.parse(localStorage.getItem(INBOX_KEY) ?? "{}");
    expect(raw.jobs[0].description).toBeUndefined();
    const inbox = readInbox();
    expect(inbox?.jobs[0].description).toBe("Build APIs");
    expect(inbox?.newIds).toEqual(["a"]);
    expect(findInboxJob("b")?.id).toBe("b");
    expect(findInboxJob("zzz")).toBeNull();
  });

  it("recovers from broken or partial storage", () => {
    localStorage.setItem(INBOX_KEY, "{not json");
    expect(readInbox()).toBeNull();
    localStorage.setItem(INBOX_KEY, JSON.stringify({ jobs: "nope" }));
    expect(readInbox()).toBeNull();
    localStorage.setItem(INBOX_KEY, JSON.stringify({ jobs: [job("a")] }));
    expect(readInbox()).toMatchObject({ sources: [], scannedAt: "", locationId: "nyc", newIds: [] });
    localStorage.setItem(DESCRIPTIONS_KEY, JSON.stringify(["wrong shape"]));
    expect(readInbox()?.jobs[0].description).toBeUndefined();
  });

  it("adds a pasted role to the top of the inbox", () => {
    upsertInboxJob(job("pasted", "text"));
    writeInbox({ ...readInbox()!, jobs: [job("a"), ...readInbox()!.jobs] });
    const next = upsertInboxJob(job("a", "now with text"));
    expect(next.jobs.map((item) => item.id)).toEqual(["a", "pasted"]);
    expect(readInbox()?.jobs[0].description).toBe("now with text");
  });

  it("caps stored descriptions and keeps the newest", () => {
    saveDescriptions(Object.fromEntries(Array.from({ length: 205 }, (_, i) => [`j${i}`, "x".repeat(9000)])));
    const stored = JSON.parse(localStorage.getItem(DESCRIPTIONS_KEY) ?? "{}");
    expect(Object.keys(stored)).toHaveLength(200);
    expect(stored.j204).toHaveLength(8000);
    expect(stored.j0).toBeUndefined();
  });

  it("halves the description cache when storage is full", () => {
    const full = {
      getItem: (key: string) => (key === DESCRIPTIONS_KEY ? JSON.stringify({ old: "x" }) : null),
      setItem: (_key: string, value: string) => {
        if (value.length > 40) throw new Error("QuotaExceeded");
      },
      removeItem: () => undefined,
    };
    expect(() => saveDescriptions({ a: "y".repeat(50), b: "z" }, full)).not.toThrow();
  });

  it("marks new roles only after the first scan", () => {
    expect(markSeen([job("a")], "t1").size).toBe(0);
    const fresh = markSeen([job("a"), job("b")], "t2");
    expect([...fresh]).toEqual(["b"]);
  });

  it("tracks applied and hidden roles", () => {
    setJobStatus("a", "applied", "2026-09-30");
    setJobStatus("b", "hidden", "2026-09-30");
    expect(readJobStatuses()).toEqual({
      a: { status: "applied", at: "2026-09-30" },
      b: { status: "hidden", at: "2026-09-30" },
    });
    setJobStatus("a", null);
    expect(Object.keys(readJobStatuses())).toEqual(["b"]);
  });

  it("caches AI fits per resume and reapplies them to a rescan", () => {
    saveAiFits([{ id: "a", fit: aiFit }, { id: "b", fit: { ...aiFit, basis: "rules" } }], "hash1");
    expect(readAiFit("a", "hash1")?.score).toBe(5);
    expect(readAiFit("b", "hash1")).toBeNull();
    expect(readAiFit("a", "other-resume")).toBeNull();
    const [scored, plain] = applyCachedFits([job("a"), job("b")], "hash1");
    expect(scored.fitScore).toBe(5);
    expect(plain.fit).toBeUndefined();
    expect(Object.keys(JSON.parse(localStorage.getItem(AI_FIT_KEY) ?? "{}"))).toEqual(["a:hash1"]);
  });

  it("does nothing without browser storage", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(readInbox(broken)).toBeNull();
    expect(() => writeInbox({ jobs: [], sources: [], scannedAt: "", locationId: "nyc" }, broken)).not.toThrow();
  });
});
