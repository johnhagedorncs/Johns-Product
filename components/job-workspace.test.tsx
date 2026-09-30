import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobWorkspace } from "@/components/job-workspace";
import { SEEKER_STORAGE_KEY } from "@/lib/seeker";
import { TRACKER_STORAGE_KEY } from "@/lib/tracker";
import type { Job } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/app/actions/ai", () => ({
  tailorResumeForJob: vi.fn(),
  draftLinkedInForJob: vi.fn(),
  findPeopleForJob: vi.fn(async () => ({
    hooks: ["UCSB", "Handshake"],
    people: [
      {
        name: "Ada Lovelace",
        detail: "Engineer · UCSB alum",
        url: "https://company.example/ada",
      },
    ],
  })),
}));

const job: Job = {
  id: "live-1",
  company: "Sierra",
  title: "Software Engineer",
  location: "New York, NY",
  tier: "A",
  jobUrl: "https://example.com/sierra",
  postedAt: "2026-03-29T00:00:00.000Z",
  teamHint: "",
  requirements: [],
};

describe("job workspace people", () => {
  it("shows you and people at the company", async () => {
    localStorage.setItem(
      SEEKER_STORAGE_KEY,
      JSON.stringify({
        name: "Alex",
        locationId: "sf",
        resumeText: "Built compilers.",
        resumeFileName: "alex.pdf",
      })
    );
    localStorage.setItem(
      TRACKER_STORAGE_KEY,
      JSON.stringify({
        "trk-x": {
          id: "trk-x",
          date: "2026-03-29",
          company: "Sierra",
          role: "SWE",
          jobUrl: job.jobUrl,
          person: "Priya Shah",
          linkedinUrl: "",
          reason: "Handshake",
          status: "replied",
          nextFollowup: "",
        },
      })
    );
    render(<JobWorkspace job={job} />);
    expect(await screen.findByRole("heading", { name: "Alex" })).toBeInTheDocument();
    expect(screen.getByText("San Francisco Bay Area")).toBeInTheDocument();
    expect(screen.getByText("Resume · alex.pdf")).toBeInTheDocument();
    expect(screen.getByText("People at Sierra")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Priya Shah" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Paste a LinkedIn profile/i)).not.toBeInTheDocument();
    expect(screen.getByText("Sharing UCSB, Handshake")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open profile" })).toHaveAttribute(
      "href",
      "https://company.example/ada"
    );
  });
});