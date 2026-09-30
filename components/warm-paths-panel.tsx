"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { findPeopleForJob, visibleWarmPaths } from "@/app/actions/ai";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/draft-text";
import { readPeopleCache, writePeopleCache } from "@/lib/people-cache";
import { mergeRolePeople, peopleForRole, type RolePerson } from "@/lib/people";
import { resumeHooks } from "@/lib/resume-hooks";
import { effectiveResume, type SeekerPrefs } from "@/lib/seeker";
import { getSeedTrackerRows, mergeTrackerRows, parseTrackerOverrides, TRACKER_STORAGE_KEY } from "@/lib/tracker";
import { warmPaths, type WarmPath } from "@/lib/warm-paths";
import type { Job } from "@/lib/types";

export function WarmPathsPanel({ job, seeker }: { job: Job; seeker: SeekerPrefs }) {
  const [known, setKnown] = useState<RolePerson[]>([]);
  const [found, setFound] = useState<RolePerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState<WarmPath[] | null>(null);

  const resume = effectiveResume(seeker);

  useEffect(() => {
    const rows = mergeTrackerRows(
      getSeedTrackerRows(),
      parseTrackerOverrides(localStorage.getItem(TRACKER_STORAGE_KEY))
    );
    setKnown(peopleForRole(job, rows, []));
    const cached = readPeopleCache(job, resume);
    setFound(cached ? cached.people : null);
  }, [job, resume]);

  useEffect(() => {
    const current = warmPaths(job, resumeHooks(resume), seeker.locationId);
    let cancelled = false;
    setVisible(null);
    visibleWarmPaths(current)
      .then((next) => {
        if (!cancelled) setVisible(next);
      })
      .catch(() => {
        if (!cancelled) setVisible(current);
      });
    return () => {
      cancelled = true;
    };
  }, [job.company, job.title, resume, seeker.locationId]);

  async function searchWeb() {
    setSearching(true);
    setError("");
    try {
      const result = await findPeopleForJob(job, seeker);
      if (result.error) {
        setError(result.error);
        return;
      }
      writePeopleCache(job, resume, { hooks: result.hooks, people: result.people });
      setFound(result.people);
    } catch {
      setError("The search did not finish. Try again in a minute.");
    } finally {
      setSearching(false);
    }
  }

  const people = mergeRolePeople(known, found ?? []);

  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Warm paths into {job.company}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ranked searches. Each opens in your logged-in LinkedIn — pick 2–3 people, then draft below.
      </p>
      {visible === null ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Checking which searches have people…
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          None of these searches returned LinkedIn profiles.
        </p>
      ) : (
      <ol className="mt-4 flex flex-col gap-3">
        {visible.map((path, index) => (
          <li key={path.id} className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs text-secondary-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{path.label}</p>
              <p className="text-xs text-muted-foreground">{path.why}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                <a
                  href={path.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary"
                >
                  LinkedIn <ExternalLink className="size-3" />
                </a>
                <a
                  href={path.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  Google <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
            <span className="font-mono text-xs text-muted-foreground" title="Rank points">
              {path.points}
            </span>
          </li>
        ))}
      </ol>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Names found</p>
          <Button type="button" variant="outline" size="sm" onClick={searchWeb} disabled={searching}>
            {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            {found ? "Search again" : "Find names with AI"}
          </Button>
        </div>
        {searching ? (
          <p className="mt-2 text-xs text-muted-foreground">Searching public profiles — about 30 seconds…</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        {!searching && found && found.length === 0 && known.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Web search came back empty — that is common. The LinkedIn searches above are the reliable path.
          </p>
        ) : null}
        {people.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-3">
            {people.map((person) => (
              <li key={person.name} className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
                  {initials(person.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{person.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{person.detail}</p>
                </div>
                {person.url ? (
                  <a
                    href={person.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto shrink-0 text-xs font-medium text-primary"
                  >
                    Profile
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {found && found.length > 0 ? (
          <p className="mt-3">
            <Chip tone="amber">Found by web search — confirm they still work there before you write</Chip>
          </p>
        ) : null}
      </div>
    </article>
  );
}
