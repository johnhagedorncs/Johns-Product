"use server";

import { textFromPdf, validatePdfUpload } from "@/lib/pdf-text";

export async function extractResumePdf(
  formData: FormData
): Promise<{ text: string }> {
  const file = formData.get("resume");
  if (!(file instanceof File)) {
    throw new Error("Choose a PDF resume.");
  }
  const invalid = validatePdfUpload({
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (invalid) throw new Error(invalid);
  const text = await textFromPdf(new Uint8Array(await file.arrayBuffer()));
  return { text };
}
