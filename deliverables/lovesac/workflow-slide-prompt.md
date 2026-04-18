# Prompt: "End-to-End Product Data Workflow" slide

Paste everything below the line into a fresh Claude session with the pptx skill available.

---

Build a single-slide editable `.pptx` for the Lovesac × Conscia PIM Project Kick-off (15 April 2026). This slide supersedes the existing "architecture" diagram with a **workflow view** — it shows who does what and when, not just which systems exist. Use `pptxgenjs` (LAYOUT_WIDE, 13.333" × 7.5"). Save to `Workflow-slide-v1.pptx`.

## Context (do not put this on the slide — it's for your understanding)

Lovesac has product data scattered across spreadsheets, NetSuite (ERP), Threekit (3D configurator), Adobe Commerce (acts as de-facto PIM today), and a handful of downstream channels. Conscia is being introduced as the **real PIM**: a semantic foundation (DX Graph) plus an orchestration engine plus experience APIs (REST + MCP/UCP/ACP).

Today the flow is: Eric (Product Team) prepares data in spreadsheets → NetSuite → pass-through to Adobe Commerce and Salesforce Retail Cloud → Threekit rules live only inside Adobe Commerce → compatibility intelligence never reaches retail, OMS, search, or agents.

The target workflow this slide depicts is: **spreadsheet/UI input → Conscia validation & enrichment → NetSuite (ERP) → Conscia orchestration → all channels**, with back-feeds and validation checkpoints throughout.

## Title block

- Magenta pill (top-left, ~3" wide, rounded): `02  ·  WORKFLOW` in white Calibri 11pt bold, letter-spaced.
- Title directly below: **"End-to-End Product Data Workflow"** in Georgia 40pt bold, navy `#1A1D3A`.
- Subtitle in italic Calibri 14pt, muted navy `#4A4E6A`: *"Who does what, when — from data entry to every channel."*

## Stages (left-to-right columns)

Draw five vertical "swim-lane" stages, each a rounded-rectangle container with a stage number pill at the top (small, magenta-filled circle with white number). Each stage is ~2.4" wide with a 0.2" gap. Inside each stage, stack 1–3 labelled shapes representing the system/action. Use title case for system names, italic magenta `#D91B5B` for role labels underneath.

**Stage 1 — INPUT**
- *Product Team (Eric)* — "Spreadsheet template" card
- *Product Team (Eric)* — "Conscia DX Graph UI (future)" card (dashed border = not live yet)

**Stage 2 — MASTER DATA**
- *System of record* — "NetSuite ERP" card: SKUs · pricing · inventory
- *Pass-through* — "Saligo" card (small, subdued — they're a light-touch integrator in the middle)

**Stage 3 — VALIDATION & ENRICHMENT**  (this is the hero column — give it slightly more visual weight and a light magenta tint)
- "Conscia DX Graph" card: *semantic foundation · hierarchies · compatibility rules*
- "Orchestration Engine" card: *real-time config validation · context-aware responses*
- "Experience APIs" card: *REST · MCP · UCP · ACP*

**Stage 4 — DISTRIBUTION**
- Five channel cards stacked:
  - Lovesac.com
  - Salesforce Retail Cloud (stores)
  - Manhattan Active Omni (OMS)
  - Google Shopping (feed)
  - AgentForce / ChatGPT (agentic commerce)

**Stage 5 — CUSTOMER**
- "Customer configures product" card, with a tiny illustration or icon (sofa/chair)
- "Valid order → fulfilment" card, small arrow looping back to Stage 2 (order data to NetSuite)

## Arrows

- **Forward flow (primary path):** solid magenta `#C8206D`, 2.25pt, triangle arrowheads. Connect the main card of each stage to the next.
- **Back-feed from NetSuite → Conscia:** dashed green `#10B981`, 1.5pt, labelled *"delta feed (every 15 min)"* in small italic green.
- **Back-feed from orders/events → Conscia:** dashed blue-grey `#64748B`, 1.5pt, labelled *"order events"*.
- **Validation loop inside Stage 3:** a small circular arrow between DX Graph and Orchestration Engine, labelled *"validate"*.

## Validation checkpoints

Between each stage boundary, place a small circular badge (0.35" diameter, white fill with magenta outline, magenta checkmark ✓ inside). Under each badge, a one-line caption in 9pt italic:

- Between Stage 1 → 2: *"schema + hierarchy check"*
- Between Stage 2 → 3: *"SKU reconciliation"*
- Between Stage 3 → 4: *"config validation · preview environment"*
- Between Stage 4 → 5: *"agent/channel response test"*

## Sidebar callout (bottom-right, ~2.5" wide)

Amber-tinted rounded rectangle (`#FEF3C7` fill, `#D97706` border), with a warning dot. Text:

> **Phased migration:** Phase 1 keeps SKU origination in NetSuite. Phase 2/3 evaluate moving creation into the DX Graph itself.

## Legend (bottom, compact single row)

Three small swatches with labels:
- Solid magenta line — *Forward flow*
- Dashed green line — *Back-feed*
- White circle with ✓ — *Validation checkpoint*

## Footer & accents

- Footer centred: `"Lovesac × Conscia  ·  Project Kick-off  ·  April 15, 2026"` in Calibri 9.5pt italic, muted grey.
- Left edge: 0.08"-wide vertical magenta accent bar full height.
- Bottom edge: 0.08"-tall rainbow gradient bar (magenta → terracotta → amber → green → teal), built from ~60 thin adjacent rectangles since pptxgenjs has no native gradient.

## Palette (use exactly these — no "#" prefix)

- `C8206D` magenta (primary brand)
- `D91B5B` accent pink
- `1A1D3A` navy (titles, ink)
- `4A4E6A` muted navy (body)
- `1E2761` card label text
- `EEF0FB` card fill (data sources)
- `C9CFE8` card stroke
- `10B981` green (flowing / back-feed)
- `D97706` amber (warnings)
- `FEF3C7` amber light (warning fill)
- `9AA0A6` whisper grey (column labels, footer)

## Typography

- Title: Georgia 40pt bold
- Subtitle: Calibri 14pt italic
- Stage headers: Calibri 11pt bold, letter-spaced, in `#9AA0A6`
- Card titles: Calibri 13–14pt bold, in `#1E2761`
- Card subtitles: Calibri 10–11pt italic, in `#D91B5B`
- Body/captions: Calibri 9.5–11pt, in `#4A4E6A`

## QA before declaring done

1. Render to PDF with `soffice --headless --convert-to pdf`, then to JPG with `pdftoppm -r 150`.
2. Visually inspect the image. Look specifically for: text overflow, arrows that don't actually touch the shapes they connect, checkpoint badges overlapping lines or stage boundaries, the amber sidebar callout bumping into channel cards, the "02 · WORKFLOW" pill wrapping to two lines.
3. Confirm the green back-feed line from NetSuite → Conscia DX Graph is visible and labelled.
4. Confirm Phase-1/Phase-2 amber callout reads cleanly.

Fix any issues, re-render, and confirm clean on a second pass before handing over the file.
