"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { draftLinkedInForJob } from "@/app/actions/ai";
import { Chip } from "@/components/chip";
import { DraftBox } from "@/components/draft-box";
import { Button } from "@/components/ui/button";
import type { LinkedInDraft } from "@/lib/ai/linkedin-draft";
import { initials } from "@/lib/draft-text";
import type { SeekerPrefs } from "@/lib/seeker";
import { addBusinessDays, parseTrackerOverrides, TRACKER_STORAGE_KEY } from "@/lib/tracker";
import type { Job } from "@/lib/types";

export function OutreachDrafter({ job, seeker }: { job: Job; seeker: () => SeekerPrefs }) {
  const [paste, setPaste] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<LinkedInDraft | null>(null);
  const [note, setNote] = useState("");
  const [messaged, setMessaged] = useState(false);
  const [error, setError] = useState("");

  async function onDraft(event: React.FormEvent) {
    event.preventDefault();
    setDrafting(true);
    setError("");
    try {
      const result = await draftLinkedInForJob(job, paste, seeker());
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
    };
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(overrides));
    setMessaged(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onDraft} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Draft a note</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a profile from the warm paths, select all (⌘A), copy, and paste here. Drafts only — you send it.
        </p>
        <textarea
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          rows={6}
          required
          aria-label="Pasted LinkedIn profile"
          placeholder="Paste their LinkedIn profile — headline, About, experience, education."
          className="mt-3 w-full rounded-2xl border border-border bg-muted/60 p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <Button type="submit" disabled={drafting} className="mt-3 border-transparent bg-brand">
          {drafting ? <Loader2 className="size-4 animate-spin" /> : null}
          Draft outreach
        </Button>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </form>

      {draft ? (
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
              {initials(draft.personName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{draft.personName}</h3>
                {draft.sharedHook ? <Chip tone="purple">{draft.sharedHook}</Chip> : null}
              </div>
              <p className="text-sm text-muted-foreground">{draft.rankReason}</p>
            </div>
          </div>
          <div className="mt-4">
            <DraftBox email={note} onChange={setNote} />
          </div>
          <Button type="button" onClick={markMessaged} disabled={messaged} className="mt-4 border-transparent bg-brand">
            {messaged ? "Messaged ✓ — follow-up in 3 business days" : "Mark messaged"}
          </Button>
        </article>
      ) : null}
    </div>
  );
}
