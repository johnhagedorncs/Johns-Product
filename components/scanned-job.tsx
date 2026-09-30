"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { JobWorkspace } from "@/components/job-workspace";
import { readInboxCache } from "@/lib/inbox-client-cache";
import { isInboxRevealed } from "@/lib/inbox-session";
import type { Job } from "@/lib/types";

type Gate = "loading" | "need-scan" | "missing" | "ready";

export function ScannedJob({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    if (!isInboxRevealed()) {
      setJob(null);
      setGate("need-scan");
      return;
    }
    const match = readInboxCache()?.jobs.find((item) => item.id === id) ?? null;
    setJob(match);
    setGate(match ? "ready" : "missing");
  }, [id]);

  if (gate === "loading") {
    return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  }

  if (gate !== "ready" || !job) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <Radar className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          {gate === "missing"
            ? "This role is not in the latest scan."
            : "This role shows up after you click Scan now."}
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary">
          Back to inbox
        </Link>
      </div>
    );
  }

  return <JobWorkspace job={job} />;
}
