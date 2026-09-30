import { afterEach, describe, expect, it } from "vitest";
import {
  isInboxRevealed,
  markInboxRevealed,
  requestInboxScan,
  resetInboxReveal,
  takePendingScan,
} from "@/lib/inbox-session";

describe("inbox reveal", () => {
  afterEach(() => {
    resetInboxReveal();
  });

  it("stays hidden until a scan marks the inbox", () => {
    expect(isInboxRevealed()).toBe(false);
    markInboxRevealed();
    expect(isInboxRevealed()).toBe(true);
  });

  it("keeps a scan request until the inbox takes it", () => {
    requestInboxScan();
    expect(takePendingScan()).toBe(true);
    expect(takePendingScan()).toBe(false);
  });
});
