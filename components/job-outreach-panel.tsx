"use client";

import { ContactCard, type MessagedPayload } from "@/components/contact-card";
import type { OutreachContact } from "@/lib/types";
import {
  TRACKER_STORAGE_KEY,
  parseTrackerOverrides,
} from "@/lib/tracker";

function addBusinessDays(from: Date, days: number): string {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

export function JobOutreachPanel({
  contacts,
  company,
  role,
  jobUrl,
}: {
  contacts: OutreachContact[];
  company: string;
  role: string;
  jobUrl: string;
}) {
  function handleMessaged(payload: MessagedPayload) {
    const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
    const overrides = parseTrackerOverrides(raw);
    const id = `trk-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    overrides[id] = {
      id,
      date: today,
      company: payload.company,
      role: payload.role,
      jobUrl: payload.jobUrl,
      person: payload.person,
      linkedinUrl: payload.linkedinUrl,
      reason: payload.reason,
      status: "messaged",
      nextFollowup: addBusinessDays(new Date(), 3),
    };
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(overrides));
  }

  return (
    <div className="flex flex-col gap-4">
      {contacts.map((contact, i) => (
        <ContactCard
          key={`${contact.name}-${i}`}
          contact={contact}
          rank={i + 1}
          company={company}
          role={role}
          jobUrl={jobUrl}
          onMessaged={handleMessaged}
        />
      ))}
    </div>
  );
}
