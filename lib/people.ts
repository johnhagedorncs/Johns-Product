import { mentionsResumeHook } from "@/lib/resume-hooks";
import type { OutreachContact, TrackerRow } from "@/lib/types";

export type RolePerson = {
  name: string;
  detail: string;
  url?: string;
};

export type FoundPerson = {
  name: string;
  role: string;
  why: string;
  url: string;
};

function usableUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  if (/example\.com/i.test(trimmed)) return undefined;
  return trimmed;
}

function usableName(name: string): string | undefined {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 60) return undefined;
  if (/not specified|unknown|n\/a|last name/i.test(trimmed)) return undefined;
  if (!/^[\p{L}][\p{L}'.-]+(?:\s+[\p{L}][\p{L}'.-]+)+$/u.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

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
      url: usableUrl(contact.linkedinUrl),
    }));
  const fromTracker = trackerRows
    .filter(
      (row) =>
        row.company.trim().toLowerCase() === company && row.person.trim()
    )
    .map((row) => ({
      name: row.person.trim(),
      detail: [row.role, row.status].filter(Boolean).join(" · "),
      url: usableUrl(row.linkedinUrl),
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

export function acceptFoundPeople(
  people: FoundPerson[],
  hooks: string[] = []
): RolePerson[] {
  const seen = new Set<string>();
  const accepted: RolePerson[] = [];
  for (const person of people) {
    const name = usableName(person.name);
    const url = usableUrl(person.url);
    if (!name || !url) continue;
    const detail = [person.role.trim(), person.why.trim()].filter(Boolean).join(" · ");
    if (hooks.length > 0 && !mentionsResumeHook(`${person.role} ${person.why}`, hooks)) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({ name, detail, url });
    if (accepted.length === 5) break;
  }
  return accepted;
}

export function mergeRolePeople(
  saved: RolePerson[],
  found: RolePerson[]
): RolePerson[] {
  const seen = new Set<string>();
  const people: RolePerson[] = [];
  for (const person of [...saved, ...found]) {
    const key = person.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    people.push(person);
  }
  return people;
}
