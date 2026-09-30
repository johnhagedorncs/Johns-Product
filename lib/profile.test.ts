import { describe, expect, it } from "vitest";
import { getProfile } from "@/lib/profile";

describe("getProfile", () => {
  it("loads seeded profile", () => {
    const profile = getProfile();
    expect(profile.location).toMatch(/New York/i);
    expect(profile.targetRoles.length).toBeGreaterThan(0);
  });
});
