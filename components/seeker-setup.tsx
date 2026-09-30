"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { extractResumePdf } from "@/app/actions/resume";
import { TARGET_LOCATIONS } from "@/lib/locations";
import { validatePdfUpload } from "@/lib/pdf-text";
import {
  defaultSeekerPrefs,
  parseSeekerPrefs,
  SEEKER_STORAGE_KEY,
  type SeekerPrefs,
} from "@/lib/seeker";

type SeekerSetupProps = {
  onChange?: (prefs: SeekerPrefs) => void;
};

export function SeekerSetup({ onChange }: SeekerSetupProps) {
  const [prefs, setPrefs] = useState<SeekerPrefs>(defaultSeekerPrefs);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
    setPrefs(next);
    onChange?.(next);
    // Load once. Later edits go through commit().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(next: SeekerPrefs) {
    setPrefs(next);
    localStorage.setItem(SEEKER_STORAGE_KEY, JSON.stringify(next));
    onChange?.(next);
  }

  async function onPdf(file: File | undefined) {
    if (!file) return;
    const invalid = validatePdfUpload({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("resume", file);
      const { text } = await extractResumePdf(form);
      commit({ ...prefs, resumeText: text, resumeFileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that PDF");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Your name</span>
        <input
          value={prefs.name}
          onChange={(event) => commit({ ...prefs, name: event.target.value })}
          placeholder="Leave blank to use the saved profile"
          className="rounded-2xl border border-border bg-muted/60 px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Location</span>
        <select
          aria-label="Location"
          value={prefs.locationId}
          onChange={(event) =>
            commit({ ...prefs, locationId: event.target.value })
          }
          className="rounded-2xl border border-border bg-muted/60 px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {TARGET_LOCATIONS.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Resume PDF</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          aria-label="Resume PDF"
          onChange={(event) => {
            const file = event.target.files?.[0];
            void onPdf(file);
            event.target.value = "";
          }}
          className="text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
        />
        <span className="text-muted-foreground">
          {saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" /> Reading PDF…
            </span>
          ) : prefs.resumeFileName ? (
            `Using ${prefs.resumeFileName}`
          ) : (
            "No PDF yet. Scoring uses the saved resume until you upload one."
          )}
        </span>
        {error ? <span className="text-destructive">{error}</span> : null}
      </label>
    </form>
  );
}
