---
name: excalidraw-diagram
description: Generate hand-drawn Excalidraw diagrams for GWTH lessons. Produces .excalidraw JSON files rendered to PNG via Playwright. Use when a lesson needs a concept diagram, flowchart, mind map, comparison grid, or architecture visualization.
argument-hint: [diagram_description] [lesson_folder_path]
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Excalidraw Diagram Generator for GWTH Lessons

Generate `.excalidraw` JSON files with the hand-drawn aesthetic, then render to PNG using Playwright.

## Input

Arguments: `$ARGUMENTS`

Expected format: `"Diagram description" path/to/lesson/folder`
Or: `"Diagram description"` (saves to current directory)

## Core Principle: The Isomorphism Test

> "If you removed all text, would the structure alone communicate the concept?"

Each visual pattern must mirror the concept's actual behavior. Fan-outs for one-to-many, timelines for sequences, convergence for aggregation.

## Step 1: Assess Diagram Depth

**Simple/Conceptual** — Abstract shapes for mental models, philosophies:

- Mind maps, hub-and-spoke, comparison grids
- Roughness: 1 (hand-drawn), pastel fills
- No code snippets or technical details

**Comprehensive/Technical** — Concrete architecture, data flows:

- System diagrams, pipeline visualizations
- May include labeled data formats or API names
- Still hand-drawn aesthetic, but with more detail

GWTH Month 1 lessons are always Simple. Month 2-3 may be Technical.

## Step 2: Choose Visual Pattern

| Pattern             | Use When                           | Layout                                        |
| ------------------- | ---------------------------------- | --------------------------------------------- |
| **Hub & Spoke**     | Central concept with related ideas | Central circle + radial arrows                |
| **Mind Map**        | Exploring subtopics hierarchically | Central node + branching tree                 |
| **Flowchart**       | Process or workflow steps          | Top-to-bottom or left-to-right boxes + arrows |
| **Comparison Grid** | 2x2 matrix, pros/cons              | Four quadrants with axis labels               |
| **Timeline**        | Sequential steps, learning path    | Horizontal line + dots + labels               |
| **Assembly Line**   | Input → Process → Output           | Left-to-right pipeline                        |
| **Side-by-Side**    | Before/after, options comparison   | Parallel vertical columns                     |
| **Convergence**     | Many inputs → single output        | Multiple sources funneling in                 |
| **Fan-Out**         | One source → many outputs          | Single source branching out                   |

Use **different patterns** for different diagrams in the same lesson. Avoid uniform grids.

## Step 3: Generate Excalidraw JSON

### File Structure

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20
  },
  "files": {}
}
```

### GWTH Color Palette (Pastel Educational)

**Fills** (use these for shape backgrounds):
| Color | Hex | Use For |
|-------|-----|---------|
| Blue | `#a5d8ff` | Primary concepts, main boxes |
| Green | `#b2f2bb` | Success, positive outcomes, start nodes |
| Pink | `#ffc9c9` | Warnings, risks, challenges |
| Yellow | `#ffec99` | Decisions, highlights, key points |
| Purple | `#d0bfff` | AI/tech concepts, advanced topics |
| Orange | `#ffd8a8` | Actions, triggers, calls to action |
| Cyan | `#99e9f2` | Data, information, context |
| Grey | `#e9ecef` | Neutral, background, disabled |

**Strokes**: Always `#1e1e1e` (near-black) for hand-drawn look.
**Text**: `#1e1e1e` for all text on pastel fills.

### Style Settings (MANDATORY)

Every element MUST use:

- `"roughness": 1` — hand-drawn wobbly lines
- `"strokeWidth": 2` — visible borders
- `"fontFamily": 1` — Virgil (hand-written font)
- `"opacity": 100` — fully opaque
- `"fillStyle": "solid"` — solid pastel fills

### Element ID Convention

Use descriptive IDs with section namespacing:

- Section 1: `s1_title`, `s1_box_ai`, `s1_arrow_to_output`
- Section 2: `s2_header`, `s2_circle_data`, `s2_line_connect`

Every element MUST have a unique `id`. Use format: `{section}_{type}_{name}`.
Every element MUST have `"seed"` (any integer) and `"version": 1`, `"versionNonce"` (any integer).

### Building Large Diagrams

**Build section-by-section, NOT all at once:**

1. Create base file with wrapper and title section
2. Add one section per edit — take time with layout and spacing
3. Use descriptive IDs for cross-section references
4. Namespace seeds by section (section 1: 100xxx, section 2: 200xxx)

**NEVER attempt entire diagram in single response** — token limits and worse quality.

### Element Templates

#### Rectangle (Container)

```json
{
  "id": "s1_box_concept",
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 80,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "angle": 0,
  "seed": 100001,
  "version": 1,
  "versionNonce": 100001,
  "isDeleted": false,
  "roundness": { "type": 3 },
  "boundElements": [{ "id": "s1_text_concept", "type": "text" }],
  "groupIds": []
}
```

#### Text in Shape

```json
{
  "id": "s1_text_concept",
  "type": "text",
  "x": 110,
  "y": 120,
  "width": 180,
  "height": 25,
  "text": "AI Tools",
  "originalText": "AI Tools",
  "fontSize": 20,
  "fontFamily": 1,
  "textAlign": "center",
  "verticalAlign": "middle",
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "angle": 0,
  "seed": 100002,
  "version": 1,
  "versionNonce": 100002,
  "isDeleted": false,
  "containerId": "s1_box_concept",
  "boundElements": [],
  "groupIds": []
}
```

#### Free-Floating Text (Labels, Annotations)

```json
{
  "id": "s1_label_note",
  "type": "text",
  "x": 100,
  "y": 50,
  "width": 200,
  "height": 30,
  "text": "Key Concepts",
  "originalText": "Key Concepts",
  "fontSize": 28,
  "fontFamily": 1,
  "textAlign": "center",
  "verticalAlign": "top",
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "angle": 0,
  "seed": 100003,
  "version": 1,
  "versionNonce": 100003,
  "isDeleted": false,
  "boundElements": [],
  "groupIds": []
}
```

#### Arrow (Connector)

```json
{
  "id": "s1_arrow_a_to_b",
  "type": "arrow",
  "x": 300,
  "y": 140,
  "width": 100,
  "height": 0,
  "points": [
    [0, 0],
    [100, 0]
  ],
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "angle": 0,
  "seed": 100010,
  "version": 1,
  "versionNonce": 100010,
  "isDeleted": false,
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "startBinding": {
    "elementId": "s1_box_a",
    "focus": 0,
    "gap": 5
  },
  "endBinding": {
    "elementId": "s1_box_b",
    "focus": 0,
    "gap": 5
  },
  "boundElements": [],
  "groupIds": []
}
```

#### Ellipse (Circle Node)

```json
{
  "id": "s1_circle_center",
  "type": "ellipse",
  "x": 300,
  "y": 200,
  "width": 180,
  "height": 180,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#d0bfff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "angle": 0,
  "seed": 100020,
  "version": 1,
  "versionNonce": 100020,
  "isDeleted": false,
  "roundness": { "type": 2 },
  "boundElements": [{ "id": "s1_text_center", "type": "text" }],
  "groupIds": []
}
```

### Layout Rules (CRITICAL — violations produce ugly diagrams)

#### Spacing & Overlap

1. **NEVER overlap boxes.** Minimum 40px gap between any two shapes (edge to edge, not centre to centre).
2. **NEVER let text overflow its container.** Text width must be at least 20px less than container width. If text is long, make the container wider or use line breaks (`\n`).
3. **Minimum 60px gap between rows/columns** of elements. 100px+ between major sections.
4. **200px+ clear space** around the diagram's focal point (central hub, title area).

#### Arrows & Connections

5. **Arrows connect to shape edges, not centres.** The render engine handles this via `startBinding`/`endBinding` — but arrow `points` must still start/end near the shape's edge, not its centre coordinates.
6. **Arrow start point** should be at the edge of the source shape. Calculate: source shape's x + width (for right edge), or x (for left edge), or y + height (for bottom edge).
7. **Arrow end point** should be at the edge of the target shape, with a 5px gap.
8. **Never route arrows through other shapes.** If a direct path crosses another element, add waypoints (`points` array with 3+ coordinates) to route around it.
9. **Label arrows** when the connection type isn't obvious (e.g., "Yes"/"No" on decision branches).

#### Overlap Prevention

19. **QA CHECK: After rendering, verify NO text is crossed by arrows.** Trace each arrow path and check it doesn't cross any text or unrelated box.
20. **On radial/hub-spoke layouts, NEVER place free-floating text between the hub and spoke boxes.** Arrows always pass through that space. For top spokes, put descriptions ABOVE the box. For bottom/side spokes, put descriptions BELOW the box. The rule is: descriptions go on the OUTER side (away from hub).
21. **After EVERY render, mentally trace each arrow path** and check if it crosses any text or box it shouldn't.

#### Shadow Style (Colour Bleed)

22. **Every filled shape gets a shadow element** — a duplicate rectangle/ellipse rendered BEHIND the main shape, offset +8px right and +8px down, using a **darker shade** of the same fill colour. This creates the Excalidraw+ "colour outside the lines" effect.
23. **Shadow properties:** Same size as the main shape, `strokeColor: "transparent"`, `strokeWidth: 0`, `roughness: 0` (clean shadow), `opacity: 100`.
24. **Darker colour map:** Blue `#a5d8ff`→`#74b3e8`, Green `#b2f2bb`→`#7dd68a`, Pink `#ffc9c9`→`#e89a9a`, Yellow `#ffec99`→`#d4c06e`, Purple `#d0bfff`→`#a893d9`, Orange `#ffd8a8`→`#d4ad7e`, Cyan `#99e9f2`→`#6bbfc8`, Grey `#e9ecef`→`#b8bcc0`.
25. **Shadow element must come BEFORE its main shape** in the elements array (rendered behind).

#### Fill & Style (Hand-Drawn Look)

10. **Use `fillStyle: "hachure"` for a sketchier look** on large shapes (200px+ wide). Use `fillStyle: "solid"` for smaller shapes and containers with text.
11. **Use `roughness: 1`** for all shapes — this creates the characteristic Excalidraw wobble where the fill slightly bleeds past the stroke, looking more hand-drawn.
12. **Use `roundness: {"type": 3}` for rectangles** (rounded corners) and `{"type": 2}` for ellipses.
13. **Vary pastel colors** — never use the same fill color for adjacent boxes. Alternate from the palette.

#### Text

14. **Title text is free-floating** (no container), centred above the diagram, fontSize 28-32.
15. **Text inside shapes** must have `containerId` set AND the shape must list the text in `boundElements`. Both sides of the binding are required.
16. **CRITICAL: Set contained text width and height to 0.** When text has a `containerId`, set `"width": 0, "height": 0` — this forces `convertToExcalidrawElements()` to auto-calculate the correct centred position within the container. If you set explicit width/height, the text will be misaligned.
17. **Set contained text x/y to the container's centre point.** For a rectangle at (100, 200) with width 180 and height 65: text x = 190, text y = 232. This is a hint — the converter will adjust it, but starting at centre helps.
18. **Annotation text** (subtitles, descriptions below shapes) is free-floating, fontSize 14-16, strokeColor `#495057` (grey).

#### Sizing

17. **Standard shape sizes:** Rectangles 140-200px wide, 50-70px tall. Ellipses 150-200px diameter. Diamonds 120-140px.
18. **Canvas target:** 800x500 element area (compact) to 1400x800 (detailed). The renderer adds 80px padding.

### Layout Guidelines

- **Hierarchy through scale**: Title (32px) → Section headers (24px) → Labels (20px) → Annotations (14-16px)
- **Whitespace**: 60-100px between major elements, 200px+ around focal points
- **Flow direction**: Left→right for processes, top→bottom for hierarchies, radial for hubs
- **Canvas size**: Target 1400x800 element area (renders to 1820x1024 with padding)
- **Every relationship MUST have an arrow or line** — no implied connections

### Container Discipline

Default to **free-floating text**. Add containers (rectangles, ellipses) only when:

- Element is the diagram's focal point
- Needs visual grouping with other elements
- Arrows connect to it
- Shape itself carries meaning (circle = hub, diamond = decision)

Aim for **less than 30% of text inside containers**.

## Step 4: Render to PNG

After generating the `.excalidraw` JSON file, render it:

```bash
cd C:/Projects/1_gwthpipeline520
python app/render_excalidraw.py path/to/diagram.excalidraw --output path/to/diagram.png --scale 2
```

This uses Playwright + headless Chromium to render via the Excalidraw library.

## Step 5: Validate (MANDATORY)

After rendering, **read the PNG file** and visually inspect:

1. **Structure**: Does the layout match the intended visual pattern?
2. **Text overflow**: Any text clipping outside containers?
3. **Overlaps**: Any elements sitting on top of each other?
4. **Arrows**: Landing on correct targets? Not crossing other elements?
5. **Spacing**: Even spacing between similar elements?
6. **Readability**: All text readable at export size?
7. **Balance**: No large empty voids or overcrowded areas?

**Fix issues by editing the JSON** (adjust x, y, width, height, points), then re-render.

Typically **2-4 iterations** needed. Don't stop after one pass.

## Step 6: Save

### File naming

Save the `.excalidraw` JSON and rendered `.png` to the lesson's content directory:

```
data/generated_lessons/m{N}_l{NN}_{slug}/content/
├── diagram_concept_1.excalidraw    # Editable source
├── diagram_concept_1.png           # Rendered image
├── diagram_concept_2.excalidraw
├── diagram_concept_2.png
└── diagram_prompts.json            # Prompt metadata
```

### Diagram Prompts Schema

If generating from `diagram_prompts.json`, each entry has:

```json
{
  "position": "concept_1",
  "description": "Short title for the diagram",
  "diagram_type": "mind_map | flowchart | comparison_grid | timeline | hub_spoke | assembly_line | side_by_side",
  "concepts": ["Concept A", "Concept B", "Concept C"],
  "relationships": "Description of how concepts relate",
  "placement": "After 'Section Heading' in the lesson",
  "style": "hand-drawn",
  "size": "1820x1024",
  "status": "not_started"
}
```

## Important Rules

- **ALWAYS use roughness: 1** — this is the hand-drawn aesthetic
- **ALWAYS use fontFamily: 1** (Virgil) — hand-written font
- **NEVER use hex codes outside the GWTH palette** listed above
- **NEVER skip the render-validate loop** — you cannot judge layout from JSON alone
- **NEVER generate entire large diagram in one pass** — build section by section
- **Every element MUST have a unique id, seed, version, versionNonce, and isDeleted: false**
- **Text `text` property contains ONLY readable words** — no code, no symbols, no formatting
- **Arrow bindings require matching**: arrow's `startBinding.elementId` must match the source shape's `id`, and that shape must list the arrow in its `boundElements`
