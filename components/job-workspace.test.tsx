import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobWorkspace } from "@/components/job-workspace";
import { ruleFit } from "@/lib/fit";
import { savedResumeText } from "@/lib/profile";
import type { Job } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/app/actions/ai", () => ({
  draftLinkedInForJob: vi.fn(),
  findPeopleForJob: vi.fn(),
  tailorResumeForJob: vi.fn(),
  visibleWarmPaths: vi.fn(async (paths: unknown) => paths),
}));

const base: Job = {
  id: "anthropic-1",
  company: "Anthropic",
  title: "Applied AI Engineer, New Grad",
  location: "New York City, NY",
  tier: "A",
  jobUrl: "https://job-boards.greenhouse.io/anthropic/jobs/1",
  postedAt: "2026-09-29T00:00:00.000Z",
  teamHint: "Applied AI",
  requirements: [],
  description: "Build with Python, Kubernetes, and LLM evals. Rust a must. Graduating in 2027.",
  sources: ["greenhouse"],
  onWatchList: true,
};
const fit = ruleFit(base, { resumeText: savedResumeText(), locationId: "nyc" });
const job: Job = { ...base, fit, fitScore: fit.score };

describe("job workspace", () => {
  afterEach(cleanup);

  it("shows how the resume matches the posting", () => {
    render(<JobWorkspace job={job} />);
    expect(screen.getByRole("heading", { name: "Resume match" })).toBeInTheDocument();
    expect(screen.getByText("Targets your 2027 class")).toBeInTheDocument();
    expect(screen.getByText("✓ Python")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
    expect(screen.getByText("Quick estimate from keywords")).toBeInTheDocument();
  });

  it("offers UCSB and team searches at the company even before any names are found", async () => {
    render(<JobWorkspace job={job} />);
    expect(await screen.findByText("UCSB alumni at Anthropic")).toBeInTheDocument();
    expect(screen.getByText("AI engineers at Anthropic")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /LinkedIn/ });
    expect(links[0]).toHaveAttribute("href", expect.stringContaining("linkedin.com/search/results/people"));
    expect(screen.getByRole("button", { name: "Find names with AI" })).toBeInTheDocument();
  });
});
