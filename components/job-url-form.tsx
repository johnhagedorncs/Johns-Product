"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { importJobUrl } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertInboxJob } from "@/lib/inbox-store";
import { parseSeekerPrefs, SEEKER_STORAGE_KEY } from "@/lib/seeker";

export function JobUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^https?:\/\//i.test(url.trim())) {
      setError("Paste a full job link that starts with https://");
      return;
    }
    setLoading(true);
    try {
      const seeker = parseSeekerPrefs(localStorage.getItem(SEEKER_STORAGE_KEY));
      const result = await importJobUrl(url.trim(), seeker);
      if (!result.job) {
        setError(result.error ?? "Could not read that link.");
        return;
      }
      upsertInboxJob(result.job);
      router.push(`/jobs/${encodeURIComponent(result.job.id)}`);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 sm:flex-row sm:items-start">
      <div className="relative flex-1">
        <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="url"
          aria-label="Job link"
          placeholder="Paste any job link — Greenhouse, Ashby, Lever, LinkedIn, Workday…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={Boolean(error)}
          className="pl-9"
        />
        {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
      </div>
      <Button type="submit" variant="outline" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        Open role
      </Button>
    </form>
  );
}
