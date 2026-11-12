"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Search } from "lucide-react";
import { draftLinkedInForJob, findContactEmail, researchContact } from "@/app/actions/ai";
import { Chip } from "@/components/chip";
import { DraftBox } from "@/components/draft-box";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import type { LinkedInDraft } from "@/lib/ai/linkedin-draft";
import type { EmailContact } from "@/lib/apollo";
import { initials } from "@/lib/draft-text";
import { readDraft, saveDraft } from "@/lib/job-session";
import type { SeekerPrefs } from "@/lib/seeker";
import { addBusinessDays, parseTrackerOverrides, TRACKER_STORAGE_KEY } from "@/lib/tracker";
import type { Job } from "@/lib/types";

const fieldClass =
  "w-full rounded-2xl border border-border bg-muted/60 p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function OutreachDrafter({ job, seeker }: { job: Job; seeker: () => SeekerPrefs }) {
  // Rendered only after the role loads in the browser, so storage is safe to read here.
  const [saved] = useState(() => readDraft(job.id));
  const [linkedinUrl, setLinkedinUrl] = useState(saved?.linkedinUrl ?? "");
  const [paste, setPaste] = useState(saved?.paste ?? "");
  const [contact, setContact] = useState<EmailContact | null>(saved?.contact ?? null);
  const [looking, setLooking] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchNote, setResearchNote] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<LinkedInDraft | null>(saved?.draft ?? null);
  const [note, setNote] = useState(saved?.note ?? "");
  const [messaged, setMessaged] = useState(saved?.messaged ?? false);
  const [error, setError] = useState("");

  // Autosave so switching tabs never loses a draft in progress.
  useEffect(() => {
    saveDraft(job.id, { paste, draft, note, messaged, linkedinUrl, contact });
  }, [job.id, paste, draft, note, messaged, linkedinUrl, contact]);

  const email = contact?.email ?? "";

  async function onFindEmail(event: React.FormEvent) {
    event.preventDefault();
    setLooking(true);
    setError("");
    try {
      const result = await findContactEmail(job, linkedinUrl, paste);
      setContact(result.contact ?? null);
      setDraft(null);
      setNote("");
      setMessaged(false);
      setResearchNote("");
      if (result.error) setError(result.error);
      // Found them: read up on them right away unless a profile is already pasted.
      if (result.contact?.email && !paste.trim()) void readProfile(result.contact);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLooking(false);
    }
  }

  async function readProfile(person: EmailContact) {
    setResearching(true);
    setResearchNote("");
    try {
      const result = await researchContact({
        name: person.name,
        title: person.title,
        company: person.company || job.company,
        linkedinUrl: person.linkedinUrl || linkedinUrl,
      });
      if (result.profile) {
        setPaste((current) => current.trim() || result.profile);
        setResearchNote("Filled in from public web results. Check it, edit, or paste their LinkedIn for more detail.");
      } else {
        setResearchNote(result.error ?? "Couldn't find much about them online. Draft anyway, or paste their LinkedIn profile.");
      }
    } catch {
      setResearchNote("Couldn't read their public profile. Draft anyway, or paste it.");
    } finally {
      setResearching(false);
    }
  }

  async function onDraft() {
    if (!contact?.email) return;
    setDrafting(true);
    setError("");
    try {
      const result = await draftLinkedInForJob(
        job,
        paste,
        {
          name: contact.name,
          title: contact.title,
          company: contact.company || job.company,
          email: contact.email,
          linkedinUrl: contact.linkedinUrl,
        },
        seeker()
      );
      if (!result.draft) {
        setError(result.error ?? "Could not draft outreach.");
        return;
      }
      setDraft(result.draft);
      setNote(result.draft.connectionNote);
      setMessaged(false);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setDrafting(false);
    }
  }

  function startOver() {
    setContact(null);
    setDraft(null);
    setNote("");
    setMessaged(false);
    setLinkedinUrl("");
    setPaste("");
    setError("");
    setResearchNote("");
  }

  function markMessaged() {
    if (!draft) return;
    const overrides = parseTrackerOverrides(localStorage.getItem(TRACKER_STORAGE_KEY));
    const id = `trk-${Date.now()}`;
    overrides[id] = {
      id,
      date: new Date().toISOString().slice(0, 10),
      company: job.company,
      role: job.title,
      jobUrl: job.jobUrl,
      person: draft.personName || "LinkedIn contact",
      linkedinUrl: draft.linkedinUrl,
      reason: draft.sharedHook ? `${draft.sharedHook} — ${draft.rankReason}` : draft.rankReason,
      status: "messaged",
      nextFollowup: addBusinessDays(new Date(), 3),
      connectionNote: note,
      emailDraft: note,
      email: draft.email || email,
    };
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(overrides));
    setMessaged(true);
  }

  const subject = draft?.subject ?? "";
  const mailto = draft?.email
    ? `mailto:${draft.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(note)}`
    : "";

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onFindEmail} className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-3xl">Reach out</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          1. Pick someone from the warm paths. 2. Find their email. 3. Draft the note. Drafts only — you send it.
        </p>
        <label className="mt-3 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Their LinkedIn URL
        </label>
        <input
          value={linkedinUrl}
          onChange={(event) => setLinkedinUrl(event.target.value)}
          placeholder="https://www.linkedin.com/in/…"
          aria-label="Their LinkedIn URL"
          className={`mt-1 ${fieldClass}`}
        />
        <label className="mt-3 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Their profile (filled in automatically — edit or paste to improve)
        </label>
        <textarea
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          rows={6}
          aria-label="Pasted LinkedIn profile"
          placeholder={
            researching
              ? "Reading their public profile…"
              : "Optional. Found automatically after the email lookup, or paste their LinkedIn (⌘A, copy)."
          }
          className={`mt-1 ${fieldClass}`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={looking || (!linkedinUrl.trim() && !paste.trim())}
            className="rounded-full px-4 border-transparent bg-brand"
          >
            {looking ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Find their email
          </Button>
          <span className="text-xs text-muted-foreground">Uses 1 lookup credit, only when an email is found.</span>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </form>

      {contact ? (
        <article className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-brand text-sm font-semibold">
              {initials(contact.name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl">{contact.name || "Unknown name"}</h3>
              <p className="text-sm text-muted-foreground">
                {[contact.title, contact.company].filter(Boolean).join(" · ") || "No title on file"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {email ? (
              <>
                <span className="font-mono text-sm">{email}</span>
                <Chip tone={["verified", "valid"].includes(contact.emailStatus) ? "green" : "amber"}>
                  {(contact.emailStatus || "unverified").replace("_", "-")}
                  {contact.confidence && contact.source === "hunter" ? ` · ${contact.confidence}` : ""}
                </Chip>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No email found — pick someone else.</span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onDraft}
              disabled={!email || drafting || researching}
              className="rounded-full px-4 border-transparent bg-brand"
            >
              {drafting ? <Loader2 className="size-4 animate-spin" /> : null}
              {draft ? "Redraft email" : "Draft email"}
            </Button>
            {email && !paste.trim() && !researching ? (
              <Button type="button" variant="outline" onClick={() => readProfile(contact)} className="rounded-full px-4">
                <Search className="size-4" />
                Read their profile
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={startOver} className="rounded-full px-4">
              Pick someone else
            </Button>
          </div>
          {researching ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Reading their public profile so the note can be personal…
            </p>
          ) : researchNote ? (
            <p className="mt-2 text-xs text-muted-foreground">{researchNote}</p>
          ) : null}
        </article>
      ) : null}

      {draft && email ? (
        <article className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl">Email to {draft.personName}</h3>
            {draft.sharedHook ? <Chip tone="purple">{draft.sharedHook}</Chip> : null}
          </div>
          <p className="text-sm text-muted-foreground">{draft.rankReason}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">To</dt>
            <dd className="font-mono">{draft.email}</dd>
            <dt className="text-muted-foreground">Subject</dt>
            <dd>{subject}</dd>
          </dl>
          <div className="mt-4">
            <DraftBox email={note} onChange={setNote} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={mailto} className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-4")}>
              <Mail className="size-4" />
              Open in mail app
            </a>
            <Button type="button" onClick={markMessaged} disabled={messaged} className="rounded-full px-4 border-transparent bg-brand">
              {messaged ? "Messaged ✓ — follow-up in 3 business days" : "Mark messaged"}
            </Button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
