import { describe, expect, it } from "vitest";
import {
  isEarlyCareer,
  matchesRole,
  plainDescription,
  stripHtml,
  tierLetter,
  toPostedAt,
} from "@/lib/board-match";
import { BOARD_USER_AGENT } from "@/lib/board-match";
import { scanLiveBoards } from "@/lib/scan-boards";

describe("board match", () => {
  it("keeps NYC early-career engineering titles", () => {
    expect(
      matchesRole("New Grad Software Engineer", "New York, NY")
    ).toBe(true);
  });

  it("drops senior and non-NYC roles", () => {
    expect(matchesRole("Senior Software Engineer", "New York, NY")).toBe(false);
    expect(matchesRole("Software Engineer", "Austin, TX")).toBe(false);
    expect(
      matchesRole("Software Engineer", "Austin, TX", "austin")
    ).toBe(true);
    expect(matchesRole("Software Engineer", "Remote", "remote")).toBe(true);
    expect(matchesRole("Software Engineer", "Austin, TX", "any")).toBe(true);
    expect(matchesRole("Software Engineer", "Austin, TX", "nope")).toBe(false);
  });

  it("flags early career titles", () => {
    expect(isEarlyCareer("Software Engineer, New Grad")).toBe(true);
    expect(isEarlyCareer("Software Engineer")).toBe(false);
  });

  it("maps tiers", () => {
    expect(tierLetter(1)).toBe("A");
    expect(tierLetter(2)).toBe("B");
    expect(tierLetter(3)).toBe("C");
  });

  it("parses numeric timestamps and skips bad dates", () => {
    expect(toPostedAt(1_700_000_000_000)).toContain("2023");
    expect(toPostedAt("not-a-date")).toBeTruthy();
    expect(plainDescription(12)).toBe("");
    expect(stripHtml("<p>Hello <b>NYC</b></p>")).toBe("Hello NYC");
    expect(plainDescription("<div>Build APIs</div>")).toContain("Build APIs");
    expect(
      plainDescription(
        "&lt;h2&gt;About the role&lt;/h2&gt; &lt;p&gt;You&#39;ll build RL systems.&lt;/p&gt; &lt;ul&gt;&lt;li&gt;Own training&lt;/li&gt;&lt;/ul&gt;"
      )
    ).toBe("About the role\nYou'll build RL systems.\n\n• Own training");
    expect(plainDescription("&amp;lt;p&amp;gt;Safe &amp;amp; beneficial&#x27;s&amp;lt;/p&amp;gt;")).toBe(
      "Safe & beneficial's"
    );
  });
});

describe("scanLiveBoards", () => {
  it("sends a user agent and keeps NYC ashby roles with plain text", async () => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("User-Agent")).toBe(BOARD_USER_AGENT);
      const url = String(input);
      if (url.includes("boards/anthropic/")) {
        return new Response("no", { status: 500 });
      }
      if (url.includes("greenhouse.io") && url.match(/jobs\/\d+$/)) {
        return new Response("no", { status: 500 });
      }
      if (url.includes("greenhouse.io")) {
        return new Response(
          JSON.stringify({
            jobs: [
              {
                id: 9,
                title: "Software Engineer I",
                location: { name: "New York, NY" },
                absolute_url: "https://boards.greenhouse.io/example/jobs/9",
                updated_at: "2026-03-29T00:00:00.000Z",
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("lever.co")) {
        return new Response(
          JSON.stringify([
            {
              text: "Forward Deployed Engineer",
              categories: { location: "New York", allLocations: ["Brooklyn"] },
              hostedUrl: "https://jobs.lever.co/example/1",
              createdAt: 1_700_000_000_000,
              descriptionPlain: "Deploy with customers.",
            },
          ]),
          { status: 200 }
        );
      }
      if (url.includes("ashby")) {
        return new Response(
          JSON.stringify({
            jobs: [
              {
                title: "New Grad Software Engineer",
                location: "New York, NY",
                secondaryLocations: [{ location: "Brooklyn, NY" }],
                jobUrl: "https://jobs.ashbyhq.com/example/1",
                publishedAt: "2026-03-29T00:00:00.000Z",
                descriptionPlain: "Build product in NYC.",
              },
              {
                title: "Senior Software Engineer",
                location: "New York, NY",
                jobUrl: "https://jobs.ashbyhq.com/example/2",
                descriptionPlain: "Staff scope.",
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("[]", { status: 200 });
    };
    const jobs = await scanLiveBoards(fetchImpl as typeof fetch);
    const nyc = jobs.filter((job) => job.title.includes("New Grad"));
    expect(nyc.length).toBeGreaterThan(0);
    expect(nyc[0]?.description).toContain("Build product");
    expect(jobs.some((job) => job.title === "Software Engineer I")).toBe(true);
    expect(jobs.some((job) => job.description?.includes("Deploy"))).toBe(true);
    expect(jobs.some((job) => /senior/i.test(job.title))).toBe(false);
  });
});
