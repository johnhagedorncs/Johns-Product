import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMatchParams, extractLinkedInUrl, matchContact, parseMatch } from "@/lib/apollo";

describe("apollo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normalizes LinkedIn profile URLs", () => {
    expect(extractLinkedInUrl("linkedin.com/in/maya-lin-123/?trk=x")).toBe("https://www.linkedin.com/in/maya-lin-123");
    expect(extractLinkedInUrl("see https://uk.linkedin.com/in/jdoe overview")).toBe("https://www.linkedin.com/in/jdoe");
    expect(extractLinkedInUrl("https://www.linkedin.com/company/deloitte")).toBe("");
  });

  it("needs a URL, or a name plus company", () => {
    expect(buildMatchParams({ name: "Maya Lin" })).toBeNull();
    expect(buildMatchParams({ company: "Deloitte" })).toBeNull();
    const byName = buildMatchParams({ name: "Maya Lin", company: "Deloitte" });
    expect(byName?.get("name")).toBe("Maya Lin");
    expect(byName?.get("organization_name")).toBe("Deloitte");
    expect(byName?.get("reveal_personal_emails")).toBe("false");
    const byUrl = buildMatchParams({ linkedinUrl: "linkedin.com/in/maya", company: "Deloitte" });
    expect(byUrl?.get("linkedin_url")).toBe("https://www.linkedin.com/in/maya");
  });

  it("parses a match and drops locked or missing emails", () => {
    const person = {
      name: "Maya Lin",
      title: "AI Engineer",
      email: "maya@deloitte.com",
      email_status: "verified",
      linkedin_url: "http://www.linkedin.com/in/maya",
      match_confidence: "high",
      organization: { name: "Deloitte" },
    };
    expect(parseMatch({ person })).toEqual({
      name: "Maya Lin",
      title: "AI Engineer",
      company: "Deloitte",
      email: "maya@deloitte.com",
      emailStatus: "verified",
      linkedinUrl: "http://www.linkedin.com/in/maya",
      confidence: "high",
      source: "apollo",
    });
    expect(parseMatch({ person: { ...person, email: "email_not_unlocked@domain.com" } })?.email).toBe("");
    expect(parseMatch({ person: { ...person, email: null } })?.emailStatus).toBe("unavailable");
    expect(parseMatch({ person: { ...person, match_confidence: "none" } })).toBeNull();
    expect(parseMatch({ person: null })).toBeNull();
    expect(parseMatch(null)).toBeNull();
  });

  it("calls people/match with the key header and maps errors", async () => {
    vi.stubEnv("APOLLO_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ person: { name: "Maya Lin", email: "maya@co.com", email_status: "verified" } }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const contact = await matchContact({ linkedinUrl: "linkedin.com/in/maya" });
    expect(contact?.email).toBe("maya@co.com");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("api/v1/people/match?linkedin_url=");
    expect(init.method).toBe("POST");
    expect(init.headers["x-api-key"]).toBe("test-key");

    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await expect(matchContact({ linkedinUrl: "linkedin.com/in/maya" })).rejects.toThrow(/API key/);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(matchContact({ linkedinUrl: "linkedin.com/in/maya" })).rejects.toThrow(/rate limit/);
  });

  it("refuses without a key", async () => {
    vi.stubEnv("APOLLO_API_KEY", "");
    await expect(matchContact({ linkedinUrl: "linkedin.com/in/maya" })).rejects.toThrow(/APOLLO_API_KEY/);
  });
});
