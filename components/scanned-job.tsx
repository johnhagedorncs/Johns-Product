"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { enrichJobs } from "@/app/actions/jobs";
import { JobUrlForm } from "@/components/job-url-form";
import { JobWorkspace } from "@/components/job-workspace";
import { applyEnrichment } from "@/lib/enrich";
import { findInboxJob, saveAiFits, upsertInboxJob } from "@/lib/inbox-store";
import { markReadThisSession, wasReadThisSession } from "@/lib/job-session";
import { effectiveResume, parseSeekerPrefs, SEEKER_STORAGE_KEY, textHash } from "@/lib/seeker";
import type { Job } from "@/lib/types";

type Gate = "loading" | "missing" | "ready";

export function ScannedJob({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [gate, setGate] = useState<Gate>("loading");
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");

  useEffect(() => {
    const decoded = decodeURIComponent(id);
    const match = findInboxJob(decoded);
    setJob(match);
    setGate(match ? "ready" : "missing");
    if (!match || (match.description && match.fit?.basis === "ai")) return;
    // Coming back from another tab shouldn't re-read the posting (or retry a failed read).
    if (wasReadThisSession(match.id)) return;
    markReadThisSession(match.id);

    let cancelled = false;
    const seeker = parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
    setReading(true);
    enrichJobs([match], seeker)
      .then((result) => {
        if (cancelled) return;
        const [update] = result.jobs;
        if (!update) return;
        const next = applyEnrichment([match], [update])[0];
        saveAiFits([update], textHash(effectiveResume(seeker)));
        upsertInboxJob(next);
        setJob(next);
        if (update.error) setReadError(update.error);
      })
      .catch(() => {
        if (!cancelled) setReadError("Could not reach the server to read this posting.");
      })
      .finally(() => {
        if (!cancelled) setReading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (gate === "loading") {
    return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  }

  if (gate === "missing" || !job) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-10 text-center">
        <Radar className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This role is not in this browser&apos;s inbox. Scan again, or paste the job link to open it.
        </p>
        <div className="mx-auto w-full max-w-xl text-left">
          <JobUrlForm />
        </div>
        <Link href="/" className="text-sm font-medium text-primary">
          Back to inbox
        </Link>
      </div>
    );
  }

  return <JobWorkspace job={job} reading={reading} readError={readError} />;
}
