"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import {
  formatStatusLabel,
  getSeedTrackerRows,
  isFollowUpDue,
  mergeTrackerRows,
  parseTrackerOverrides,
  TRACKER_STORAGE_KEY,
} from "@/lib/tracker";
import type { TrackerRow, TrackerStatus } from "@/lib/types";

const COLUMNS: TrackerStatus[] = [
  "queued",
  "messaged",
  "replied",
  "chat",
  "referred",
  "no",
];

export function KanbanBoard() {
  const [rows, setRows] = useState<TrackerRow[]>([]);

  useEffect(() => {
    const overrides = parseTrackerOverrides(
      localStorage.getItem(TRACKER_STORAGE_KEY)
    );
    setRows(mergeTrackerRows(getSeedTrackerRows(), overrides));
  }, []);

  function persist(next: TrackerRow[]) {
    const overrides = parseTrackerOverrides(
      localStorage.getItem(TRACKER_STORAGE_KEY)
    );
    for (const row of next) {
      overrides[row.id] = row;
    }
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(overrides));
    setRows(mergeTrackerRows(getSeedTrackerRows(), overrides));
  }

  function move(id: string, status: TrackerStatus) {
    persist(rows.map((row) => (row.id === id ? { ...row, status } : row)));
  }

  const today = new Date().toISOString().slice(0, 10);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <Inbox className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          No outreach yet. Open a role and paste a LinkedIn profile.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((status) => {
        const cards = rows.filter((row) => row.status === status);
        return (
          <section
            key={status}
            className="w-64 shrink-0 rounded-2xl border border-border bg-muted/40 p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData("text/plain");
              if (id) move(id, status);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{formatStatusLabel(status)}</h2>
              <span className="rounded-full bg-card px-2 py-0.5 font-mono text-xs">
                {cards.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((card) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/plain", card.id)
                  }
                  className="cursor-grab rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{card.person}</p>
                    {(card.status === "messaged" || card.status === "queued") &&
                    isFollowUpDue(card.nextFollowup, today) ? (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                        Follow up
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {card.company} · {card.role}
                  </p>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
