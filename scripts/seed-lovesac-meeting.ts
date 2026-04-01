/**
 * One-time seed script: creates the Conscia/LoveSac meeting from the
 * transcribed recording at meetings/transcribed/Conscia_-_lovesac_-_27_Mar_at_15-31_eng.txt
 *
 * Run: npx tsx scripts/seed-lovesac-meeting.ts
 */

import { createServerClient } from "@supabase/ssr";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  process.env[key] = val;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
  cookies: {
    getAll() {
      return [];
    },
    setAll() {},
  },
});

const MEETING_TITLE = "Conscia - LoveSac Project Kickoff";
const MEETING_DATE = "2026-03-27T15:31:00Z";
const DURATION_MINUTES = 48;

const SUMMARY = `## LoveSac Project Overview

Sana briefed David and Laurel (new senior solutions engineer at Conscia) on the LoveSac project — a product configurator implementation using Conscia's DX Graph and DX Engine.

## Current State at LoveSac

- LoveSac sells modular/configurable couches with complex compatibility between components, fabrics, and inserts
- Currently no PIM system — product data lives in an ERP (SAP) with exploded SKUs and Adobe Commerce (Magento)
- No CPQ engine — compatibility rules are hard-coded in ThreeKit (3D visualizer on lovesac.com)
- Store associates manually enter orders in POS without real-time compatibility validation
- This leads to fulfilment issues: orders placed for incompatible configurations are discovered after the customer leaves, requiring callbacks and changes

## Proposed Solution Architecture

- **DX Graph (PIM):** Single collection for all SKUs with dynamic relationships for compatibility rules. Ground truth for what connects with what (static, not context-dependent)
- **DX Engine:** Sits on top of DX Graph for real-time validation calls. Enables headless architecture — POS, website, and future AI agents can all call it for configuration validation
- **Data Ingestion:** Product catalog feed, hierarchy feed, and inventory feed. Need JSON format from LoveSac for operationalized ingestion (currently have spreadsheet with 28K records)
- **Compatibility Rules:** Generated programmatically using AI (Claude with Pandas) analyzing the 28K product records. Need LoveSac to verify these rules
- **Hierarchies:** Three-level taxonomy (flattened from current seven levels). Fabric is an attribute, not a hierarchy level

## Key Decisions

- DX Engine offered to LoveSac free for one year (not in original contract, introduced after initial agreement)
- All relationships within same collection in DX Graph (not multiple collections — Sana corrected Claude's initial suggestion)
- Solution designed to be headless and MCP-server compatible for future AI agent integration
- CPQ comparison: Salesforce CPQ costs $500K+/year plus $1-2M implementation, and is not headless

## People & Roles

- **Amelia** (VP Consumer Experience at LoveSac): Main client contact, not very technical, needs business-oriented communication
- **Morgan** (Conscia): Project coordinator, scheduling kickoff, absent (day off, in Vegas)
- **Laurel** (Conscia): New senior solutions engineer, AI master's from U of T, background in finance data analytics + venture studio. Will shadow Holt Renfrew project, hands-on for LoveSac
- **Dwayne** (Conscia): Validated platform solution approach
- **David's role:** Solution architecture, translating technology to business terms, executive communication, creating business sell deck

## Timeline & Next Steps

- Kickoff meeting: Early next week (Monday-Wednesday), Morgan coordinating with Amelia
- **Phase 1 target: June 30** — data ingestion, hierarchies, compatibility rules, DX Engine POC ready for integration
- POS integration: Post-June (LoveSac will test through other means first)
- Holt Renfrew project also kicking off simultaneously (Laurel shadowing)

## Action Items Discussed

- Review solution document in shared Google Drive and provide feedback / poke holes
- Review AI-generated compatibility rules for accuracy
- Read LoveSac's hierarchy review PDF
- Create architecture diagrams (Excalidraw or Mermaid) for the solution
- Create "inside business sell deck" for Amelia to use internally at LoveSac
- Prepare for kickoff meeting with LoveSac
- David to share AI course with Laurel when ready`;

const ATTENDEES = [
  { name: "Sana", role: "CEO, Conscia" },
  { name: "David", role: "Fractional CTO" },
  { name: "Laurel", role: "Senior Solutions Engineer, Conscia" },
];

const TASKS = [
  {
    title: "Review LoveSac solution document and provide feedback",
    description:
      "Review the solution document in the shared Google Drive that Sana prepared with Claude. Look for gaps, incorrect assumptions, or areas that need more detail. The document covers DX Graph + DX Engine architecture for product configurator.",
    priority: "high",
    assignee: "David",
    assignee_type: "self",
    confidence: "explicit",
    source_quote:
      "if you review everything that's already there, look at the solution document, poke holes at it, tell me that I'm wrong",
  },
  {
    title: "Review AI-generated compatibility rules",
    description:
      "Verify the compatibility rules generated by Claude/Pandas from the 28K product records. These rules define what components, fabrics, and inserts are compatible with each other for LoveSac's configurable couches.",
    priority: "high",
    assignee: "David",
    assignee_type: "self",
    confidence: "explicit",
    source_quote: "Can you verify that these rules are actually correct?",
  },
  {
    title: "Read LoveSac hierarchy review PDF",
    description:
      "Review the product hierarchy document from LoveSac that shows their current seven-level hierarchy. The plan is to flatten this to three levels with fabric as an attribute rather than a hierarchy level.",
    priority: "medium",
    assignee: "David",
    assignee_type: "self",
    confidence: "explicit",
    source_quote:
      "I was looking at their hierarchy review... I haven't read this one",
  },
  {
    title: "Create solution architecture diagrams",
    description:
      "Create visual diagrams (Excalidraw or Mermaid) showing the DX Graph + DX Engine architecture, data flow from ingestion through to POS/website/agents. Sana shared a basic Mermaid diagram but more detailed ones are needed.",
    priority: "medium",
    assignee: "David",
    assignee_type: "self",
    confidence: "explicit",
    source_quote:
      "if you think that it's better to explain what I've explained to you with more diagrams and visuals, then absolutely go ahead",
  },
  {
    title: "Create inside business sell deck for LoveSac",
    description:
      "Create a presentation deck that Amelia (VP Consumer Experience) can use internally at LoveSac to explain the Conscia solution to business teams. Should translate technology into business terms: cost savings, better customer experience, fewer fulfilment errors, omnichannel readiness.",
    priority: "high",
    assignee: "David",
    assignee_type: "self",
    confidence: "explicit",
    source_quote:
      "one thing that they asked me to bring back is a business, what they call an inside business sell deck",
  },
  {
    title: "Prepare for LoveSac kickoff meeting",
    description:
      "Prepare questions and materials for the kickoff meeting with LoveSac (early next week, Mon-Wed). Need to go in ready with what we think we need from them: data feeds in JSON format, compatibility rule verification, hierarchy definitions, API endpoints for data ingestion.",
    priority: "high",
    assignee: "David",
    assignee_type: "self",
    due_date: "2026-03-31",
    confidence: "explicit",
    source_quote:
      "We should go in ready with what we think we need from them to complete the solution",
  },
  {
    title: "Schedule LoveSac kickoff meeting",
    description:
      "Coordinate with Amelia at LoveSac to schedule the kickoff meeting. Stagger with Holt Renfrew kickoff happening same week.",
    priority: "high",
    assignee: "Morgan",
    assignee_type: "client_team",
    confidence: "explicit",
    source_quote:
      "Morgan's figuring that out with Amelia. It may not be Monday. I have a feeling it's more like Tuesday or Wednesday",
  },
  {
    title: "Share AI course with Laurel when ready",
    description:
      "David is writing an AI course (half done). Share with Laurel for feedback when it's ready.",
    priority: "low",
    assignee: "David",
    assignee_type: "self",
    confidence: "explicit",
    source_quote: "I'll let you see it as soon as it's ready. It's half done.",
  },
];

async function main() {
  // Find the Conscia client
  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", "%conscia%")
    .limit(1);

  if (!clients || clients.length === 0) {
    console.error("No Conscia client found. Create it first.");
    process.exit(1);
  }

  const clientId = clients[0]!.id;
  console.log(`Found Conscia client: ${clientId}`);

  // Read the raw transcript
  const transcriptPath = path.join(
    __dirname,
    "..",
    "meetings",
    "transcribed",
    "Conscia_-_lovesac_-_27_Mar_at_15-31_eng.txt",
  );
  const rawTranscript = fs.readFileSync(transcriptPath, "utf-8");
  console.log(`Read transcript: ${rawTranscript.length} chars`);

  // Check if meeting already exists
  const { data: existing } = await supabase
    .from("meetings")
    .select("id")
    .eq("client_id", clientId)
    .eq("title", MEETING_TITLE)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log("Meeting already exists, skipping creation.");
    process.exit(0);
  }

  // 1. Create meeting
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      client_id: clientId,
      title: MEETING_TITLE,
      meeting_date: MEETING_DATE,
      duration_minutes: DURATION_MINUTES,
      attendees: ATTENDEES,
      summary: SUMMARY,
      transcript: rawTranscript,
      platform: "meet",
      is_client_visible: false,
    })
    .select("id")
    .single();

  if (meetingError) {
    console.error("Failed to create meeting:", meetingError.message);
    process.exit(1);
  }

  console.log(`Created meeting: ${meeting.id}`);

  // 2. Create tasks
  const taskRows = TASKS.map((t) => ({
    client_id: clientId,
    meeting_id: meeting.id,
    title: t.title,
    description: t.description,
    status: "todo",
    priority: t.priority,
    assignee: t.assignee || null,
    assignee_type: t.assignee_type || "self",
    confidence: t.confidence || null,
    source_quote: t.source_quote || null,
    due_date: (t as { due_date?: string }).due_date || null,
    is_client_visible: false,
  }));

  const { error: tasksError } = await supabase.from("tasks").insert(taskRows);
  if (tasksError) {
    console.error("Failed to create tasks:", tasksError.message);
  } else {
    console.log(`Created ${taskRows.length} tasks`);
  }

  // 3. Log to timesheet
  const stoppedAt = new Date(
    new Date(MEETING_DATE).getTime() + DURATION_MINUTES * 60 * 1000,
  ).toISOString();

  const { error: timeError } = await supabase.from("time_entries").insert({
    client_id: clientId,
    category: "Meeting",
    description: MEETING_TITLE,
    started_at: MEETING_DATE,
    stopped_at: stoppedAt,
    duration_minutes: DURATION_MINUTES,
    is_manual: true,
    meeting_id: meeting.id,
    is_billable: true,
  });

  if (timeError) {
    console.error("Failed to create timesheet entry:", timeError.message);
  } else {
    console.log(`Logged ${DURATION_MINUTES}min to timesheet`);
  }

  console.log("Done!");
}

main().catch(console.error);
