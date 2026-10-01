"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronDown, EyeOff, ExternalLink, Users } from "lucide-react";
import { Chip } from "@/components/chip";
import { ClockBadge } from "@/components/clock-badge";
import { FitRing } from "@/components/fit-ring";
import { ApplyTodayBadge } from "@/components/job-card";
import { OutreachDrafter } from "@/components/outreach-drafter";
import { ResumeMatch } from "@/components/resume-match";
import { Button } from "@/components/ui/button";
import { WarmPathsPanel } from "@/components/warm-paths-panel";
import { cn } from "cn";
import { plainDescription } from "@/lib/board-match";
import { readJobStatuses, setJobStatus, type JobStatus } from "@/lib/inbox-store";
import { isApplyToday, SOURCE_NAMES } from "@/lib/jobs";
import { defaultSeekerPrefs, parseSeekerPrefs, SEEKER_STORAGE_KEY, type SeekerPrefs } from "@/lib/seeker";
import type { Job } from "@/lib/types";

export function JobWorkspace({
  job,
  reading = false,
  readError = "",
}: {
  job: Job;
  reading?: boolean;
  readError?: string;
}) {
  const [seeker, setSeeker] = useState<SeekerPrefs>(defaultSeekerPrefs);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [showDescription, setShowDescription] = useState(false);

  useEffect(() => {
    setSeeker(parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY)));
    setStatus(readJobStatuses()[job.id]?.status ?? null);
  }, [job.id]);

  function currentSeeker(): SeekerPrefs {
    return parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
  }

  function toggle(next: JobStatus) {
    const value = status === next ? null : next;
    setJobStatus(job.id, value);
    setStatus(value);
  }

  const sources = job.sources ?? (job.source ? [job.source] : []);
  const description = plainDescription(job.description);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Inbox
      </Link>

      <article className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-5xl">{job.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {job.company} · {job.location || "Location not listed"}
              {job.teamHint ? ` · ${job.teamHint}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ClockBadge postedAt={job.postedAt} />
              {status === "applied" ? (
                <Chip tone="green" icon={<Check className="size-3" />}>
                  Applied
                </Chip>
              ) : isApplyToday(job) ? (
                <ApplyTodayBadge />
              ) : null}
              {job.early ? <Chip tone="green">Early career</Chip> : null}
              {job.onWatchList ? <Chip tone="purple">Watch list · Tier {job.tier}</Chip> : null}
              {job.applicants ? (
                <Chip icon={<Users className="size-3" />}>{job.applicants}</Chip>
              ) : null}
              <span className="text-xs text-muted-foreground">
                via {sources.map((source) => SOURCE_NAMES[source]).join(", ")}
              </span>
            </div>
          </div>
          <FitRing score={job.fitScore} basis={job.fit?.basis} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={job.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-medium transition-all duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Open posting & apply <ExternalLink className="size-3.5" />
          </a>
          <Button className="rounded-full px-4" type="button" variant="outline" onClick={() => toggle("applied")} aria-pressed={status === "applied"}>
            <Check className="size-4" />
            {status === "applied" ? "Applied" : "Mark applied"}
          </Button>
          <Button className="rounded-full px-4" type="button" variant="ghost" onClick={() => toggle("hidden")} aria-pressed={status === "hidden"}>
            <EyeOff className="size-4" />
            {status === "hidden" ? "Hidden" : "Hide"}
          </Button>
        </div>
        {readError ? <p className="mt-3 text-sm text-warning">{readError}</p> : null}
      </article>

      <div className="grid gap-6 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="flex flex-col gap-6">
          <ResumeMatch job={job} seeker={currentSeeker} reading={reading} />
          <article className="rounded-2xl border border-border bg-card p-6">
            <button
              type="button"
              onClick={() => setShowDescription((open) => !open)}
              aria-expanded={showDescription}
              className="flex w-full items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <h2 className="text-3xl">Job description</h2>
              <ChevronDown className={cn("size-4 transition-transform", showDescription && "rotate-180")} />
            </button>
            <div
              className={cn(
                "mt-4 overflow-auto text-sm leading-6 whitespace-pre-wrap text-muted-foreground",
                showDescription ? "max-h-none" : "max-h-48"
              )}
            >
              {description || (reading ? "Loading the posting…" : "No description returned by the board.")}
            </div>
          </article>
        </section>

        <aside className="flex flex-col gap-6">
          <WarmPathsPanel job={job} seeker={seeker} />
          <OutreachDrafter job={job} seeker={currentSeeker} />
        </aside>
      </div>
    </div>
  );
}
