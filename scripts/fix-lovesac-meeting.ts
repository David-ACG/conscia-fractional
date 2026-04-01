/**
 * Fix the seeded LoveSac meeting:
 * 1. Update duration from 48 to 60 (rounded to 15 mins)
 * 2. Fix David's role from "Fractional CTO" to "Solution Architect"
 * 3. Add more detailed notes
 * 4. Update timesheet entry to 60 mins
 *
 * Run: npx tsx scripts/fix-lovesac-meeting.ts
 */

import { createServerClient } from "@supabase/ssr";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  },
);

const UPDATED_SUMMARY = `## LoveSac Project Overview

Sana briefed David and Laurel (new senior solutions engineer at Conscia) on the LoveSac project — a product configurator implementation using Conscia's DX Graph and DX Engine. This was an introductory call to align on the project scope, solution architecture, and next steps ahead of the client kickoff meeting.

## Context & Background

- LoveSac is a US-based furniture retailer specialising in modular, configurable couches ("Sactionals")
- They are growing rapidly and want to modernise their product data infrastructure to support omni-channel operations
- Conscia was engaged initially for PIM (Product Information Management), but Sana identified a larger need for a real-time product configuration/compatibility solution
- The project has been in procurement — LoveSac has bought Conscia, paperwork is being finalised

## Current State at LoveSac

- **No PIM system** — product data lives in an ERP (SAP) with an exploded set of SKUs and in Adobe Commerce (Magento, older version)
- **No CPQ engine** — compatibility rules between components, fabrics, and inserts are hard-coded in ThreeKit (3D product visualiser on lovesac.com)
- **Manual POS process** — store associates manually enter component/fabric/insert combinations. The system does not validate compatibility in real time
- **Fulfilment errors** — incompatible configurations are discovered post-sale, requiring callbacks to customers to change their orders. This creates a poor customer experience and operational waste
- **28,000 product records** in their catalogue that need to be managed centrally
- **Seven-level product hierarchy** that needs to be flattened to three levels. Fabric should be an attribute on the product, not a hierarchy level

## Proposed Solution Architecture

### DX Graph (PIM Layer)
- Single collection for all SKUs with dynamic relationships for compatibility rules
- Ground truth for what components, fabrics, and inserts connect with what (static, not context-dependent)
- Hierarchical taxonomies with rules at each node defining how data connects
- Initially Sana's AI-assisted solution proposed multiple collections, but Sana corrected this — Conscia DX Graph supports relationships within the same collection

### DX Engine (Real-Time Layer)
- Sits on top of DX Graph for real-time validation and orchestration
- Enables a headless architecture where POS, website, and future AI agents can all make real-time calls to validate product configurations
- Takes API calls like "Is this combination of component + fabric + insert valid?" and returns validation results
- Can be exposed as an MCP (Model Context Protocol) server for AI agent integration
- **Offered to LoveSac free for one year** — this was not in the original contract. Sana identified the gap and decided to provide it at no cost to demonstrate value

### Data Ingestion
- Product catalog feed, hierarchy feed, and inventory feed from LoveSac's backend systems
- Need JSON format for operationalised ingestion (currently have a spreadsheet export)
- LoveSac may provide API endpoints, or Conscia will pull data from web services
- Three backend systems to ingest from (specifics to be confirmed with LoveSac)

### AI-Generated Compatibility Rules
- Sana used Claude AI with Pandas to analyse the 28,000 product records (took ~20 minutes)
- The AI generated compatibility rules by analysing data dimensions and relationships
- These rules need to be verified by LoveSac's team — they do not currently have documented rules
- The rules will be implemented in DX Graph as dynamic relationships

## Competitive Positioning

- **vs Salesforce CPQ:** Costs $500K+/year in licensing plus $1-2M in implementation. Hard-coded connectors, not headless, cannot support AI agents
- **vs ThreeKit (current):** Hard-coded rules in the 3D visualiser, not accessible via API, not usable across channels
- **Conscia advantage:** Everything is API-driven (JSON in/out), headless, supports real-time validation, and can be exposed to AI agents via MCP server. Rules can be imported programmatically rather than manually entered

## People & Roles

- **Sana** (CEO, Conscia) — Led the solution design, created the solution document with Claude AI, identified the compatibility rules gap
- **David** (Solution Architect) — Bringing executive communication experience, solution architecture, translating technology to business terms, creating client-facing materials
- **Laurel** (Senior Solutions Engineer, Conscia) — New hire, Master's in AI from University of Toronto, background in finance data analytics and venture studio solutioning. Will be hands-on for LoveSac, shadowing Holt Renfrew
- **Morgan** (Conscia) — Project coordinator, scheduling kickoff meeting, was off for the day but still coordinating via text
- **Dwayne** (Conscia) — Validated the platform solution approach from a technical standpoint
- **Amelia** (VP Consumer Experience, LoveSac) — Main client contact, not very technical, needs business-oriented communication and visual presentations. Managing ~10 concurrent projects

## Timeline & Milestones

- **Kickoff meeting:** Early next week (Mon 31 Mar – Wed 2 Apr), Morgan coordinating with Amelia
- **Phase 1 target: June 30, 2026** — Data ingestion, hierarchy mapping, compatibility rules in DX Graph, DX Engine POC ready for integration
- **Post-June:** LoveSac will begin POS integration (real-time API calls to validate configurations)
- **Holt Renfrew project** also kicking off simultaneously — Laurel will shadow that project, not lead initially

## Key Discussion Points

### Inside Business Sell Deck
Amelia needs a presentation deck to explain the Conscia solution internally at LoveSac. The deck should:
- Translate the technical architecture into business benefits
- Show the current pain points (manual processes, fulfilment errors, poor CX)
- Demonstrate the future state (automated validation, omni-channel, agent-ready)
- Quantify value: cost savings from fewer fulfilment errors, better customer experience, operational efficiency

### Documentation Gaps
- Conscia's own documentation needs updating — the AI incorrectly assumed DX Graph couldn't do same-collection relationships
- Solution diagrams needed (Excalidraw or Mermaid) to visually explain the architecture
- LoveSac's hierarchy review PDF needs to be read and understood before kickoff

### Future Opportunity
- The auto industry (e.g. Jaguar car configurator) has similar configurator needs
- If LoveSac succeeds, Conscia plans to create a white paper for automotive configurators
- This positions the DX Graph + DX Engine combination as a modern, headless alternative to legacy CPQ systems`;

const UPDATED_ATTENDEES = [
  { name: "Sana", role: "CEO, Conscia" },
  { name: "David", role: "Solution Architect" },
  { name: "Laurel", role: "Senior Solutions Engineer, Conscia" },
];

async function main() {
  // Find the meeting
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id")
    .eq("title", "Conscia - LoveSac Project Kickoff")
    .limit(1);

  if (!meetings || meetings.length === 0) {
    console.error("Meeting not found");
    process.exit(1);
  }

  const meetingId = meetings[0]!.id;
  console.log(`Found meeting: ${meetingId}`);

  // Update meeting: duration to 60, fix attendees, update summary
  const { error: updateError } = await supabase
    .from("meetings")
    .update({
      duration_minutes: 60,
      attendees: UPDATED_ATTENDEES,
      summary: UPDATED_SUMMARY,
    })
    .eq("id", meetingId);

  if (updateError) {
    console.error("Failed to update meeting:", updateError.message);
    process.exit(1);
  }
  console.log("Updated meeting: duration=60, fixed role, more detailed notes");

  // Update timesheet entry
  const stoppedAt = new Date(
    new Date("2026-03-27T15:31:00Z").getTime() + 60 * 60 * 1000,
  ).toISOString();

  const { error: timeError } = await supabase
    .from("time_entries")
    .update({
      duration_minutes: 60,
      stopped_at: stoppedAt,
    })
    .eq("meeting_id", meetingId);

  if (timeError) {
    console.error("Failed to update timesheet:", timeError.message);
  } else {
    console.log("Updated timesheet entry: 60 mins");
  }

  console.log("Done!");
}

main().catch(console.error);
