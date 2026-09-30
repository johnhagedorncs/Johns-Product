const CONNECTION_NOTE_MAX = 4000;

export function clampConnectionNote(note: string): string {
  return note.trim().slice(0, CONNECTION_NOTE_MAX);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}
