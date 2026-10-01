import Link from "next/link";
import { Check, Users } from "lucide-react";
import { Chip } from "@/components/chip";
import { ClockBadge } from "@/components/clock-badge";
import { FitRing } from "@/components/fit-ring";
import { initials } from "@/lib/draft-text";
import { isApplyToday, SOURCE_NAMES } from "@/lib/jobs";
import type { Job } from "@/lib/types";

export function ApplyTodayBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
      <span className="size-1.5 animate-pulse rounded-full bg-success" />
      Apply today
    </span>
  );
}

export function JobCard({ job, isNew, applied }: { job: Job; isNew: boolean; applied: boolean }) {
  const sources = job.sources ?? (job.source ? [job.source] : []);
  const matched = job.fit?.matchedSkills?.length ?? 0;
  const total = matched + (job.fit?.missingSkills?.length ?? 0);
  const earlyApplicants = /first|be among/i.test(job.applicants ?? "");

  return (
    <Link
      href={`/jobs/${encodeURIComponent(job.id)}`}
      className="block rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold">
          {initials(job.company)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl leading-tight">{job.title}</h2>
            {isNew ? <Chip tone="blue">New</Chip> : null}
            {applied ? (
              <Chip tone="green" icon={<Check className="size-3" />}>
                Applied
              </Chip>
            ) : isApplyToday(job) ? (
              <ApplyTodayBadge />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.company} · {job.location || "Location not listed"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.onWatchList ? <Chip tone="purple">Tier {job.tier}</Chip> : null}
            {job.early ? <Chip tone="green">Early career</Chip> : null}
            {total >= 3 ? (
              <Chip>
                {matched}/{total} skills
              </Chip>
            ) : null}
            {job.applicants ? (
              <Chip tone={earlyApplicants ? "green" : "neutral"} icon={<Users className="size-3" />}>
                {job.applicants}
              </Chip>
            ) : null}
            {(job.fit?.redFlags ?? []).slice(0, 2).map((flag) => (
              <Chip key={flag} tone="rose">
                {flag}
              </Chip>
            ))}
            <span className="self-center text-xs text-muted-foreground">
              {sources.map((source) => SOURCE_NAMES[source]).join(" · ")}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <FitRing score={job.fitScore} basis={job.fit?.basis} />
          <ClockBadge postedAt={job.postedAt} />
        </div>
      </div>
    </Link>
  );
}
