"use server";

import { hasOpenAIConfig } from "@/lib/ai/client";
import { readResumeTarget } from "@/lib/ai/resume-target";
import { textFromPdf, validatePdfUpload } from "@/lib/pdf-text";
import { guessTarget, type ResumeTarget } from "@/lib/target";

/** What jobs an uploaded resume should search for. AI when a key is set, keywords otherwise. */
export async function analyzeResume(resumeText: string): Promise<{ target: ResumeTarget | null }> {
  const text = typeof resumeText === "string" ? resumeText.slice(0, 20000) : "";
  if (!text.trim()) return { target: null };
  if (hasOpenAIConfig()) {
    try {
      const target = await readResumeTarget(text);
      if (target) return { target };
    } catch (err) {
      console.error(`[resume-target] failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { target: guessTarget(text) };
}

export async function extractResumePdf(
  formData: FormData
): Promise<{ text: string; error?: string }> {
  const file = formData.get("resume");
  if (!(file instanceof File)) return { text: "", error: "Choose a PDF resume." };
  const invalid = validatePdfUpload({ name: file.name, size: file.size, type: file.type });
  if (invalid) return { text: "", error: invalid };
  try {
    return { text: await textFromPdf(new Uint8Array(await file.arrayBuffer())) };
  } catch (err) {
    return {
      text: "",
      error: err instanceof Error ? err.message : "Could not read that PDF.",
    };
  }
}
