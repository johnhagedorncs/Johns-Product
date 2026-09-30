import { describe, expect, it } from "vitest";
import { scanSimplify, SIMPLIFY_NEW_GRAD_URL, simplifyJobs } from "@/lib/sources/simplify";
import { fakeFetch } from "@/lib/sources/sources.test-helpers";

const now = Date.parse("2026-09-30T12:00:00Z");
const day = 86_400;

const rows = [
  {
    company_name: "Stripe",
    title: "Software Engineer, New Grad",
    url: "https://stripe.com/jobs/1",
    locations: ["New York, NY", "Seattle, WA"],
    date_posted: now / 1000 - 2 * day,
    active: true,
    is_visible: true,
    category: "Software",
  },
  {
    company_name: "Tiny Startup",
    title: "Forward Deployed Engineer",
    url: "https://tiny.example/fde",
    locations: ["NYC"],
    date_posted: now / 1000 - 5 * day,
    category: "AI/ML/Data",
  },
  { company_name: "Old Co", title: "Software Engineer", url: "https://old.example", locations: ["NYC"], date_posted: now / 1000 - 90 * day },
  { company_name: "Closed", title: "Software Engineer", url: "https://c.example", locations: ["NYC"], active: false },
  { company_name: "Hidden", title: "Software Engineer", url: "https://h.example", locations: ["NYC"], is_visible: false },
  { company_name: "Chips", title: "Firmware Engineer", url: "https://f.example", locations: ["NYC"], category: "Hardware" },
  { company_name: "Far", title: "Software Engineer", url: "https://far.example", locations: ["Austin, TX"] },
  { company_name: "No Link", title: "Software Engineer", url: "mailto:x", locations: ["NYC"] },
  { company_name: "Undated", title: "Software Engineer", url: "https://u.example", locations: ["NYC"] },
  null,
];

describe("simplifyJobs", () => {
  it("keeps active, recent, non-hardware roles in the target city", () => {
    const jobs = simplifyJobs(rows, "nyc", now);
    expect(jobs.map((job) => job.company)).toEqual(["Stripe", "Tiny Startup", "Undated"]);
    expect(jobs[0].onWatchList).toBe(true);
    expect(jobs[0].tier).toBe("B");
    expect(jobs[0].early).toBe(true);
    expect(jobs[0].postedAt).toBe("2026-09-28T12:00:00.000Z");
    expect(jobs[1].onWatchList).toBe(false);
    expect(jobs[1].tier).toBe("C");
    expect(jobs[1].teamHint).toBe("AI/ML/Data");
    expect(jobs[2].postedAt).toBe(new Date(now).toISOString());
    expect(simplifyJobs({ not: "a list" }, "nyc", now)).toEqual([]);
  });

  it("downloads the GitHub list", async () => {
    const fetchImpl = fakeFetch([[SIMPLIFY_NEW_GRAD_URL, rows.slice(0, 1)]]);
    expect(await scanSimplify(fetchImpl, "any")).toHaveLength(1);
  });
});
