import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../utils";

describe("markdownToHtml", () => {
  it("converts headings", () => {
    expect(markdownToHtml("# Title")).toBe("<h1>Title</h1>");
    expect(markdownToHtml("## Section")).toBe("<h2>Section</h2>");
    expect(markdownToHtml("### Subsection")).toBe("<h3>Subsection</h3>");
  });

  it("converts bold text", () => {
    expect(markdownToHtml("This is **bold** text")).toBe(
      "<p>This is <strong>bold</strong> text</p>",
    );
  });

  it("converts unordered lists", () => {
    const md = "- Item one\n- Item two\n- Item three";
    const result = markdownToHtml(md);
    expect(result).toBe(
      "<ul><li>Item one</li><li>Item two</li><li>Item three</li></ul>",
    );
  });

  it("converts ordered lists", () => {
    const md = "1. First\n2. Second\n3. Third";
    const result = markdownToHtml(md);
    expect(result).toBe("<ol><li>First</li><li>Second</li><li>Third</li></ol>");
  });

  it("converts blockquotes", () => {
    expect(markdownToHtml("> A quote")).toBe(
      "<blockquote>A quote</blockquote>",
    );
  });

  it("handles bold inside list items", () => {
    const md = "- **Key point** details here";
    const result = markdownToHtml(md);
    expect(result).toBe(
      "<ul><li><strong>Key point</strong> details here</li></ul>",
    );
  });

  it("closes lists before headings", () => {
    const md = "- Item\n\n## Next Section";
    const result = markdownToHtml(md);
    expect(result).toBe("<ul><li>Item</li></ul><h2>Next Section</h2>");
  });

  it("handles mixed content", () => {
    const md =
      "## Summary\n\n- Point one\n- Point two\n\nSome paragraph.\n\n### Details\n\n1. Step one\n2. Step two";
    const result = markdownToHtml(md);
    expect(result).toContain("<h2>Summary</h2>");
    expect(result).toContain("<ul><li>Point one</li><li>Point two</li></ul>");
    expect(result).toContain("<p>Some paragraph.</p>");
    expect(result).toContain("<h3>Details</h3>");
    expect(result).toContain("<ol><li>Step one</li><li>Step two</li></ol>");
  });

  it("handles empty input", () => {
    expect(markdownToHtml("")).toBe("");
  });

  it("handles asterisk-style unordered lists", () => {
    const md = "* Item one\n* Item two";
    const result = markdownToHtml(md);
    expect(result).toBe("<ul><li>Item one</li><li>Item two</li></ul>");
  });
});
