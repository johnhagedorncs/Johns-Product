import type { OutreachContact, TrackerRow } from "@/lib/types";

export type RolePerson = {
  name: string;
  detail: string;
};

export function peopleForRole(
  job: { id: string; company: string },
  trackerRows: TrackerRow[],
  contacts: OutreachContact[]
): RolePerson[] {
  const company = job.company.trim().toLowerCase();
  const fromOutreach = contacts
    .filter((contact) => contact.jobId === job.id && contact.name.trim())
    .map((contact) => ({
      name: contact.name.trim(),
      detail: contact.why.trim() || contact.relationship,
    }));
  const fromTracker = trackerRows
    .filter(
      (row) =>
        row.company.trim().toLowerCase() === company && row.person.trim()
    )
    .map((row) => ({
      name: row.person.trim(),
      detail: [row.role, row.status].filter(Boolean).join(" · "),
    }));

  const seen = new Set<string>();
  const people: RolePerson[] = [];
  for (const person of [...fromOutreach, ...fromTracker]) {
    const key = person.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(person);
  }
  return people;
}
