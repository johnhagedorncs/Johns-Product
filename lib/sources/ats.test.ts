import { describe, expect, it } from "vitest";
import {
  atsJobFromUrl,
  jobsForCompany,
  normalizeCompany,
  scanWatchList,
  watchCompanies,
  watchEntry,
  watchList,
  type WatchCompany,
} from "@/lib/sources/ats";
import { fakeFetch } from "@/lib/sources/sources.test-helpers";

const gh: WatchCompany = { name: "Anthropic", tier: 1, ats: "greenhouse", slug: "anthropic", why: "AI lab" };

describe("watch list", () => {
  it("keeps only companies with a public board", () => {
    expect(watchCompanies().every((c) => c.slug && c.ats !== "manual")).toBe(true);
    expect(watchList().length).toBeGreaterThan(watchCompanies().length);
  });

  it("matches company names across boards", () => {
    expect(normalizeCompany("Google (NYC)")).toBe("google");
    expect(normalizeCompany("Amazon / AWS (NYC)")).toBe("amazon");
    expect(normalizeCompany("Scale AI, Inc.")).toBe("scale");
    expect(watchEntry("Scale AI")?.name).toBe("Scale AI");
    expect(watchEntry("  ")).toBeUndefined();
    expect(watchEntry("Nobody Corp Ltd")).toBeUndefined();
  });
});

describe("greenhouse", () => {
  it("lists NYC roles, uses first_published, and reads the description", async () => {
    const fetchImpl = fakeFetch([
      [
        "/boards/anthropic/jobs/11",
        { content: "&lt;p&gt;Build evals in Python.&lt;/p&gt;", departments: [{ name: "Applied AI" }] },
      ],
      ["/boards/anthropic/jobs/12", "boom", 500],
      [
        "/boards/anthropic/jobs",
        {
          jobs: [
            {
              id: 11,
              title: "Software Engineer, New Grad",
              location: { name: "New York City, NY" },
              absolute_url: "https://job-boards.greenhouse.io/anthropic/jobs/11",
              first_published: "2026-09-20T00:00:00Z",
              updated_at: "2026-09-29T00:00:00Z",
            },
            {
              id: 12,
              title: "Applied AI Engineer",
              location: { name: "New York City, NY" },
              absolute_url: "https://job-boards.greenhouse.io/anthropic/jobs/12",
              updated_at: "2026-09-29T00:00:00Z",
            },
            { id: 13, title: "Senior Software Engineer", location: { name: "New York City, NY" }, absolute_url: "https://x/13" },
            { id: 14, title: "Software Engineer", location: { name: "London" }, absolute_url: "https://x/14" },
            null,
          ],
        },
      ],
    ]);
    const jobs = await jobsForCompany(gh, fetchImpl, "nyc");
    expect(jobs.map((job) => job.title)).toEqual(["Software Engineer, New Grad", "Applied AI Engineer"]);
    expect(jobs[0].postedAt).toBe("2026-09-20T00:00:00.000Z");
    expect(jobs[0].description).toBe("Build evals in Python.");
    expect(jobs[0].teamHint).toBe("Applied AI");
    expect(jobs[0].early).toBe(true);
    expect(jobs[0].source).toBe("greenhouse");
    expect(jobs[1].description).toBe("");
    expect(jobs[1].teamHint).toBe("AI lab");
  });
});

describe("ashby and lever", () => {
  it("reads Ashby secondary locations and skips unlisted roles", async () => {
    const fetchImpl = fakeFetch([
      [
        "posting-api/job-board/cursor",
        {
          jobs: [
            {
              title: "Software Engineer, New Grad 2027",
              location: "San Francisco",
              secondaryLocations: [{ location: "New York" }],
              jobUrl: "https://jobs.ashbyhq.com/cursor/abc",
              publishedAt: "2026-09-01T00:00:00Z",
              descriptionPlain: "Ship the editor.",
              department: "Engineering",
            },
            { title: "Software Engineer", location: "New York", jobUrl: "https://x", isListed: false },
            { title: "Software Engineer", location: "New York", jobUrl: "" },
          ],
        },
      ],
    ]);
    const jobs = await jobsForCompany(
      { name: "Cursor", tier: 1, ats: "ashby", slug: "cursor", why: "" },
      fetchImpl,
      "nyc"
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].location).toBe("San Francisco / New York");
    expect(jobs[0].teamHint).toBe("Engineering");
  });

  it("folds Lever requirement lists into the description", async () => {
    const fetchImpl = fakeFetch([
      [
        "api.lever.co/v0/postings/palantir",
        [
          {
            text: "Forward Deployed Software Engineer, New Grad",
            categories: { location: "New York, NY", allLocations: ["New York, NY", "Washington, D.C."], team: "Dev" },
            hostedUrl: "https://jobs.lever.co/palantir/1",
            createdAt: 1_790_000_000_000,
            descriptionPlain: "A world-changing company.",
            lists: [{ text: "Core requirements", content: "<li>Python or Java</li>" }],
            additionalPlain: "Must be US-based.",
          },
          { text: "Software Engineer", categories: { location: "Denver" }, hostedUrl: "https://x" },
          "junk",
        ],
      ],
    ]);
    const jobs = await jobsForCompany(
      { name: "Palantir", tier: 1, ats: "lever", slug: "palantir", why: "" },
      fetchImpl,
      "nyc"
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].location).toBe("New York, NY / Washington, D.C.");
    expect(jobs[0].description).toContain("Core requirements");
    expect(jobs[0].description).toContain("Python or Java");
    expect(jobs[0].description).toContain("Must be US-based.");
    expect(jobs[0].teamHint).toBe("Dev");
  });

  it("returns nothing for an unknown board type", async () => {
    expect(await jobsForCompany({ name: "X", tier: 3, ats: "other", slug: "x", why: "" }, fakeFetch([]), "nyc")).toEqual([]);
  });
});

describe("scanWatchList", () => {
  it("collects roles and names boards that did not answer", async () => {
    const result = await scanWatchList(fakeFetch([]), "nyc");
    expect(result.jobs).toEqual([]);
    expect(result.failed).toContain("Anthropic");
  });
});

describe("atsJobFromUrl", () => {
  it("reads a pasted Greenhouse link, including embedded gh_jid links", async () => {
    const fetchImpl = fakeFetch([
      [
        "/boards/anthropic/jobs/99",
        {
          title: "Software Engineer",
          company_name: "Anthropic",
          location: { name: "New York City, NY" },
          absolute_url: "https://job-boards.greenhouse.io/anthropic/jobs/99",
          first_published: "2026-09-01T00:00:00Z",
          content: "<p>Evals.</p>",
        },
      ],
      [
        "/boards/newco/jobs/5",
        { title: "Engineer", company_name: "NewCo Robotics", location: { name: "NYC" }, content: "" },
      ],
      ["/boards/empty/jobs/1", {}],
    ]);
    const job = await atsJobFromUrl("https://job-boards.greenhouse.io/anthropic/jobs/99", fetchImpl);
    expect(job?.company).toBe("Anthropic");
    expect(job?.onWatchList).toBe(true);
    const offList = await atsJobFromUrl("https://careers.newco.com/jobs?gh_jid=5&for=newco", fetchImpl);
    expect(offList?.company).toBe("NewCo Robotics");
    expect(offList?.onWatchList).toBe(false);
    expect(offList?.tier).toBe("C");
    expect(await atsJobFromUrl("https://boards.greenhouse.io/empty/jobs/1", fetchImpl)).toBeNull();
    expect(await atsJobFromUrl("https://careers.example.com/?gh_jid=5", fetchImpl)).toBeNull();
  });

  it("reads pasted Ashby and Lever links", async () => {
    const fetchImpl = fakeFetch([
      [
        "posting-api/job-board/ramp",
        { jobs: [{ id: "abc", title: "Software Engineer", location: "New York", jobUrl: "https://jobs.ashbyhq.com/ramp/abc" }] },
      ],
      ["api.lever.co/v0/postings/palantir/xyz", { text: "FDSE", categories: { location: "New York" }, hostedUrl: "https://jobs.lever.co/palantir/xyz" }],
      ["api.lever.co/v0/postings/palantir/none", {}],
    ]);
    expect((await atsJobFromUrl("https://jobs.ashbyhq.com/ramp/abc", fetchImpl))?.company).toBe("Ramp");
    expect(await atsJobFromUrl("https://jobs.ashbyhq.com/ramp/missing", fetchImpl)).toBeNull();
    expect((await atsJobFromUrl("https://jobs.lever.co/palantir/xyz", fetchImpl))?.title).toBe("FDSE");
    expect(await atsJobFromUrl("https://jobs.lever.co/palantir/none", fetchImpl)).toBeNull();
    expect(await atsJobFromUrl("not a url", fetchImpl)).toBeNull();
    expect(await atsJobFromUrl("https://example.org/careers/1", fetchImpl)).toBeNull();
  });
});
