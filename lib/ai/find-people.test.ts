import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProfile } from "@/lib/profile";
import type { Job } from "@/lib/types";

const parse = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/client", () => ({
  getOpenAIClient: () => ({ responses: { parse } }),
  resolveModel: () => "gpt-4o",
}));

const job: Job = {
  id: "job-1",
  company: "Notion",
  title: "Software Engineer",
  location: "New York, NY",
  tier: "A",
  jobUrl: "https://example.com/notion",
  postedAt: "2026-03-29T00:00:00.000Z",
  teamHint: "",
  requirements: [],
  description: "Build the editor.",
};

describe("findConnectablePeople", () => {
  beforeEach(() => {
    parse.mockReset();
  });

  it("keeps real profiles and reuses them for the same role", async () => {
    parse.mockResolvedValue({
      output_parsed: {
        people: [
          {
            name: "Ada Lovelace",
            role: "Engineer",
            why: "UCSB alum",
            url: "https://company.example/ada",
          },
        ],
      },
    });
    const { findConnectablePeople } = await import("@/lib/ai/find-people");
    const found = await findConnectablePeople(
      job,
      getProfile(),
      "UCSB B.S. Computer Engineering"
    );
    expect(found.people.map((person) => person.name)).toEqual(["Ada Lovelace"]);
    expect(found.hooks).toContain("UCSB");
    expect(parse.mock.calls[0][0].input).toContain("UCSB");
    expect(parse.mock.calls[0][0].tools[0].type).toBe("web_search");
    await findConnectablePeople(job, getProfile(), "UCSB B.S. Computer Engineering");
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("drops people who do not share a resume connection", async () => {
    parse.mockResolvedValue({
      output_parsed: {
        people: [
          {
            name: "Grace Hopper",
            role: "Engineer",
            why: "Works in the NYC office",
            url: "https://company.example/grace",
          },
        ],
      },
    });
    const { findConnectablePeople } = await import("@/lib/ai/find-people");
    const found = await findConnectablePeople(
      { ...job, title: "Applied AI Engineer" },
      getProfile(),
      "UCSB B.S. Computer Engineering"
    );
    expect(found.people).toEqual([]);
  });

  it("returns nobody when the resume has no connections", async () => {
    const { findConnectablePeople } = await import("@/lib/ai/find-people");
    const found = await findConnectablePeople(job, getProfile(), "Built APIs.");
    expect(found).toEqual({ hooks: [], people: [] });
    expect(parse).not.toHaveBeenCalled();
  });

  it("returns nobody when the model has no list", async () => {
    parse.mockResolvedValue({ output_parsed: null });
    const { findConnectablePeople } = await import("@/lib/ai/find-people");
    const found = await findConnectablePeople(
      { ...job, title: "Forward Deployed Engineer" },
      getProfile(),
      "UCSB B.S. Computer Engineering"
    );
    expect(found.people).toEqual([]);
  });
});