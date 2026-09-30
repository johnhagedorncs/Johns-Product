"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { runBoardScan } from "@/app/actions/board-scan";
import { Chip } from "@/components/chip";
import { ClockBadge } from "@/components/clock-badge";
import { FitRing } from "@/components/fit-ring";
import { SeekerSetup } from "@/components/seeker-setup";
import { cn } from "cn";
import {
  readInboxCache,
  writeInboxCache,
} from "@/lib/inbox-client-cache";
import {
  isInboxRevealed,
  markInboxRevealed,
  takePendingScan,
} from "@/lib/inbox-session";
import { initials } from "@/lib/draft-text";
import { isFreshPosting, shouldApplyToday, sortJobs, type JobSort } from "@/lib/jobs";
import { locationLabel } from "@/lib/locations";
import {
  defaultSeekerPrefs,
  parseSeekerPrefs,
  SEEKER_STORAGE_KEY,
  type SeekerPrefs,
} from "@/lib/seeker";
import type { Job } from "@/lib/types";

export function InboxBoard() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [note, setNote] = useState("");
  const [scanning, setScanning] = useState(false);
  const [sort, setSort] = useState<JobSort>("match");
  const [prefs, setPrefs] = useState<SeekerPrefs>(defaultSeekerPrefs);

  useEffect(() => {
    const saved = parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
    setPrefs(saved);
    if (!isInboxRevealed()) return;
    const cached = readInboxCache();
    if (!cached) return;
    setJobs(cached.jobs);
    setNote(cached.note);
  }, []);

  async function scan() {
    setScanning(true);
    try {
      const seeker = parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
      setPrefs(seeker);
      const result = await runBoardScan(seeker);
      let nextNote = "";
      const place = locationLabel(seeker.locationId);
      if (result.skippedReason === "missing_openai_config") {
        nextNote = "Add the model names in .env to score fit.";
      } else if (result.scoredJobIds.length > 0) {
        nextNote = `Scored ${result.scoredJobIds.length} new ${place} roles.`;
      }
      setJobs(result.jobs);
      setNote(nextNote);
      writeInboxCache(result.jobs, nextNote);
      markInboxRevealed();
    } finally {
      setScanning(false);
      window.dispatchEvent(new Event("warm-scan-done"));
    }
  }

  useEffect(() => {
    function onScan() {
      takePendingScan();
      void scan();
    }
    window.addEventListener("warm-scan", onScan);
    if (takePendingScan()) void scan();
    return () => window.removeEventListener("warm-scan", onScan);
  }, []);

  const place = locationLabel(prefs.locationId);
  const visible = jobs ? sortJobs(jobs, sort) : [];

  return (
    <div className="flex flex-col gap-4">
      <SeekerSetup onChange={setPrefs} />
      {scanning ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : null}
      {!scanning && jobs === null ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <Radar className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Hit <span className="font-medium text-foreground">Scan now</span> to
            load {place} roles from your watch list.
          </p>
        </div>
      ) : null}
      {!scanning && jobs !== null && jobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <Radar className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No {place} matches on the watch list yet. Scan again in a bit.
          </p>
        </div>
      ) : null}
      {!scanning && jobs !== null && jobs.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {note ? <p className="text-sm text-muted-foreground">{note}</p> : <span />}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort roles">
              {(
                [
                  ["match", "Job match"],
                  ["posted", "Post date"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={sort === id}
                  onClick={() => setSort(id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    sort === id
                      ? "border-transparent bg-secondary text-secondary-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {visible.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex items-start gap-4">
                <div className="grid size-11 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
                  {initials(job.company)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{job.title}</h2>
                    <Chip tone="purple">Tier {job.tier}</Chip>
                    {shouldApplyToday(job.fitScore) && isFreshPosting(job.postedAt) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                        <span className="size-1.5 animate-pulse rounded-full bg-success" />
                        Apply today
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {job.company} · {job.location}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(job.fit?.redFlags ?? []).map((flag) => (
                      <Chip key={flag} tone="rose">
                        {flag}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <FitRing score={job.fitScore} />
                  <ClockBadge postedAt={job.postedAt} />
                </div>
              </div>
            </Link>
          ))}
        </>
      ) : null}
    </div>
  );
}
