let revealed = false;
let pendingScan = false;

export function markInboxRevealed(): void {
  revealed = true;
}

export function isInboxRevealed(): boolean {
  return revealed;
}

export function resetInboxReveal(): void {
  revealed = false;
  pendingScan = false;
}

export function requestInboxScan(): void {
  pendingScan = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("warm-scan"));
  }
}

export function takePendingScan(): boolean {
  const pending = pendingScan;
  pendingScan = false;
  return pending;
}
