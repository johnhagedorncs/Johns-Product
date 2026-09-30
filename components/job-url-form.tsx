"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const JOB_SLUGS: Record<string, string> = {
  cursor: "cursor-new-grad-2027",
  sierra: "sierra-swe-agent-ng-2027",
  palantir: "palantir-fdse-ng",
};

export function JobUrlForm({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function resolveJobId(value: string): string | null {
    const v = value.trim().toLowerCase();
    if (!v) return null;
    for (const [key, id] of Object.entries(JOB_SLUGS)) {
      if (v.includes(key)) return id;
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const id = resolveJobId(url);
    if (id) {
      router.push(`/jobs/${id}`);
      return;
    }
    setError(
      "Prototype matches Cursor, Sierra, or Palantir URLs — or paste a link containing those names."
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? "flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-start"
          : "flex w-full max-w-xl flex-col gap-2 sm:flex-row"
      }
    >
      <div className="flex-1">
        <Input
          type="url"
          placeholder="Paste job URL (prototype: cursor, sierra, palantir)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={!!error}
        />
        {error ? (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
      <Button type="submit">Go</Button>
    </form>
  );
}
