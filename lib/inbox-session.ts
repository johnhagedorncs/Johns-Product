let pendingScan = false;

/** Ask the inbox to scan — works whether or not the inbox is mounted yet. */
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
