const MAX_PDF_BYTES = 5_000_000;

export function validatePdfUpload(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  const pdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!pdf) return "Upload a PDF resume.";
  if (file.size <= 0) return "That PDF is empty.";
  if (file.size > MAX_PDF_BYTES) return "PDF must be under 5 MB.";
  return null;
}

export async function textFromPdf(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength === 0) throw new Error("That PDF is empty.");
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: true });
  const raw = extracted.text;
  const joined = Array.isArray(raw) ? raw.join("\n") : String(raw ?? "");
  const text = joined.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("No readable text in that PDF.");
  return text.slice(0, 20000);
}
