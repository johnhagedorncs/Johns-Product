import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InboxBoard } from "@/components/inbox-board";
import { writeInbox } from "@/lib/inbox-store";
import type { Job } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/actions/jobs", () => ({
  scanJobs: vi.fn(),
  enrichJobs: vi.fn(async () => ({ jobs: [], aiAvailable: true })),
  importJobUrl: vi.fn(),
}));
vi.mock("@/app/actions/resume", () => ({ extractResumePdf: vi.fn() }));

const fit = { score: 5, reasons: [], gaps: [], redFlags: [], action: "apply_now" as const, basis: "ai" as const };

const job: Job = {
  id: "j1",
  company: "Cursor",
  title: "Software Engineer, New Grad 2027",
  location: "New York, NY",
  tier: "A",
  jobUrl: "https://example.com",
  postedAt: new Date().toISOString(),
  teamHint: "",
  requirements: [],
  fitScore: 5,
  fit,
  sources: ["ashby", "linkedin"],
  onWatchList: true,
};

describe("inbox", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("asks for a first scan and shows what resume it will score against", () => {
    render(<InboxBoard />);
    expect(screen.getByText(/to pull New York roles/)).toBeInTheDocument();
    expect(screen.getByText("Saved resume")).toBeInTheDocument();
    expect(screen.getByText(/Class of 2027/)).toBeInTheDocument();
    expect(screen.getByLabelText("Job link")).toBeInTheDocument();
  });

  it("keeps the last scan after a refresh and filters by fit", () => {
    writeInbox({
      jobs: [job, { ...job, id: "j2", title: "Data Engineer", fitScore: 2, fit: { ...fit, score: 2 } }],
      sources: [{ id: "linkedin", label: "LinkedIn jobs", count: 2 }],
      scannedAt: new Date().toISOString(),
      locationId: "nyc",
      newIds: ["j1"],
    });
    render(<InboxBoard />);
    expect(screen.getByText(job.title)).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Apply today")).toBeInTheDocument();
    expect(screen.queryByText("Data Engineer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All fits" }));
    expect(screen.getByText("Data Engineer")).toBeInTheDocument();
  });

  it("runs a scan and shows every source's count", async () => {
    const { scanJobs } = await import("@/app/actions/jobs");
    vi.mocked(scanJobs).mockResolvedValue({
      jobs: [job],
      sources: [
        { id: "watchlist", label: "Watch list (Greenhouse · Ashby · Lever)", count: 1 },
        { id: "linkedin", label: "LinkedIn jobs", count: 0, error: "LinkedIn did not answer (rate limited)" },
      ],
      scannedAt: new Date().toISOString(),
    });
    const { requestInboxScan } = await import("@/lib/inbox-session");
    render(<InboxBoard />);
    requestInboxScan();
    expect(await screen.findByText(job.title)).toBeInTheDocument();
    expect(screen.getByText(/LinkedIn jobs:/)).toHaveAttribute("title", "LinkedIn did not answer (rate limited)");
  });
});
