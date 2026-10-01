"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Radar, Sparkles } from "lucide-react";
import { enrichJobs, scanJobs } from "@/app/actions/jobs";
import { JobCard } from "@/components/job-card";
import { JobUrlForm } from "@/components/job-url-form";
import { SeekerSetup } from "@/components/seeker-setup";
import { cn } from "cn";
import { applyEnrichment, chunk, pickForEnrichment } from "@/lib/enrich";
import {
  applyCachedFits,
  markSeen,
  readInbox,
  readJobStatuses,
  saveAiFits,
  writeInbox,
  type Inbox,
  type JobStatusEntry,
} from "@/lib/inbox-store";
import { takePendingScan } from "@/lib/inbox-session";
import { filterJobs, isApplyToday, sortJobs, type JobSort, type SourceFilter } from "@/lib/jobs";
import { locationLabel } from "@/lib/locations";
import {
  defaultSeekerPrefs,
  effectiveResume,
  parseSeekerPrefs,
  SEEKER_STORAGE_KEY,
  textHash,
  type SeekerPrefs,
} from "@/lib/seeker";

const DEEP_SCORE_BATCH = 24;
const REQUEST_SIZE = 6;

type View = "todo" | "applied" | "hidden";

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            value === id
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function currentSeeker(): SeekerPrefs {
  return parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
}

export function InboxBoard() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, JobStatusEntry>>({});
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scoring, setScoring] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<JobSort>("match");
  const [minFit, setMinFit] = useState<"0" | "3" | "4">("3");
  const [source, setSource] = useState<SourceFilter>("all");
  const [view, setView] = useState<View>("todo");
  const [query, setQuery] = useState("");
  const [prefs, setPrefs] = useState<SeekerPrefs>(defaultSeekerPrefs);
  const inboxRef = useRef<Inbox | null>(null);
  const runRef = useRef(0);
  const aiAvailableRef = useRef<boolean | undefined>(undefined);

  const commitInbox = useCallback((next: Inbox) => {
    inboxRef.current = next;
    setInbox(next);
    writeInbox(next);
  }, []);

  const deepScore = useCallback(
    async (limit = DEEP_SCORE_BATCH) => {
      const run = runRef.current;
      const current = inboxRef.current;
      if (!current) return;
      const seeker = currentSeeker();
      const hash = textHash(effectiveResume(seeker));
      const hidden = new Set(Object.keys(readJobStatuses()));
      const picks = pickForEnrichment(current.jobs, hidden, limit, { aiAvailable: aiAvailableRef.current });
      if (picks.length === 0) return;
      setScoring({ done: 0, total: picks.length });
      let done = 0;
      for (const batch of chunk(picks, REQUEST_SIZE)) {
        if (run !== runRef.current) return;
        try {
          const result = await enrichJobs(batch, seeker);
          if (run !== runRef.current || !inboxRef.current) return;
          saveAiFits(result.jobs, hash);
          commitInbox({ ...inboxRef.current, jobs: applyEnrichment(inboxRef.current.jobs, result.jobs) });
          aiAvailableRef.current = result.aiAvailable;
          if (!result.aiAvailable) {
            setNotice("Add OPENAI_API_KEY to have the AI read each posting against your resume. Scores are quick estimates for now.");
          }
        } catch {
          setNotice("Deep scoring stopped early — the server did not answer. Quick estimates are still shown.");
          break;
        }
        done += batch.length;
        setScoring({ done, total: picks.length });
      }
      if (run === runRef.current) setScoring(null);
    },
    [commitInbox]
  );

  const scan = useCallback(async () => {
    runRef.current += 1;
    setScanning(true);
    setScoring(null);
    setNotice("");
    try {
      const seeker = currentSeeker();
      setPrefs(seeker);
      const result = await scanJobs(seeker);
      const hash = textHash(effectiveResume(seeker));
      const jobs = applyCachedFits(result.jobs, hash);
      const fresh = markSeen(jobs);
      setNewIds(fresh);
      commitInbox({
        jobs,
        sources: result.sources,
        scannedAt: result.scannedAt,
        locationId: seeker.locationId,
        newIds: [...fresh],
      });
      setScanning(false);
      void deepScore();
    } catch {
      setNotice("The scan did not finish. Check your connection and try again.");
    } finally {
      setScanning(false);
      window.dispatchEvent(new Event("warm-scan-done"));
    }
  }, [commitInbox, deepScore]);

  useEffect(() => {
    setPrefs(currentSeeker());
    setStatuses(readJobStatuses());
    const saved = readInbox();
    if (saved) {
      inboxRef.current = saved;
      setInbox(saved);
      setNewIds(new Set(saved.newIds));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    function onScan() {
      takePendingScan();
      void scan();
    }
    window.addEventListener("warm-scan", onScan);
    if (takePendingScan()) void scan();
    return () => window.removeEventListener("warm-scan", onScan);
  }, [scan]);

  const place = locationLabel(prefs.locationId);
  const jobs = inbox?.jobs ?? [];
  const inView = jobs.filter((job) => {
    const status = statuses[job.id]?.status;
    if (view === "applied") return status === "applied";
    if (view === "hidden") return status === "hidden";
    return !status;
  });
  const visible = sortJobs(
    filterJobs(inView, { minFit: Number(minFit), source, query, hidden: new Set() }),
    sort
  );
  const applyToday = inView.filter((job) => isApplyToday(job)).length;
  const scannedAgo = inbox?.scannedAt
    ? new Date(inbox.scannedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div className="flex flex-col gap-4">
      <SeekerSetup onChange={setPrefs} />
      <JobUrlForm />

      {scanning ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Scanning your watch list, SimplifyJobs, and LinkedIn for {place} roles…
          </p>
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : null}

      {notice ? (
        <p className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          {notice}
        </p>
      ) : null}

      {!scanning && loaded && !inbox ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Radar className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Hit <span className="font-medium text-foreground">Scan now</span> to pull {place} roles
            from your watch list, SimplifyJobs, and LinkedIn — each one scored against your resume.
          </p>
        </div>
      ) : null}

      {!scanning && inbox ? (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{applyToday}</span> to apply
                today · <span className="font-mono">{jobs.length}</span> roles
                {scannedAgo ? ` · scanned ${scannedAgo}` : ""}
              </p>
              {scoring ? (
                <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  AI reading postings {scoring.done}/{scoring.total}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void deepScore()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm transition-all duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Sparkles className="size-3.5" /> Deep-score more
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {inbox.sources.map((item) => (
                <span key={item.id} className={cn(item.error && item.count === 0 && "text-destructive")} title={item.error}>
                  {item.label}: <span className="font-mono">{item.count}</span>
                  {item.error ? " ⚠" : ""}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pills
                label="View"
                value={view}
                onChange={setView}
                options={[
                  ["todo", "To apply"],
                  ["applied", "Applied"],
                  ["hidden", "Hidden"],
                ]}
              />
              <span className="h-5 w-px bg-border" />
              <Pills
                label="Minimum fit"
                value={minFit}
                onChange={setMinFit}
                options={[
                  ["0", "All fits"],
                  ["3", "3+"],
                  ["4", "4+"],
                ]}
              />
              <span className="h-5 w-px bg-border" />
              <Pills
                label="Sort roles"
                value={sort}
                onChange={setSort}
                options={[
                  ["match", "Best fit"],
                  ["posted", "Newest"],
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pills
                label="Source"
                value={source}
                onChange={setSource}
                options={[
                  ["all", "All sources"],
                  ["watchlist", "Watch list"],
                  ["simplify", "Simplify"],
                  ["linkedin", "LinkedIn"],
                ]}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by company or title"
                aria-label="Filter by company or title"
                className="min-w-40 flex-1 rounded-full border border-border bg-muted/60 px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <Radar className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {jobs.length === 0
                  ? `No ${place} roles right now. Scan again later or widen the location.`
                  : "Nothing matches these filters. Try All fits or another source."}
              </p>
            </div>
          ) : (
            visible.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isNew={newIds.has(job.id)}
                applied={statuses[job.id]?.status === "applied"}
              />
            ))
          )}
        </>
      ) : null}
    </div>
  );
}
