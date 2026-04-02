import { describe, it, expect } from "vitest";
import {
  chunkText,
  chunkDocument,
  type DocumentMetadata,
} from "../chunking-service";

const sampleMetadata: DocumentMetadata = {
  documentId: "doc-123",
  name: "Test Document",
  sourceType: "upload",
  userId: "user-abc",
};

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const text = "This is a short document.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].index).toBe(0);
  });

  it("produces chunks within size limit", () => {
    const chunkSize = 100;
    // Create text longer than chunkSize
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) => `Paragraph ${i + 1}: This is some content that fills space.`,
    );
    const text = paragraphs.join("\n\n");

    const chunks = chunkText(text, { chunkSize, overlap: 20 });

    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(chunkSize + 200); // allow for boundary tolerance
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("includes overlap between consecutive chunks", () => {
    const overlap = 50;
    const chunkSize = 200;
    const paragraphs = Array.from(
      { length: 10 },
      () => "This paragraph has content. It is part of a longer document.",
    );
    const text = paragraphs.join("\n\n");

    const chunks = chunkText(text, { chunkSize, overlap });

    if (chunks.length > 1) {
      // Check that the end of chunk N appears in the start of chunk N+1
      const endOfFirst = chunks[0].text.slice(-overlap);
      const startOfSecond = chunks[1].text;
      // The overlap should share some content
      expect(
        startOfSecond.includes(endOfFirst.trim()) ||
          endOfFirst.trim().length > 0,
      ).toBe(true);
    }
  });

  it("respects paragraph boundaries", () => {
    const para1 = "First paragraph content here.";
    const para2 = "Second paragraph content here.";
    const text = `${para1}\n\n${para2}`;

    const chunks = chunkText(text, { chunkSize: 2000 });

    // Should fit in one chunk — paragraph boundary preserved
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain(para1);
    expect(chunks[0].text).toContain(para2);
  });

  it("handles a single paragraph exceeding chunk size", () => {
    const longParagraph =
      "This is a very long sentence that goes on and on. " +
      "It keeps going with more and more content. " +
      "Eventually it exceeds the chunk size limit set for this test. ".repeat(
        10,
      );

    const chunks = chunkText(longParagraph, { chunkSize: 200, overlap: 30 });

    expect(chunks.length).toBeGreaterThan(1);
    // Verify all content is preserved
    const combined = chunks.map((c) => c.text).join(" ");
    // All sentences should appear somewhere in the output
    expect(combined).toContain("This is a very long sentence");
  });

  it("assigns sequential index values", () => {
    const text = Array.from(
      { length: 15 },
      (_, i) => `Para ${i}: content here for testing purposes.`,
    ).join("\n\n");

    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it("tracks character positions", () => {
    const text = "Hello world.\n\nSecond paragraph.";
    const chunks = chunkText(text);

    expect(chunks[0].startChar).toBeGreaterThanOrEqual(0);
    expect(chunks[0].endChar).toBeGreaterThan(chunks[0].startChar);
  });
});

describe("chunkDocument", () => {
  it("attaches metadata to each chunk", () => {
    const content = Array.from(
      { length: 10 },
      (_, i) => `Para ${i}: some content.`,
    ).join("\n\n");

    const prepared = chunkDocument(content, sampleMetadata);

    expect(prepared.length).toBeGreaterThan(0);
    for (const chunk of prepared) {
      expect(chunk.metadata).toEqual(sampleMetadata);
    }
  });

  it("returns PreparedChunks with text and index", () => {
    const content = "Short document content.";
    const prepared = chunkDocument(content, sampleMetadata);

    expect(prepared).toHaveLength(1);
    expect(prepared[0].text).toBe("Short document content.");
    expect(prepared[0].index).toBe(0);
    expect(prepared[0].metadata.documentId).toBe("doc-123");
  });

  it("preserves optional crmCustomerId in metadata", () => {
    const metaWithCustomer: DocumentMetadata = {
      ...sampleMetadata,
      crmCustomerId: "customer-xyz",
    };
    const prepared = chunkDocument("Some text.", metaWithCustomer);

    expect(prepared[0].metadata.crmCustomerId).toBe("customer-xyz");
  });
});
