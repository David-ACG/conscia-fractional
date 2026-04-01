/**
 * Seed new LoveSac CRM files as assets + notes.
 * Run: npx tsx scripts/seed-lovesac-new-assets.ts
 */

import { createServerClient } from "@supabase/ssr";
import * as fs from "fs";
import * as path from "path";

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

const NEW_ASSETS = [
  {
    name: "LoveSac Kickoff Presentation",
    description:
      "Conscia kickoff deck for LoveSac (11 slides) — agenda, solution overview, architecture, 12-week timeline, team structure, open questions",
    asset_type: "document",
    file_name: "lovesac-kickoff.pptx",
    file_size_bytes: 94878,
  },
  {
    name: "LoveSac Document Review & Critique",
    description:
      "David's pre-kickoff review of all 8 project documents — gaps, concerns, questions, and proposed adjacency rules table",
    asset_type: "document",
    file_name: "Lovesac_Document_Review.md",
    file_size_bytes: 15097,
  },
  {
    name: "LoveSac Task List from Meeting 27 Mar",
    description:
      "18 tasks extracted from the 27 Mar call — organised by pre-kickoff, solution design, compatibility rules, and pipeline items",
    asset_type: "document",
    file_name: "Lovesac_Conscia_Tasks_27Mar2026.md",
    file_size_bytes: 6126,
  },
  {
    name: "LoveSac Architecture Gap Analysis",
    description:
      "Interactive HTML gap analysis comparing Lovesac target architecture diagram against solution design — colour-coded by in-scope, partial, gap",
    asset_type: "diagram",
    file_name: "lovesac_architecture_gap_analysis.html",
    file_size_bytes: 15097,
  },
  {
    name: "LoveSac Slack Q&A — 30 Mar 2026",
    description:
      "David's 7 architecture questions with Sana's responses — SAP/NetSuite typo, Celigo, BOM→OMS path, Threekit coexistence, Quickship/inventory",
    asset_type: "document",
    file_name: "Slack_QA_30Mar2026.md",
    file_size_bytes: 4500,
  },
];

async function main() {
  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", "%conscia%")
    .limit(1);

  if (!clients || clients.length === 0) {
    console.error("No Conscia client found");
    process.exit(1);
  }
  const clientId = clients[0]!.id;

  const { data: existing } = await supabase
    .from("assets")
    .select("file_name")
    .eq("client_id", clientId);

  const existingNames = new Set(
    (existing ?? []).map((a: { file_name: string }) => a.file_name),
  );

  const toInsert = NEW_ASSETS.filter(
    (f) => !existingNames.has(f.file_name),
  ).map((f) => ({
    client_id: clientId,
    name: f.name,
    description: f.description,
    asset_type: f.asset_type,
    file_name: f.file_name,
    file_size_bytes: f.file_size_bytes,
    file_url: `file:///C:/Projects/conscia-fractional/CRM/lovesac/${f.file_name}`,
    is_client_visible: false,
  }));

  if (toInsert.length === 0) {
    console.log("All assets already exist, skipping.");
    return;
  }

  const { error } = await supabase.from("assets").insert(toInsert);
  if (error) {
    console.error("Failed to insert assets:", error.message);
    process.exit(1);
  }

  console.log(`Inserted ${toInsert.length} new LoveSac assets`);

  // Also add notes for the Slack Q&A and Document Review as research entries
  const researchNotes = [
    {
      client_id: clientId,
      title: "LoveSac Slack Q&A — Sana's responses to architecture questions",
      content: fs.readFileSync(
        path.join(__dirname, "..", "CRM", "lovesac", "Slack_QA_30Mar2026.md"),
        "utf-8",
      ),
      research_type: "architecture",
      tags: JSON.stringify(["lovesac", "architecture", "slack", "q&a"]),
      is_client_visible: false,
    },
  ];

  for (const note of researchNotes) {
    const { data: existingNote } = await supabase
      .from("research")
      .select("id")
      .eq("client_id", clientId)
      .eq("title", note.title)
      .limit(1);

    if (existingNote && existingNote.length > 0) {
      console.log(`Research note "${note.title}" already exists, skipping.`);
      continue;
    }

    const { error: noteError } = await supabase.from("research").insert(note);
    if (noteError) {
      console.error("Failed to insert research note:", noteError.message);
    } else {
      console.log(`Created research note: ${note.title}`);
    }
  }

  console.log("Done!");
}

main().catch(console.error);
