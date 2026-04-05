# Task: Render Summary as Formatted Markdown + PDF Download

**Date:** 2026-04-03
**Plan Reference:** PLAN_2026-04-03_meeting-processing-fixes.md

## What to change

Meeting summaries are stored as markdown text but currently render as plain text in the detail view. The download option produces a `.txt` file. We need to: (1) render the summary as formatted markdown in the detail view, (2) change the download to `.md`, and (3) add a PDF download option using the browser's print-to-PDF.

## Specific Instructions

### 1. Install dependencies

```bash
npm install react-markdown remark-gfm
```

### 2. Update meeting-detail.tsx

In `src/components/meetings/meeting-detail.tsx`:

- Import `ReactMarkdown` from `react-markdown` and `remarkGfm` from `remark-gfm`
- Find where the meeting summary is rendered (likely a `<pre>`, `<p>`, or plain text output)
- Replace it with:
  ```tsx
  <div className="prose prose-sm dark:prose-invert max-w-none">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{meeting.summary}</ReactMarkdown>
  </div>
  ```
- This will render headings, bullet lists, bold, links, tables (via GFM) properly
- The `prose-invert` class handles dark mode automatically
- If `@tailwindcss/typography` is not already installed, install it and add to the Tailwind config:
  ```bash
  npm install @tailwindcss/typography
  ```
  Then add `require('@tailwindcss/typography')` to the plugins array in the Tailwind/PostCSS config. Note: This project uses Tailwind CSS v4 -- check the actual config format (may use `@plugin` directive in CSS instead of JS config).

### 3. Update meeting-list.tsx download options

In `src/components/meetings/meeting-list.tsx`:

- Find the "Download Summary" menu item / button
- Change the label from "Download Summary (.txt)" to "Download Summary (.md)"
- Change the download filename from `*-summary.txt` to `*-summary.md`
- Change the content type from `text/plain` to `text/markdown`

- Add a new "Download Summary (.pdf)" menu item below the .md option:
  - On click, create a new browser window with the summary rendered as styled HTML:
    ```typescript
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${meeting.title} - Summary</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
          h1 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
          h2 { font-size: 1.25em; }
          h3 { font-size: 1.1em; }
          ul, ol { padding-left: 2em; }
          li { margin-bottom: 0.25em; }
          strong { font-weight: 600; }
          code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
          blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }
        </style>
      </head>
      <body>${markdownToHtml(meeting.summary)}</body>
      </html>
    `;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    ```
  - For the `markdownToHtml` conversion, create a simple utility function that converts basic markdown to HTML. This does NOT need to be comprehensive -- just handle:
    - `# heading` -> `<h1>`, `## heading` -> `<h2>`, `### heading` -> `<h3>`
    - `**bold**` -> `<strong>`
    - `- item` / `* item` -> `<ul><li>`
    - Numbered lists `1. item` -> `<ol><li>`
    - Blank lines -> paragraph breaks
    - `> quote` -> `<blockquote>`
  - Place this utility in `src/lib/utils.ts` or inline it in the component if it's small enough.
  - Alternatively, if `react-markdown` can be used with `react-dom/server`'s `renderToString`, that approach is cleaner but may have SSR/client boundary issues in Next.js. The simple regex approach is safer for a client component.

### 4. Write Vitest tests

Create `src/components/meetings/__tests__/meeting-detail.test.tsx` (or update existing):

- Test that when a meeting has a markdown summary, the rendered output contains proper HTML elements (h1/h2, ul/li, strong, etc.)
- Test that the `prose` and `dark:prose-invert` CSS classes are present on the wrapper

Create or update tests for meeting-list:

- Test that the download menu shows "Download Summary (.md)" label
- Test that the download menu shows "Download Summary (.pdf)" label
- Test the `markdownToHtml` utility function (if extracted) with basic markdown input

## Files likely affected

- `src/components/meetings/meeting-detail.tsx` (modify)
- `src/components/meetings/meeting-list.tsx` (modify)
- `src/lib/utils.ts` (modify -- add markdownToHtml if needed)
- `src/components/meetings/__tests__/meeting-detail.test.tsx` (new or modify)
- `package.json` (add react-markdown, remark-gfm, possibly @tailwindcss/typography)

## Acceptance criteria

- [ ] Summary renders with formatted headings, bullets, bold text in the detail view
- [ ] Dark mode works correctly (prose-invert applied)
- [ ] "Download Summary (.md)" downloads a valid markdown file with .md extension
- [ ] "Download Summary (.pdf)" opens the browser print dialog with formatted content
- [ ] Existing plain text summaries (without markdown) still render correctly
- [ ] No console errors or hydration mismatches
- [ ] All Vitest tests pass

## Notes

- This project uses Next.js 16 App Router. `react-markdown` is a client-side component, so make sure the component (or the part using ReactMarkdown) has `'use client'` directive.
- Tailwind CSS v4 uses a different config format than v3. The typography plugin may need to be added as `@plugin '@tailwindcss/typography'` in the CSS file rather than in a JS config. Check `postcss.config.mjs` and the main CSS file for the current setup.
- The PDF download uses `window.print()` which is browser-native and works on all modern browsers. The user selects "Save as PDF" from the print dialog. No need for heavy PDF libraries.

---

## Review Checklist — 2026-04-03 23:30

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-03_03-markdown-summary-pdf.md`

---

## Implementation Notes — 2026-04-03 23:35

- **Commit:** (pending — part of prompt-03 batch)
- **Tests:** 799/799 passing (81 test files)
- **Changes summary:**
  - `meeting-detail.tsx` already had ReactMarkdown rendering and PDF download from a prior prompt — no changes needed
  - Installed `@tailwindcss/typography` and added `@plugin "@tailwindcss/typography"` to `globals.css` for Tailwind v4 prose class support
  - Updated `meeting-list.tsx`: changed "Download Summary (.txt)" to "Download Summary (.md)" with `text/markdown` content type and `.md` extension
  - Added "Download Summary (.pdf)" dropdown item in `meeting-list.tsx` using `markdownToHtml` + `window.open` + `window.print()`
  - Added `markdownToHtml()` utility to `src/lib/utils.ts` — handles headings, bold, unordered/ordered lists, blockquotes, paragraphs
  - Created `src/components/meetings/__tests__/meeting-detail.test.tsx` (5 tests: prose classes, markdown rendering, plain text, null summary, PDF button)
  - Created `src/lib/__tests__/markdown-to-html.test.ts` (10 tests: headings, bold, lists, blockquotes, mixed content, empty input)
- **Deviations from plan:** `meeting-detail.tsx` already implemented ReactMarkdown + PDF — only `meeting-list.tsx` download changes and typography plugin were needed
- **Follow-up issues:** None
