import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFinderParams, findWithHunter, parseFinder } from "@/lib/hunter";

describe("hunter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("builds Email Finder params from a URL and/or name + company", () => {
    expect(buildFinderParams({ name: "Maya Lin" })).toBeNull();
    const byUrl = buildFinderParams({ linkedinUrl: "linkedin.com/in/maya-lin?x=1", company: "Deloitte" });
    expect(byUrl?.get("linkedin_handle")).toBe("https://www.linkedin.com/in/maya-lin");
    expect(byUrl?.get("company")).toBe("Deloitte");
    const byName = buildFinderParams({ name: "Maya Van Lin", company: "Deloitte" });
    expect(byName?.get("first_name")).toBe("Maya");
    expect(byName?.get("last_name")).toBe("Van Lin");
    expect(buildFinderParams({ name: "Maya", company: "Deloitte" })?.get("full_name")).toBe("Maya");
  });

  it("parses a found email with its score and verification", () => {
    const contact = parseFinder({
      data: {
        first_name: "Maya",
        last_name: "Lin",
        email: "maya.lin@deloitte.com",
        score: 92,
        position: "AI Engineer",
        company: "Deloitte",
        linkedin_url: null,
        verification: { status: "valid" },
      },
    });
    expect(contact).toEqual({
      name: "Maya Lin",
      title: "AI Engineer",
      company: "Deloitte",
      email: "maya.lin@deloitte.com",
      emailStatus: "valid",
      linkedinUrl: "",
      confidence: "92%",
      source: "hunter",
    });
    expect(parseFinder({ data: { email: null } })?.emailStatus).toBe("unavailable");
    expect(parseFinder({})).toBeNull();
  });

  it("sends the key as a header and maps Hunter errors", async () => {
    vi.stubEnv("HUNTER_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { email: "m@co.com", first_name: "M" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await findWithHunter({ linkedinUrl: "linkedin.com/in/m" }))?.email).toBe("m@co.com");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("api.hunter.io/v2/email-finder?linkedin_handle=");
    expect(String(url)).not.toContain("api_key");
    expect(init.headers["X-API-KEY"]).toBe("test-key");

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(findWithHunter({ linkedinUrl: "linkedin.com/in/m" })).rejects.toThrow(/credits/);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 451 }));
    await expect(findWithHunter({ linkedinUrl: "linkedin.com/in/m" })).rejects.toThrow(/asked not/);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    await expect(findWithHunter({ linkedinUrl: "linkedin.com/in/m" })).resolves.toBeNull();
  });
});
