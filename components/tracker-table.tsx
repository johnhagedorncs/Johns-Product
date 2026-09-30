"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatStatusLabel,
  getSeedTrackerRows,
  isFollowUpDue,
  mergeTrackerRows,
  parseTrackerOverrides,
  TRACKER_STORAGE_KEY,
} from "@/lib/tracker";
import type { TrackerRow, TrackerStatus } from "@/lib/types";

const STATUSES: TrackerStatus[] = [
  "queued",
  "messaged",
  "replied",
  "chat",
  "referred",
  "no",
];

export function TrackerTable() {
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [filterDue, setFilterDue] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const seed = getSeedTrackerRows();
    const overrides = parseTrackerOverrides(
      localStorage.getItem(TRACKER_STORAGE_KEY)
    );
    setRows(mergeTrackerRows(seed, overrides));
  }, []);

  function updateStatus(id: string, status: TrackerStatus) {
    const overrides = parseTrackerOverrides(
      localStorage.getItem(TRACKER_STORAGE_KEY)
    );
    overrides[id] = { ...overrides[id], id, status };
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(overrides));
    const seed = getSeedTrackerRows();
    setRows(mergeTrackerRows(seed, overrides));
  }

  const dueRows = useMemo(
    () => rows.filter((r) => isFollowUpDue(r.nextFollowup, today)),
    [rows, today]
  );

  const displayRows = filterDue ? dueRows : rows;

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">No outreach logged yet.</p>
          <Link href="/scan" className="mt-4 inline-block text-primary">
            Scan new roles
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filterDue ? "secondary" : "default"}
          onClick={() => setFilterDue(false)}
        >
          All ({rows.length})
        </Button>
        <Button
          variant={filterDue ? "default" : "secondary"}
          onClick={() => setFilterDue(true)}
        >
          Follow-ups due ({dueRows.length})
        </Button>
      </div>

      {filterDue && dueRows.length > 0 ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Due today</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Send a short nudge — reference your original note and one new
            detail.
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Next follow-up</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{row.person}</div>
                  <div className="text-xs text-muted-foreground">{row.role}</div>
                </td>
                <td className="px-4 py-3">{row.company}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{formatStatusLabel(row.status)}</Badge>
                  {isFollowUpDue(row.nextFollowup, today) ? (
                    <span className="ml-2 text-xs font-medium text-primary">
                      due
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.nextFollowup || "—"}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={row.status}
                    onChange={(e) =>
                      updateStatus(row.id, e.target.value as TrackerStatus)
                    }
                    aria-label={`Status for ${row.person}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {formatStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filterDue && dueRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No follow-ups due today.</p>
      ) : null}
    </div>
  );
}
