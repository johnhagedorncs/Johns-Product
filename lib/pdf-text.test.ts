import { beforeEach, describe, expect, it, vi } from "vitest";
import { textFromPdf, validatePdfUpload } from "@/lib/pdf-text";

const extractText = vi.fn();

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(async () => ({})),
  extractText: (...args: unknown[]) => extractText(...args),
}));

describe("pdf resume", () => {
  beforeEach(() => {
    extractText.mockReset();
  });

  it("rejects a file that is not a readable pdf", () => {
    expect(
      validatePdfUpload({ name: "notes.txt", size: 10, type: "text/plain" })
    ).toMatch(/PDF/);
    expect(
      validatePdfUpload({ name: "resume.pdf", size: 0, type: "application/pdf" })
    ).toMatch(/empty/);
    expect(
      validatePdfUpload({
        name: "resume.pdf",
        size: 5_000_001,
        type: "application/pdf",
      })
    ).toMatch(/5 MB/);
    expect(
      validatePdfUpload({
        name: "resume.pdf",
        size: 1200,
        type: "application/pdf",
      })
    ).toBeNull();
    expect(
      validatePdfUpload({ name: "resume.PDF", size: 10, type: "" })
    ).toBeNull();
  });

  it("joins page text and rejects a blank document", async () => {
    await expect(textFromPdf(new Uint8Array())).rejects.toThrow(/empty/);
    extractText.mockResolvedValueOnce({ text: ["Hello", "resume"] });
    await expect(textFromPdf(new Uint8Array([1]))).resolves.toBe("Hello\nresume");
    extractText.mockResolvedValueOnce({ text: "   " });
    await expect(textFromPdf(new Uint8Array([1]))).rejects.toThrow(/readable/);
    extractText.mockResolvedValueOnce({ text: "Built APIs\n\n\n\nShipped" });
    await expect(textFromPdf(new Uint8Array([1]))).resolves.toContain("Shipped");
    extractText.mockResolvedValueOnce({ text: undefined });
    await expect(textFromPdf(new Uint8Array([1]))).rejects.toThrow(/readable/);
    extractText.mockResolvedValueOnce({ text: "a".repeat(20001) });
    await expect(textFromPdf(new Uint8Array([1]))).resolves.toHaveLength(20000);
  });
});
