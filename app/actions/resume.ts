"use server";

import { textFromPdf, validatePdfUpload } from "@/lib/pdf-text";

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
