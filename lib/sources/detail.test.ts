import { describe, expect, it } from "vitest";
import { fetchJobDetail, jobFromUrl, postingFromHtml, workdayApiUrl } from "@/lib/sources/detail";
import { isPublicUrl, pool } from "@/lib/sources/http";
import { fakeFetch } from "@/lib/sources/sources.test-helpers";

describe("workdayApiUrl", () => {
  it("maps both Workday link styles to the JSON endpoint", () => {
    expect(
      workdayApiUrl("https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced/job/New-York/SWE_R1")
    ).toBe("https://adobe.wd5.myworkdayjobs.com/wday/cxs/adobe/external_experienced/job/New-York/SWE_R1");
    expect(
      workdayApiUrl("https://wd1.myworkdaysite.com/recruiting/wf/WellsFargoJobs/job/CHARLOTTE-NC/Eng_R-5")
    ).toBe("https://wd1.myworkdaysite.com/wday/cxs/wf/WellsFargoJobs/job/CHARLOTTE-NC/Eng_R-5");
    expect(workdayApiUrl("https://adobe.wd5.myworkdayjobs.com/careers")).toBeNull();
    expect(workdayApiUrl("https://example.com/site/job/1")).toBeNull();
    expect(workdayApiUrl("bad")).toBeNull();
  });
});

describe("postingFromHtml", () => {
  it("prefers schema.org JobPosting data", () => {
    const html = `<script type="application/ld+json">{bad json</script>
      <script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Engineer","hiringOrganization":{"name":"Acme"},
      "jobLocation":[{"address":{"addressLocality":"New York","addressRegion":"NY"}}],"datePosted":"2026-09-20","description":"&lt;p&gt;Build.&lt;/p&gt;"}]}</script>`;
    const posting = postingFromHtml(html);
    expect(posting).toMatchObject({ title: "Engineer", company: "Acme", location: "New York, NY", description: "Build." });
    expect(posting.postedAt).toBe("2026-09-20T00:00:00.000Z");
  });

  it("falls back to the page title and body text", () => {
    const posting = postingFromHtml(
      `<html><head><title>Platform Engineer</title></head><body><nav>Menu</nav><p>Own the platform.</p></body></html>`
    );
    expect(posting.title).toBe("Platform Engineer");
    expect(posting.description).toContain("Own the platform.");
    expect(posting.description).not.toContain("Menu");
    expect(postingFromHtml(`<meta property="og:title" content="OG Role">`).title).toBe("OG Role");
  });
});

describe("fetchJobDetail and jobFromUrl", () => {
  const fetchImpl = fakeFetch([
    ["jobPosting/4461163914", `<h2 class="topcard__title">SWE I</h2><a class="topcard__org-name-link">DoorDash</a>
      <figcaption class="num-applicants__caption">Be among the first 25 applicants</figcaption>
      <div class="show-more-less-html__markup">Python.</div></section>`],
    ["/wday/cxs/adobe/", { jobPostingInfo: { title: "SWE New Grad", jobDescription: "<p>C++</p>", location: "NYC", startDate: "2026-09-25" }, hiringOrganization: { name: "Adobe" } }],
    ["/wday/cxs/empty/", { jobPostingInfo: {} }],
    ["careers.acme.com", `<title>Acme — Backend Engineer</title><body>Go services.</body>`],
    ["blank.example", `<body></body>`],
    ["/boards/anthropic/jobs/1", { title: "SWE", company_name: "Anthropic", content: "Evals." }],
  ]);

  it("fetches descriptions for LinkedIn, ATS, Workday, and other pages", async () => {
    expect(await fetchJobDetail({ jobUrl: "https://www.linkedin.com/jobs/view/4461163914/" }, fetchImpl)).toEqual({
      description: "Python.",
      applicants: "Be among the first 25 applicants",
    });
    expect((await fetchJobDetail({ jobUrl: "https://job-boards.greenhouse.io/anthropic/jobs/1" }, fetchImpl)).description).toBe("Evals.");
    expect(
      (await fetchJobDetail({ jobUrl: "https://adobe.wd5.myworkdayjobs.com/en-US/ext/job/NYC/SWE_1" }, fetchImpl)).description
    ).toBe("C++");
    expect((await fetchJobDetail({ jobUrl: "https://empty.wd1.myworkdayjobs.com/ext/job/x" }, fetchImpl)).description).toBe("");
    expect((await fetchJobDetail({ jobUrl: "https://careers.acme.com/1" }, fetchImpl)).applicants).toBeUndefined();
  });

  it("builds a role from any pasted link", async () => {
    const linkedin = await jobFromUrl("https://www.linkedin.com/jobs/view/swe-at-doordash-4461163914?trk=1", fetchImpl);
    expect(linkedin).toMatchObject({ id: "li-4461163914", company: "DoorDash", onWatchList: true, sources: ["linkedin"] });
    expect(linkedin.jobUrl).toBe("https://www.linkedin.com/jobs/view/4461163914/");
    const ats = await jobFromUrl("https://job-boards.greenhouse.io/anthropic/jobs/1", fetchImpl);
    expect(ats).toMatchObject({ company: "Anthropic", source: "url", sources: ["greenhouse"] });
    const workday = await jobFromUrl("https://adobe.wd5.myworkdayjobs.com/en-US/ext/job/NYC/SWE_1", fetchImpl);
    expect(workday).toMatchObject({ company: "Adobe", title: "SWE New Grad", early: true, tier: "B" });
    expect(workday.postedAt).toBe("2026-09-25T00:00:00.000Z");
    const generic = await jobFromUrl("https://careers.acme.com/1", fetchImpl);
    expect(generic).toMatchObject({ company: "Acme", title: "Acme — Backend Engineer", onWatchList: false, tier: "C" });
    expect(generic.id).toMatch(/^url-/);
  });

  it("rejects links that are not public job pages", async () => {
    await expect(jobFromUrl("ftp://x", fetchImpl)).rejects.toThrow(/https/);
    await expect(jobFromUrl("https://blank.example/1", fetchImpl)).rejects.toThrow(/Could not read/);
    await expect(jobFromUrl("http://127.0.0.1:8080/admin", fetchImpl)).rejects.toThrow(/public web address/);
  });
});

describe("http helpers", () => {
  it("allows only public hosts", () => {
    expect(isPublicUrl("https://jobs.example.com/1")).toBe(true);
    for (const url of ["http://localhost:3000", "http://10.0.0.5", "http://192.168.1.1", "http://172.20.0.1", "http://169.254.169.254/latest", "http://[::1]/", "http://metadata.internal", "file:///etc/passwd", "nope"]) {
      expect(isPublicUrl(url)).toBe(false);
    }
  });

  it("runs work with a concurrency limit and keeps order", async () => {
    let active = 0;
    let peak = 0;
    const out = await pool([3, 1, 2], 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, n));
      active -= 1;
      return n * 10;
    });
    expect(out).toEqual([30, 10, 20]);
    expect(peak).toBe(2);
    expect(await pool([], 4, async (n: number) => n)).toEqual([]);
  });
});
