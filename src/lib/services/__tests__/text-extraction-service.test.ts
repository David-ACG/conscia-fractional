import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pdf-parse
vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

// Mock mammoth
vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

describe("text-extraction-service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function getModule() {
    return await import("../text-extraction-service");
  }

  it("extracts text from plain text buffer", async () => {
    const { extractText } = await getModule();
    const buffer = Buffer.from("Hello world", "utf-8");
    const result = await extractText(buffer, "text/plain");
    expect(result).toBe("Hello world");
  });

  it("extracts text from markdown buffer", async () => {
    const { extractText } = await getModule();
    const buffer = Buffer.from("# Heading\n\nSome text", "utf-8");
    const result = await extractText(buffer, "text/markdown");
    expect(result).toBe("# Heading\n\nSome text");
  });

  it("extracts text from CSV buffer", async () => {
    const { extractText } = await getModule();
    const buffer = Buffer.from("col1,col2\nval1,val2", "utf-8");
    const result = await extractText(buffer, "text/csv");
    expect(result).toBe("col1,col2\nval1,val2");
  });

  it("extracts text from JSON buffer", async () => {
    const { extractText } = await getModule();
    const buffer = Buffer.from('{"key":"value"}', "utf-8");
    const result = await extractText(buffer, "application/json");
    expect(result).toBe('{"key":"value"}');
  });

  it("extracts text from PDF buffer using pdf-parse", async () => {
    const pdfParse = (await import("pdf-parse")).default as ReturnType<
      typeof vi.fn
    >;
    pdfParse.mockResolvedValue({ text: "Extracted PDF content" });

    const { extractText } = await getModule();
    const buffer = Buffer.from("%PDF-1.4 fake", "utf-8");
    const result = await extractText(buffer, "application/pdf");
    expect(result).toBe("Extracted PDF content");
    expect(pdfParse).toHaveBeenCalledWith(buffer);
  });

  it("extracts text from DOCX buffer using mammoth", async () => {
    const mammoth = (await import("mammoth")).default as {
      extractRawText: ReturnType<typeof vi.fn>;
    };
    mammoth.extractRawText.mockResolvedValue({
      value: "Extracted DOCX content",
    });

    const { extractText } = await getModule();
    const buffer = Buffer.from("PK fake docx", "utf-8");
    const result = await extractText(
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result).toBe("Extracted DOCX content");
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
  });

  it("throws error for unsupported MIME types", async () => {
    const { extractText } = await getModule();
    const buffer = Buffer.from("binary", "utf-8");
    await expect(
      extractText(buffer, "application/octet-stream"),
    ).rejects.toThrow("Unsupported file type: application/octet-stream");
  });

  it("getSupportedMimeTypes returns correct list", async () => {
    const { getSupportedMimeTypes } = await getModule();
    const types = getSupportedMimeTypes();
    expect(types).toContain("application/pdf");
    expect(types).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(types).toContain("text/plain");
    expect(types).toContain("text/markdown");
    expect(types).toContain("text/csv");
    expect(types).toContain("application/json");
  });
});
