"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { extractResumePdf } from "@/app/actions/resume";
import { Chip } from "@/components/chip";
import { TARGET_LOCATIONS } from "@/lib/locations";
import { validatePdfUpload } from "@/lib/pdf-text";
import {
  defaultSeekerPrefs,
  parseSeekerPrefs,
  resumeSnapshot,
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
  const [showSkills, setShowSkills] = useState(false);

  useEffect(() => {
    const next = parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
    setPrefs(next);
    onChange?.(next);
    // Load once. Later edits go through commit().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(next: SeekerPrefs) {
    setPrefs(next);
    try {
      localStorage.setItem(SEEKER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      setError("Could not save — browser storage is full or blocked.");
    }
    onChange?.(next);
  }

  async function onPdf(file: File | undefined) {
    if (!file) return;
    const invalid = validatePdfUpload({ name: file.name, size: file.size, type: file.type });
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("resume", file);
      const result = await extractResumePdf(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      commit({ ...prefs, resumeText: result.text, resumeFileName: file.name });
    } catch {
      setError("Could not read that PDF. Try exporting it again as a text PDF.");
    } finally {
      setSaving(false);
    }
  }

  const snapshot = resumeSnapshot(prefs);

  return (
    <section className="rounded-2xl bg-secondary p-8 text-secondary-foreground">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-background text-foreground">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-secondary-foreground/75 uppercase">
              Scoring against
            </p>
            <p className="truncate font-heading text-2xl font-light">
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-4 animate-spin" /> Reading PDF…
                </span>
              ) : (
                snapshot.fileName
              )}
            </p>
            <p className="mt-0.5 text-sm text-secondary-foreground/75">
              {snapshot.gradYear ? `Class of ${snapshot.gradYear}` : "No graduation year found"} ·{" "}
              <button
                type="button"
                onClick={() => setShowSkills((open) => !open)}
                className="underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {snapshot.skills.length} skills detected
              </button>
              {snapshot.hooks.length > 0 ? ` · Warm hooks: ${snapshot.hooks.join(", ")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Location</span>
            <select
              aria-label="Location"
              value={prefs.locationId}
              onChange={(event) => commit({ ...prefs, locationId: event.target.value })}
              className="rounded-full border border-foreground/20 bg-background/80 px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {TARGET_LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </label>
          <label className="cursor-pointer rounded-full bg-brand px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:opacity-85 focus-within:ring-2 focus-within:ring-ring">
            Upload PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Resume PDF"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void onPdf(file);
                event.target.value = "";
              }}
            />
          </label>
          {snapshot.source === "upload" ? (
            <button
              type="button"
              onClick={() => commit({ ...prefs, resumeText: "", resumeFileName: "" })}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-secondary-foreground/75 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Use saved resume"
            >
              <RotateCcw className="size-3.5" /> Saved
            </button>
          ) : null}
        </div>
      </div>
      {showSkills ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {snapshot.skills.map((skill) => (
            <Chip key={skill}>
              {skill}
            </Chip>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
