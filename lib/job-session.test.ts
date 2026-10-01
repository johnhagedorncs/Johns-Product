import { beforeEach, describe, expect, it } from "vitest";
import {
  DRAFTS_KEY,
  markReadThisSession,
  readDraft,
  readWarmPaths,
  saveDraft,
  saveWarmPaths,
  warmPathsKey,
  wasReadThisSession,
} from "@/lib/job-session";
import type { WarmPath } from "@/lib/warm-paths";

const path: WarmPath = {
  id: "school:UCSB",
  kind: "school",
  label: "UCSB alumni at Clay",
  why: "Same school",
  points: 3,
  linkedinUrl: "https://www.linkedin.com/company/grow-with-clay/people/?keywords=x",
  googleUrl: "https://www.google.com/search?q=x",
  scoped: true,
};

describe("job session store", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps a draft in progress for each role and forgets empty ones", () => {
    expect(readDraft("clay-1")).toBeNull();
    saveDraft("clay-1", { paste: "Jane Doe — GTM Engineer", draft: null, note: "", messaged: false });
    saveDraft("ramp-1", { paste: "Other", draft: null, note: "Hi", messaged: true });
    expect(readDraft("clay-1")).toEqual({ paste: "Jane Doe — GTM Engineer", draft: null, note: "", messaged: false });
    expect(readDraft("ramp-1")?.messaged).toBe(true);
    saveDraft("clay-1", { paste: "  ", draft: null, note: "", messaged: false });
    expect(readDraft("clay-1")).toBeNull();
    expect(readDraft("ramp-1")).not.toBeNull();
  });

  it("caps stored drafts and survives bad storage", () => {
    for (let i = 0; i < 105; i += 1) saveDraft(`job-${i}`, { paste: "x", draft: null, note: "", messaged: false });
    expect(Object.keys(JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "{}"))).toHaveLength(100);
    expect(readDraft("job-0")).toBeNull();
    localStorage.setItem(DRAFTS_KEY, "{broken");
    expect(readDraft("job-104")).toBeNull();
    localStorage.setItem(DRAFTS_KEY, JSON.stringify({ a: { paste: 3 }, b: { paste: "p" } }));
    expect(readDraft("a")).toBeNull();
    expect(readDraft("b")).toEqual({ paste: "p", draft: null, note: "", messaged: false });
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(() => saveDraft("c", { paste: "p", draft: null, note: "", messaged: false }, full)).not.toThrow();
    expect(readDraft("c", null)).toBeNull();
  });

  it("reuses checked warm paths for the same role, resume, and city", () => {
    const key = warmPathsKey("clay-1", "abc", "nyc");
    expect(readWarmPaths(key)).toBeNull();
    saveWarmPaths(key, [path]);
    expect(readWarmPaths(key)).toEqual([path]);
    expect(readWarmPaths(warmPathsKey("clay-1", "other-resume", "nyc"))).toBeNull();
  });

  it("reads a posting once per browser session", () => {
    expect(wasReadThisSession("clay-1")).toBe(false);
    markReadThisSession("clay-1");
    expect(wasReadThisSession("clay-1")).toBe(true);
    expect(wasReadThisSession("ramp-1")).toBe(false);
  });
});
