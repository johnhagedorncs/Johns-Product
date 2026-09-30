import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InboxBoard } from "@/components/inbox-board";
import { writeInboxCache } from "@/lib/inbox-client-cache";
import {
  markInboxRevealed,
  resetInboxReveal,
} from "@/lib/inbox-session";
import type { Job } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/app/actions/board-scan", () => ({
  runBoardScan: vi.fn(),
}));
vi.mock("@/app/actions/resume", () => ({
  extractResumePdf: vi.fn(),
}));

const job: Job = {
  id: "j1",
  company: "Cursor",
  title: "New Grad Software Engineer",
  location: "New York, NY",
  tier: "A",
  jobUrl: "https://example.com",
  postedAt: "2026-03-29T00:00:00.000Z",
  teamHint: "",
  requirements: [],
  fitScore: 4,
};

describe("inbox before scan", () => {
  afterEach(() => {
    resetInboxReveal();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("does not show cached roles until Scan now", () => {
    writeInboxCache([job], "Scored 1 new role.");
    render(<InboxBoard />);
    expect(screen.getByText(/Scan now/)).toBeInTheDocument();
    expect(screen.queryByText(job.title)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Resume PDF")).toBeInTheDocument();
  });

  it("restores the list after a scan in this session without scanning again", async () => {
    const { runBoardScan } = await import("@/app/actions/board-scan");
    writeInboxCache([job], "Scored 1 new role.");
    markInboxRevealed();
    render(<InboxBoard />);
    expect(await screen.findByText(job.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Job match" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(runBoardScan).not.toHaveBeenCalled();
  });
});
