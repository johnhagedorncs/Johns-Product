import { describe, expect, it } from "vitest";
import { normalizeCompany } from "@/lib/sources/ats";
import {
  companySlugIn,
  fetchLinkedInPosting,
  linkedInIdFromUrl,
  linkedInSearchUrl,
  parseLinkedInCards,
  parseLinkedInPosting,
  postedFromAgo,
  resolveCompanySlug,
  scanLinkedIn,
} from "@/lib/sources/linkedin";
import { fakeFetch } from "@/lib/sources/sources.test-helpers";

function card(id: string, title: string, company: string, location: string, date = "2026-09-26") {
  return `<li>
    <div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:${id}">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/x-${id}?refId=1"></a>
      <h3 class="base-search-card__title">
        ${title}
      </h3>
      <h4 class="base-search-card__subtitle"><a href="https://www.linkedin.com/company/${company.toLowerCase()}?trk=x">${company}</a></h4>
      <span class="job-search-card__location">${location}</span>
      <time class="job-search-card__listdate" datetime="${date}">4 days ago</time>
    </div>
  </li>`;
}

const page = [
  card("111", "Software Engineer I, Entry-Level &amp; New Grad", "DoorDash", "New York, NY"),
  card("222", "Senior Software Engineer", "Acme", "New York, NY"),
  card("333", "Software Engineer - Early Career", "Uniswap", "New York, NY", "not-a-date"),
  "<li><div>no urn here</div></li>",
  `<li><div data-entity-urn="urn:li:jobPosting:444"><h3 class="base-search-card__title"></h3></div></li>`,
].join("\n");

describe("LinkedIn search cards", () => {
  it("builds a public search URL for the city", () => {
    const url = new URL(linkedInSearchUrl("software engineer", "nyc", 10));
    expect(url.pathname).toContain("jobs-guest");
    expect(url.searchParams.get("location")).toBe("New York City Metropolitan Area");
    expect(url.searchParams.get("f_E")).toBe("2");
    expect(url.searchParams.get("start")).toBe("10");
    expect(new URL(linkedInSearchUrl("x", "remote")).searchParams.get("f_WT")).toBe("2");
    expect(new URL(linkedInSearchUrl("x", "mars")).searchParams.get("location")).toBe(
      "New York City Metropolitan Area"
    );
  });

  it("parses title, company, location, date, and a clean job URL", () => {
    const cards = parseLinkedInCards(page);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      linkedinId: "111",
      title: "Software Engineer I, Entry-Level & New Grad",
      company: "DoorDash",
      location: "New York, NY",
      url: "https://www.linkedin.com/jobs/view/111/",
    });
    expect(cards[0].postedAt).toBe("2026-09-26T12:00:00.000Z");
    expect(Number.isNaN(Date.parse(cards[2].postedAt))).toBe(false);
  });

  it("keeps matching roles across queries once each", async () => {
    const fetchImpl = fakeFetch([["seeMoreJobPostings", page]]);
    const jobs = await scanLinkedIn(fetchImpl, "nyc", ["a", "b"]);
    expect(jobs.map((job) => job.company)).toEqual(["DoorDash", "Uniswap"]);
    expect(jobs[0]).toMatchObject({ id: "li-111", source: "linkedin", onWatchList: true, tier: "B" });
    expect(jobs[1].onWatchList).toBe(false);
  });

  it("reports LinkedIn as down only when every query fails", async () => {
    await expect(scanLinkedIn(fakeFetch([["seeMore", "", 429]]), "nyc", ["a"])).rejects.toThrow(/rate limited/);
    const partial = fakeFetch([["keywords=ok", page]]);
    expect(await scanLinkedIn(partial, "nyc", ["ok", "bad"])).toHaveLength(2);
  });
});

describe("LinkedIn job posting", () => {
  const html = `
    <h2 class="topcard__title">Software Engineer I</h2>
    <a class="topcard__org-name-link topcard__flavor--black-link" href="#">
      DoorDash
    </a>
    <span class="topcard__flavor topcard__flavor--bullet"> New York, NY </span>
    <span class="posted-time-ago__text topcard__flavor--metadata"> 4 days ago </span>
    <figcaption class="num-applicants__caption"> Over 200 applicants </figcaption>
    <div class="description__text"><section class="show-more-less-html">
      <div class="show-more-less-html__markup"><strong>About</strong><br>Build in Python.<ul><li>Go</li></ul></div>
    </section></div>`;

  it("reads the description, applicants, and post age", () => {
    const posting = parseLinkedInPosting(html);
    expect(posting.title).toBe("Software Engineer I");
    expect(posting.company).toBe("DoorDash");
    expect(posting.location).toBe("New York, NY");
    expect(posting.applicants).toBe("Over 200 applicants");
    expect(posting.description).toContain("Build in Python.");
    expect(posting.postedAt).toBeDefined();
    expect(parseLinkedInPosting("<html></html>").description).toBe("");
  });

  it("fetches a posting by id", async () => {
    const fetchImpl = fakeFetch([["jobPosting/42", html]]);
    expect((await fetchLinkedInPosting("42", fetchImpl)).company).toBe("DoorDash");
  });

  it("turns relative ages into dates", () => {
    const now = Date.parse("2026-09-30T00:00:00Z");
    expect(postedFromAgo("4 days ago", now)).toBe("2026-09-26T00:00:00.000Z");
    expect(postedFromAgo("Reposted 1 week ago", now)).toBe("2026-09-23T00:00:00.000Z");
    expect(postedFromAgo("3 hours ago", now)).toBe("2026-09-29T21:00:00.000Z");
    expect(postedFromAgo("yesterday", now)).toBeUndefined();
  });

  it("finds the job id in LinkedIn links", () => {
    expect(linkedInIdFromUrl("https://www.linkedin.com/jobs/view/software-engineer-at-doordash-4461163914")).toBe("4461163914");
    expect(linkedInIdFromUrl("https://www.linkedin.com/jobs/view/4461163914/?trk=x")).toBe("4461163914");
    expect(linkedInIdFromUrl("https://www.linkedin.com/jobs/search/?currentJobId=4453380670")).toBe("4453380670");
    expect(linkedInIdFromUrl("https://example.com/jobs/view/4461163914")).toBeNull();
    expect(linkedInIdFromUrl("nope")).toBeNull();
  });
});

describe("LinkedIn company pages", () => {
  it("reads the company slug from cards and postings", () => {
    expect(parseLinkedInCards(page)[0].companySlug).toBe("doordash");
    expect(companySlugIn('<a href="https://www.linkedin.com/company/grow-with-clay?trk=1">')).toBe("grow-with-clay");
    expect(companySlugIn("<a href=\"#\">")).toBeUndefined();
    expect(
      parseLinkedInPosting('<a class="topcard__org-name-link" href="https://www.linkedin.com/company/cursorai?trk=x">Cursor</a>').companySlug
    ).toBe("cursorai");
  });

  it("resolves a slug only from an exact company-name match", async () => {
    const results = [card("1", "Software Engineer", "Clayton", "NYC"), card("2", "Software Engineer", "Clayton", "NYC")].join("");
    const clay = [card("3", "GTM Engineer", "Clay", "NYC")].join("").replace("/company/clay?", "/company/grow-with-clay?");
    const fetchImpl = fakeFetch([
      ["keywords=Clay+software", clay],
      ["keywords=Clay&", results],
      ["keywords=Nobody", ""],
      ["keywords=Down", "", 500],
    ]);
    expect(await resolveCompanySlug("Clay", normalizeCompany, fetchImpl)).toBe("grow-with-clay");
    expect(await resolveCompanySlug("Nobody", normalizeCompany, fetchImpl)).toBeNull();
    expect(await resolveCompanySlug("Down", normalizeCompany, fetchImpl)).toBeNull();
    expect(await resolveCompanySlug("  ", normalizeCompany, fetchImpl)).toBeNull();
  });
});

