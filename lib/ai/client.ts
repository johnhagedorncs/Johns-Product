import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

let client: OpenAI | null = null;

const DEFAULT_MODELS = { fast: "gpt-4o-mini", smart: "gpt-4o" } as const;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 });
  }
  return client;
}

export function resolveModel(tier: "fast" | "smart"): string {
  const fromEnv = tier === "fast" ? process.env.AI_MODEL_FAST : process.env.AI_MODEL_SMART;
  return fromEnv?.trim() || DEFAULT_MODELS[tier];
}

/** Only the key is required — model names fall back to sensible defaults. */
export function hasOpenAIConfig(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function parseStructuredResponse<T>(options: {
  modelTier: "fast" | "smart";
  input: string;
  schema: z.ZodType<T>;
  schemaName: string;
}): Promise<T> {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: resolveModel(options.modelTier),
    input: options.input,
    text: {
      format: zodTextFormat(options.schema, options.schemaName),
    },
  });

  if (!response.output_parsed) {
    throw new Error("Model returned no structured output");
  }

  return response.output_parsed as T;
}
