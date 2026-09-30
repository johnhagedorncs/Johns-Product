"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import {
  draftLinkedInForJob,
  findPeopleForJob,
  tailorResumeForJob,
} from "@/app/actions/ai";
import { Chip } from "@/components/chip";
import { ClockBadge } from "@/components/clock-badge";
import { DraftBox } from "@/components/draft-box";
import { FitRing } from "@/components/fit-ring";
import { Button } from "@/components/ui/button";
import { plainDescription } from "@/lib/board-match";
import { initials } from "@/lib/draft-text";
import { getOutreachForJob, isFreshPosting, shouldApplyToday } from "@/lib/jobs";
import { locationLabel } from "@/lib/locations";
import { readPeopleCache, writePeopleCache } from "@/lib/people-cache";
import { mergeRolePeople, peopleForRole, type RolePerson } from "@/lib/people";
import { getProfile } from "@/lib/profile";
import {
  defaultSeekerPrefs,
  parseSeekerPrefs,
  SEEKER_STORAGE_KEY,
  type SeekerPrefs,
} from "@/lib/seeker";
import {
  getSeedTrackerRows,
  mergeTrackerRows,
  TRACKER_STORAGE_KEY,
  parseTrackerOverrides,
} from "@/lib/tracker";
import type { TailorResult } from "@/lib/ai/tailor-resume";
import type { Job } from "@/lib/types";

function addBusinessDays(from: Date, days: number): string {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

export function JobWorkspace({ job }: { job: Job }) {
  const [tailor, setTailor] = useState<TailorResult | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [paste, setPaste] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [person, setPerson] = useState("");
  const [messaged, setMessaged] = useState(false);
  const [error, setError] = useState("");
  const [seeker, setSeeker] = useState<SeekerPrefs>(defaultSeekerPrefs);
  const [companyPeople, setCompanyPeople] = useState<RolePerson[]>([]);
  const [matchHooks, setMatchHooks] = useState<string[]>([]);
  const [lookingUp, setLookingUp] = useState(true);
  const [peopleError, setPeopleError] = useState("");

  useEffect(() => {
    const prefs = parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
    setSeeker(prefs);
    const rows = mergeTrackerRows(
      getSeedTrackerRows(),
      parseTrackerOverrides(localStorage.getItem(TRACKER_STORAGE_KEY))
    );
    const saved = peopleForRole(job, rows, getOutreachForJob(job.id));
    const cached = readPeopleCache(job, prefs.resumeText);
    if (cached) {
      setMatchHooks(cached.hooks);
      setCompanyPeople(mergeRolePeople(saved, cached.people));
      setLookingUp(false);
      return;
    }
    setCompanyPeople(saved);
    setLookingUp(true);
    setPeopleError("");
    let cancelled = false;
    findPeopleForJob(job, prefs)
      .then((found) => {
        if (cancelled) return;
        writePeopleCache(job, prefs.resumeText, found);
        setMatchHooks(found.hooks);
        setCompanyPeople(mergeRolePeople(saved, found.people));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPeopleError(
          err instanceof Error ? err.message : "Could not look up people"
        );
      })
      .finally(() => {
        if (!cancelled) setLookingUp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job]);

  function currentSeeker(): SeekerPrefs {
    return parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
  }

  async function onTailor() {
    setTailoring(true);
    setError("");
    try {
      setTailor(await tailorResumeForJob(job, currentSeeker()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not tailor resume");
    } finally {
      setTailoring(false);
    }
  }

  async function onDraft(event: React.FormEvent) {
    event.preventDefault();
    setDrafting(true);
    setError("");
    try {
      const draft = await draftLinkedInForJob(job, paste, currentSeeker());
      setPerson(draft.personName);
      setReason(draft.rankReason);
      setNote(draft.connectionNote);
      setEmail(draft.email);
      setQuestions(draft.coffeeQuestions);
      setMessaged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft outreach");
    } finally {
      setDrafting(false);
    }
  }

  function markMessaged() {
    const overrides = parseTrackerOverrides(
      localStorage.getItem(TRACKER_STORAGE_KEY)
    );
    const id = `trk-${Date.now()}`;
    overrides[id] = {
      id,
      date: new Date().toISOString().slice(0, 10),
      company: job.company,
      role: job.title,
      jobUrl: job.jobUrl,
      person: person || "LinkedIn contact",
      linkedinUrl: "",
      reason,
      status: "messaged",
      nextFollowup: addBusinessDays(new Date(), 3),
      connectionNote: note,
      emailDraft: email,
      coffeeQuestions: questions,
    };
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(overrides));
    setMessaged(true);
  }

  const pulse =
    shouldApplyToday(job.fitScore) && isFreshPosting(job.postedAt);
  const saved = getProfile();
  const youName = seeker.name.trim() || saved.name;
  const youPlace = locationLabel(seeker.locationId);
  const usingSavedProfile = !seeker.name.trim() && !seeker.resumeText.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            You
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
              {initials(youName)}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{youName}</h2>
              <p className="text-sm text-muted-foreground">{youPlace}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {seeker.resumeFileName
              ? `Resume · ${seeker.resumeFileName}`
              : usingSavedProfile
                ? `${saved.school} · ${saved.fraternity}`
                : "Upload a PDF resume so scoring uses your background."}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            People at {job.company}
          </p>
          {matchHooks.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Sharing {matchHooks.join(", ")}
            </p>
          ) : null}
          {lookingUp ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Looking for people at {job.company} who share your resume…
            </p>
          ) : null}
          {peopleError ? (
            <p className="mt-3 text-sm text-destructive">{peopleError}</p>
          ) : null}
          {!lookingUp && companyPeople.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No one at {job.company} shares a school, employer, or group on
              your resume.
            </p>
          ) : null}
          {companyPeople.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3">
              {companyPeople.map((person) => (
                <li key={person.name} className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
                    {initials(person.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{person.name}</h3>
                    <p className="text-sm text-muted-foreground">{person.detail}</p>
                    {person.url ? (
                      <a
                        href={person.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary"
                      >
                        Open profile
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="flex flex-col gap-4">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{job.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {job.company} · {job.location}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ClockBadge postedAt={job.postedAt} />
                {pulse ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    <span className="size-1.5 animate-pulse rounded-full bg-success" />
                    Apply today
                  </span>
                ) : null}
                {job.fit?.action ? <Chip tone="purple">{job.fit.action}</Chip> : null}
              </div>
            </div>
            <FitRing score={job.fitScore} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip icon={<span className="size-1.5 rounded-full bg-primary" />}>
              {job.location}
            </Chip>
            {job.early ? <Chip tone="green">Early career</Chip> : null}
            {(job.fit?.reasons ?? []).map((reasonText) => (
              <Chip key={reasonText}>{reasonText}</Chip>
            ))}
            {(job.fit?.redFlags ?? []).map((flag) => (
              <Chip key={flag} tone="rose" icon={<TriangleAlert className="size-3" />}>
                {flag}
              </Chip>
            ))}
          </div>
          <div className="mt-4 max-h-80 overflow-auto text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
            {plainDescription(job.description) ||
              "No description returned by the board."}
          </div>
          <a
            href={job.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            Open posting <ExternalLink className="size-3.5" />
          </a>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Resume</h2>
            <Button type="button" onClick={onTailor} disabled={tailoring} className="bg-brand border-transparent">
              {tailoring ? <Loader2 className="size-4 animate-spin" /> : null}
              Tailor resume
            </Button>
          </div>
          {tailoring ? <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" /> : null}
          {tailor ? (
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {tailor.leadBullets.map((bullet) => (
                  <Chip key={bullet} tone="blue">
                    {bullet}
                  </Chip>
                ))}
              </div>
              {tailor.rewordings.map((item) => (
                <p key={item.suggested} className="text-muted-foreground">
                  <span className="line-through">{item.original}</span> {item.suggested}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                {tailor.missingKeywords.map((word) => (
                  <Chip key={word} tone="amber">
                    {word}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <aside className="flex flex-col gap-4">
        <form
          onSubmit={onDraft}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Paste LinkedIn profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drafts only. You send the note.
          </p>
          <textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            rows={8}
            required
            placeholder="Paste the About, headline, and experience."
            className="mt-3 w-full rounded-2xl border border-border bg-muted/60 p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <Button type="submit" disabled={drafting} className="mt-3 bg-brand border-transparent">
            {drafting ? <Loader2 className="size-4 animate-spin" /> : null}
            Draft outreach
          </Button>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </form>

        {person ? (
          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
                {initials(person)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{person}</h3>
                  <Chip tone="purple">#1</Chip>
                </div>
                <p className="text-sm text-muted-foreground">{reason}</p>
              </div>
            </div>
            <div className="mt-4">
              <DraftBox
                connectionNote={note}
                email={email}
                onConnectionChange={setNote}
                onEmailChange={setEmail}
              />
            </div>
            <ul className="mt-8 flex flex-col gap-2">
              {questions.map((question) => (
                <li key={question}>
                  <Chip>{question}</Chip>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              onClick={markMessaged}
              disabled={messaged}
              className="mt-4 bg-brand border-transparent"
            >
              {messaged ? "Messaged ✓" : "Mark messaged"}
            </Button>
          </article>
        ) : null}
      </aside>
    </div>
    </div>
  );
}
