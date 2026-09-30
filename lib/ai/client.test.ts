import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

const parseMock = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { parse: parseMock };
  },
}));

describe("ai client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    parseMock.mockReset();
  });

  it("hasOpenAIConfig is false when env incomplete", async () => {
    const { hasOpenAIConfig } = await import("@/lib/ai/client");
    expect(hasOpenAIConfig()).toBe(false);
  });

  it("hasOpenAIConfig only needs the API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { hasOpenAIConfig } = await import("@/lib/ai/client");
    expect(hasOpenAIConfig()).toBe(true);
  });

  it("resolveModel returns fast and smart models", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("AI_MODEL_FAST", "fast-model");
    vi.stubEnv("AI_MODEL_SMART", "smart-model");
    const { resolveModel } = await import("@/lib/ai/client");
    expect(resolveModel("fast")).toBe("fast-model");
    expect(resolveModel("smart")).toBe("smart-model");
  });

  it("getOpenAIClient throws without API key", async () => {
    const { getOpenAIClient } = await import("@/lib/ai/client");
    expect(() => getOpenAIClient()).toThrow(/OPENAI_API_KEY/);
  });

  it("resolveModel falls back to default models when env is unset", async () => {
    vi.stubEnv("AI_MODEL_FAST", "");
    vi.stubEnv("AI_MODEL_SMART", "  ");
    const { resolveModel } = await import("@/lib/ai/client");
    expect(resolveModel("fast")).toBe("gpt-4o-mini");
    expect(resolveModel("smart")).toBe("gpt-4o");
  });

  it("getOpenAIClient reuses singleton", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { getOpenAIClient } = await import("@/lib/ai/client");
    expect(getOpenAIClient()).toBe(getOpenAIClient());
  });

  it("parseStructuredResponse throws without parsed output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("AI_MODEL_FAST", "fast-model");
    vi.stubEnv("AI_MODEL_SMART", "smart-model");
    parseMock.mockResolvedValue({ output_parsed: null });
    const { parseStructuredResponse } = await import("@/lib/ai/client");
    const schema = z.object({ ok: z.boolean() });
    await expect(
      parseStructuredResponse({
        modelTier: "fast",
        input: "x",
        schema,
        schemaName: "x",
      })
    ).rejects.toThrow(/structured output/);
  });

  it("parseStructuredResponse returns parsed output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("AI_MODEL_FAST", "fast-model");
    vi.stubEnv("AI_MODEL_SMART", "smart-model");
    const schema = z.object({ ok: z.boolean() });
    parseMock.mockResolvedValue({ output_parsed: { ok: true } });
    const { parseStructuredResponse } = await import("@/lib/ai/client");
    const result = await parseStructuredResponse({
      modelTier: "fast",
      input: "test",
      schema,
      schemaName: "test_schema",
    });
    expect(result).toEqual({ ok: true });
    expect(parseMock).toHaveBeenCalledOnce();
  });
});
