# Per-Slide Prompts for PowerPoint Claude
**File:** `lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx`
**Date:** 8 April 2026

Each section below is a self-contained prompt. Paste one at a time into PowerPoint Claude, wait for it to finish, then move to the next. Each prompt names the target slide and restates only the context PowerPoint Claude needs — don't rely on it remembering anything between prompts.

---

## ⚠️ READ FIRST — Structural mismatch between agenda and deck

Before fixing eyebrows, decide how to resolve this. The **agenda on slide 2 lists 9 sections** but the deck actually contains **more content sections than that**. Specifically:

- Agenda has: 01 Problem Statement · 02 Meet the Teams · 03 Conscia Platform Overview · 04 Proposed Architecture Fit · 05 Success Metrics and KPIs · 06 Early Findings from Your Data · 07 Ways of Working · 08 Open Questions · 09 Agreed Next Steps
- Deck actually contains: Problem (s3–4), Meet the Teams (s5), Conscia Platform (s6), Proposed Architecture (s7), End-to-End Architecture (s8), Collections/Hierarchies/Taxonomies (s9–10), Early Findings (s11), Project Scope (s12), Implementation Timeline (s13), Success Metrics (s14), Ways of Working (s15), Open Questions (s16), Next Steps (s17)

The agenda is missing: End-to-End Architecture, Collections/Hierarchies/Taxonomies, Project Scope, Implementation Timeline. Success Metrics is also out of order (agenda lists it at 05, deck has it at s14).

**The prompt for slide 2 below rewrites the agenda to match the deck.** If you'd rather go the other way (cut/combine deck slides to fit the current 9-item agenda), tell me and I'll redo the eyebrow prompts to match.

The eyebrow section numbering I've used in every content-slide prompt below assumes **this revised 9-item agenda**:

| # | Section | Colour | Slides |
|---|---|---|---|
| 01 | Problem Statement | magenta `#E6007A` | 3, 4 |
| 02 | Meet the Teams | cyan `#22B8CF` | 5 |
| 03 | Conscia Platform Overview | green `#8BC53F` | 6 |
| 04 | Proposed Architecture | blue `#3B7CC4` | 7, 8 |
| 05 | Data Model Deep-Dive | orange `#F39200` | 9, 10 |
| 06 | Early Findings from Your Data | yellow `#F5B82E` | 11 |
| 07 | Scope & Timeline | magenta `#E6007A` | 12, 13 |
| 08 | Success Metrics & Ways of Working | cyan `#22B8CF` | 14, 15 |
| 09 | Open Questions & Next Steps | green `#8BC53F` | 16, 17 |

(These are the nine agenda colours already used on slide 2 — the eyebrow on each content slide should reuse the agenda row's colour exactly.)

---

## Global eyebrow style (reference for every content-slide prompt)

Every eyebrow should match the **exact same pill style** as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1:

- Rounded rectangle, ~28–32 px tall, solid fill in the section's agenda colour
- White uppercase text, letter-spaced (tracking ~100), ~11–12 pt, semibold
- Positioned top-left of the content area, aligned with the left edge of the slide title, sitting **above** the title with ~16 px gap
- Format: `NN · SECTION NAME` (e.g. `01 · PROBLEM STATEMENT`)
- The title below it stays in its current position and style — do NOT move or restyle the title

---

# SLIDE-BY-SLIDE PROMPTS

---

## Slide 2 — Today's Agenda (restructure)

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 2 ("Today's Agenda").

Rewrite the 9-row agenda list so it matches the actual sections in the deck, keeping the existing visual style (numbered rows, coloured left accent bar per row, bold section name followed by em-dash and a short description). Use exactly these 9 rows in this order, with the existing colour palette (row 1 magenta, row 2 cyan, row 3 green, row 4 blue, row 5 orange, row 6 yellow, row 7 magenta, row 8 cyan, row 9 green):

01 · Problem Statement — Recap of the challenges we're here to solve
02 · Meet the Teams — Introductions and roles
03 · Conscia Platform Overview — How DX Graph and DX Engine address Lovesac's needs
04 · Proposed Architecture — Where Conscia sits within your existing stack
05 · Data Model Deep-Dive — Collections, hierarchies, taxonomies and relationships
06 · Early Findings from Your Data — Initial analysis from the pre-kickoff review
07 · Scope & Timeline — Phase 1 scope and implementation plan
08 · Success Metrics & Ways of Working — How we'll measure success and run the project
09 · Open Questions & Next Steps — Items to resolve and agreed actions

Keep the slide title "Today's Agenda", the footer, and the gradient bar exactly as they are. Save the file.
```

---

## Slide 3 — Problem Statement: The Bottleneck

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 3 ("Problem Statement - The Bottleneck").

Make three changes:

1. ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): magenta fill (#E6007A), white uppercase letter-spaced text "01 · PROBLEM STATEMENT", ~11pt semibold, rounded corners, ~16 px above the title and left-aligned with the title. Do not move the title.

2. FIND AND REPLACE the text "Magento" with "Adobe Commerce" on this slide (it appears in the product catalogue box on the left).

3. FIND AND REPLACE the text "Salesforce POS" with "Salesforce Retail Cloud" on this slide (it appears in the channels column on the right).

Also change the title punctuation from "Problem Statement - The Bottleneck" to "Problem Statement — The Bottleneck" (en/em-dash with spaces, to match the rest of the deck).

Save the file.
```

---

## Slide 4 — Problem Statement: What Lovesac Can't Do Today

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 4 ("Problem Statement - What Lovesac Can't Do Today").

Make two changes:

1. ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): magenta fill (#E6007A), white uppercase letter-spaced text "01 · PROBLEM STATEMENT", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not move the title.

2. CHANGE THE TITLE from "Problem Statement - What Lovesac Can't Do Today" to "Problem Statement — What Lovesac Can't Do Today" (replace the hyphen-space-hyphen with a proper em-dash, to match the rest of the deck).

Save the file.
```

---

## Slide 5 — Meet the Teams

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 5 ("Meet the Teams").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): cyan fill (#22B8CF), white uppercase letter-spaced text "02 · MEET THE TEAMS", ~11pt semibold, rounded corners. Position it ~16 px above the title, left-aligned with the title. Do not move the title or change anything else on the slide.

Save the file.
```

---

## Slide 6 — Conscia Platform Overview

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 6 ("Conscia Platform Overview").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): green fill (#8BC53F), white uppercase letter-spaced text "03 · CONSCIA PLATFORM OVERVIEW", ~11pt semibold, rounded corners. Position it ~16 px above the title, left-aligned with the title. Do not move the title or touch the three-column content.

Save the file.
```

---

## Slide 7 — Proposed Architecture Fit

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 7 ("Proposed Architecture Fit").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): blue fill (#3B7CC4), white uppercase letter-spaced text "04 · PROPOSED ARCHITECTURE", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not move the title or touch the two-column content.

Save the file.
```

---

## Slide 8 — End-to-End Architecture

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 8 ("End-to-End Architecture").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): blue fill (#3B7CC4), white uppercase letter-spaced text "04 · PROPOSED ARCHITECTURE", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not move the title or touch the architecture diagram.

Save the file.
```

---

## Slide 9 — Collections, Hierarchies, Taxonomies (Part 1)

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 9 ("Collections, Hierarchies, Taxonomies").

Make two changes:

1. ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): orange fill (#F39200), white uppercase letter-spaced text "05 · DATA MODEL DEEP-DIVE", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title.

2. UPDATE THE SUBTITLE (the line under the title, currently "How DX Graph models Lovesac's configurable catalogue") to end with " — Part 1: The Model" so viewers can distinguish this slide from slide 10, which has the same title. Keep the same font and colour.

Do not touch the diagram, the four side panels, or the taxonomies box.

Save the file.
```

---

## Slide 10 — Collections, Hierarchies, Taxonomies (Part 2)

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 10 ("Collections, Hierarchies, Taxonomies").

Make two changes:

1. ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): orange fill (#F39200), white uppercase letter-spaced text "05 · DATA MODEL DEEP-DIVE", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title.

2. UPDATE THE SUBTITLE (currently "Demo of compatibility rules and data model in a sample hierarchy using Lovesac's data and Conscia's tooling") to end with " — Part 2: Live in Conscia" so this slide is distinct from slide 9. Keep the same font and colour.

Do not touch the screenshot or the DEMO panel.

Save the file.
```

---

## Slide 11 — Early Findings from Your Data

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 11 ("Early Findings from Your Data").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): yellow fill (#F5B82E), white uppercase letter-spaced text "06 · EARLY FINDINGS", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not move the title or touch the stat panel or the three finding cards.

Save the file.
```

---

## Slide 12 — Project Scope — Phase 1

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 12 ("Project Scope — Phase 1").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): magenta fill (#E6007A), white uppercase letter-spaced text "07 · SCOPE & TIMELINE", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not touch the three scope columns.

Save the file.
```

---

## Slide 13 — Implementation Timeline

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 13 ("Implementation Timeline").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): magenta fill (#E6007A), white uppercase letter-spaced text "07 · SCOPE & TIMELINE", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not touch the four phase columns or the dependency footer row.

Save the file.
```

---

## Slide 14 — Success Metrics & KPIs

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 14 ("Success Metrics & KPIs").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): cyan fill (#22B8CF), white uppercase letter-spaced text "08 · SUCCESS METRICS & WAYS OF WORKING", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not move the title or touch the three column cards.

Save the file.
```

---

## Slide 15 — Ways of Working

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 15 ("Ways of Working").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): cyan fill (#22B8CF), white uppercase letter-spaced text "08 · SUCCESS METRICS & WAYS OF WORKING", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not touch the team structure table or the cadence panel.

Save the file.
```

---

## Slide 16 — Open Questions

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 16 ("Open Questions").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): green fill (#8BC53F), white uppercase letter-spaced text "09 · OPEN QUESTIONS & NEXT STEPS", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not touch the five category cards or the footer reference to the questions document.

Save the file.
```

---

## Slide 17 — Next Steps

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 17 ("Next Steps").

ADD AN EYEBROW. Insert a rounded-rectangle pill above the slide title (same style as the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1): green fill (#8BC53F), white uppercase letter-spaced text "09 · OPEN QUESTIONS & NEXT STEPS", ~11pt semibold. Position it ~16 px above the title, left-aligned with the title. Do not touch the action list.

Save the file.
```

---

## Slide 18 — Appendix Section Divider

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 18 (the Appendix divider — big "APPENDIX" wordmark, pink pill above it currently reading "SECTION 02").

Change the pill text from "SECTION 02" to "APPENDIX" and make sure the pill matches the exact style of the "PROJECT KICK-OFF · APRIL 8, 2026" pill on slide 1: same magenta fill (#E6007A), same corner radius, same white uppercase letter-spaced text (~11pt semibold), same padding. Centre it horizontally on the slide above the big "APPENDIX" wordmark as it is today.

Leave the big "APPENDIX" wordmark, the subtitle "Reference material — Threekit & Conscia comparison and phased role transition.", the gradient bar, and the background decoration unchanged.

Save the file.
```

---

## Slide 19 — Threekit & Conscia: Different Jobs, Different Tools

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 19 ("Threekit & Conscia: Different Jobs, Different Tools").

No content changes — but confirm the top-right "APPENDIX" tag matches the same muted grey pill style used on slides 20 and 21 (same fill, same text size, same rounded corners, same position). If it doesn't, make it match. Do not touch the comparison table.

Save the file.
```

---

## Slide 20 — Celigo and Conscia: Complementary Layers

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 20 ("Celigo and Conscia: Complementary Layers").

FIND AND REPLACE the text "NetSuite ↔ Magento ↔ MAO ↔ Salesforce plumbing" in the "Where it shines" row of the Celigo column with "NetSuite ↔ Adobe Commerce ↔ MAO ↔ Salesforce plumbing".

Leave everything else on the slide exactly as it is.

Save the file.
```

---

## Slide 21 — How Conscia Integrates with Celigo

```
Open lovesac-kickoff-v1_8-Shared with Conscia 8Apr2026.pptx and go to slide 21 ("How Conscia Integrates with Celigo").

In the data flow diagram at the bottom of the slide, change the yellow box currently labelled "Magento / Adobe Commerce" to just "Adobe Commerce". Keep the same fill, border, font, position, and alignment with the other two downstream boxes (Salesforce Retail Cloud, Manhattan Active Omni).

Do not touch the three top panels (A. INGEST, B. READ PATH, C. BOM HANDOFF) or the rest of the diagram.

Save the file.
```

---

# Prompts that are NOT needed

- **Slide 1 (title)** — already correct. No changes.

---

# Suggested running order

1. Start with **Slide 2** (agenda restructure) so the section names and numbers are locked in before you stamp them onto every content slide.
2. Then run **Slide 3 and 4** together (both section 01, and slide 3 also has the Magento/Salesforce POS text fixes).
3. Then work slides **5 → 17** in order.
4. Finish with the appendix fixes on **18, 19, 20, 21**.

If PowerPoint Claude reports that a pill or text box already exists on a slide, tell it to delete the existing one and redo it to the spec in the prompt — occasionally it will have added a partial eyebrow and then stopped.
