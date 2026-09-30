"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, OctagonX, Wand2 } from "lucide-react";
import { tailorResumeForJob } from "@/app/actions/ai";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";
import type { TailorResult } from "@/lib/ai/tailor-resume";
import type { SeekerPrefs } from "@/lib/seeker";
import type { FitAction, FitCheckLevel, Job } from "@/lib/types";

const VERDICT: Record<FitAction, { label: string; tone: "green" | "amber" | "rose" }> = {
  apply_now: { label: "Apply now", tone: "green" },
  apply_and_outreach: { label: "Apply + warm note", tone: "amber" },
  skip: { label: "Probably skip", tone: "rose" },
};

const LEVEL_ICON: Record<FitCheckLevel, React.ReactNode> = {
  good: <CheckCircle2 className="size-4 text-success" />,
  warn: <CircleAlert className="size-4 text-warning" />,
  block: <OctagonX className="size-4 text-destructive" />,
};

export function ResumeMatch({
  job,
  seeker,
  reading,
}: {
  job: Job;
  seeker: () => SeekerPrefs;
  reading: boolean;
}) {
  const [tailor, setTailor] = useState<TailorResult | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [error, setError] = useState("");
  const fit = job.fit;

  async function onTailor() {
    setTailoring(true);
    setError("");
    try {
      const result = await tailorResumeForJob(job, seeker());
      if (result.tailor) setTailor(result.tailor);
      else setError(result.error ?? "Could not tailor the resume.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setTailoring(false);
    }
  }

  const verdict = fit ? VERDICT[fit.action] : null;

  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Resume match</h2>
        <div className="flex items-center gap-2">
          {reading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> AI reading posting…
            </span>
          ) : fit?.basis ? (
            <span className="text-xs text-muted-foreground">
              {fit.basis === "ai" ? "Read by AI against your resume" : "Quick estimate from keywords"}
            </span>
          ) : null}
          {verdict ? <Chip tone={verdict.tone}>{verdict.label}</Chip> : null}
        </div>
      </div>

      {fit?.checks && fit.checks.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {fit.checks.map((check) => (
            <li key={`${check.label}-${check.detail}`} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{LEVEL_ICON[check.level]}</span>
              <span>
                <span className="font-medium">{check.label}:</span>{" "}
                <span className="text-muted-foreground">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {fit?.basis === "ai" && fit.reasons.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Why it fits</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {fit.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {fit?.basis === "ai" && fit.gaps.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Gaps to address</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {fit.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(fit?.matchedSkills?.length ?? 0) + (fit?.missingSkills?.length ?? 0) > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Skills in the posting</p>
          <div className="flex flex-wrap gap-1.5">
            {fit?.matchedSkills?.map((skill) => (
              <Chip key={skill} tone="green">
                ✓ {skill}
              </Chip>
            ))}
            {fit?.missingSkills?.map((skill) => (
              <Chip key={skill} tone="amber">
                {skill}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Line-by-line edits to make before you hit apply.
          </p>
          <Button type="button" variant="outline" onClick={onTailor} disabled={tailoring || !job.description}>
            {tailoring ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Tailor my resume
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        {tailoring ? <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" /> : null}
        {tailor ? (
          <div className="mt-4 flex flex-col gap-4 text-sm">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Lead with</p>
              <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
                {tailor.leadBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ol>
            </div>
            {tailor.rewordings.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reword</p>
                <ul className="mt-2 flex flex-col gap-3">
                  {tailor.rewordings.map((item) => (
                    <li key={item.suggested} className="rounded-2xl bg-muted/60 p-3">
                      <p className="text-muted-foreground line-through">{item.original}</p>
                      <p className="mt-1">{item.suggested}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {tailor.missingKeywords.length > 0 ? (
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  ATS keywords to work in (only if true)
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tailor.missingKeywords.map((word) => (
                    <Chip key={word} tone="amber">
                      {word}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
