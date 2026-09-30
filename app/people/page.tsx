"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Chip } from "@/components/chip";
import {
  getSeedTrackerRows,
  mergeTrackerRows,
  parseTrackerOverrides,
  TRACKER_STORAGE_KEY,
} from "@/lib/tracker";
import type { TrackerRow } from "@/lib/types";

export default function PeoplePage() {
  const [rows, setRows] = useState<TrackerRow[]>([]);

  useEffect(() => {
    const overrides = parseTrackerOverrides(
      localStorage.getItem(TRACKER_STORAGE_KEY)
    );
    setRows(mergeTrackerRows(getSeedTrackerRows(), overrides));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">People</h1>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            People you draft show up here after you mark them messaged.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{row.person}</h2>
                <Chip>{row.company}</Chip>
                <Chip tone="purple">{row.status}</Chip>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.reason}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
