/**
 * Seed LoveSac CRM files as assets.
 * Run: npx tsx scripts/seed-lovesac-assets.ts
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

const LOVESAC_FILES = [
  {
    name: "LoveSac Target Architecture",
    description:
      "LoveSac target architecture diagram showing system integrations and data flow (March 2026)",
    asset_type: "diagram",
    file_name: "2026.03.12 Lovesac Target Architecture.jpg",
    file_size_bytes: 169998,
  },
  {
    name: "LoveSac Product Hierarchy Review",
    description:
      "LoveSac product hierarchy review document - seven-level hierarchy to be flattened to three levels",
    asset_type: "document",
    file_name: "2026.03.12 New Product Hiearchy Review.pdf",
    file_size_bytes: 1351837,
  },
  {
    name: "LoveSac Sactional Builder Guide",
    description:
      "Guide for LoveSac's Sactional product configurator - explains component types and assembly",
    asset_type: "document",
    file_name: "Lovesac_Sactional_Builder_Guide.docx",
    file_size_bytes: 23654,
  },
  {
    name: "LoveSac Product Data File",
    description:
      "Full LoveSac product catalog export - 28,000 SKUs with attributes, used for compatibility rule generation",
    asset_type: "document",
    file_name: "Product File.xlsx",
    file_size_bytes: 3705214,
  },
  {
    name: "LoveSac Requirements Definition",
    description:
      "LoveSac project requirements document covering PIM needs, data management, and integration requirements",
    asset_type: "document",
    file_name: "Requirements Definition.docx",
    file_size_bytes: 303543,
  },
  {
    name: "LoveSac Compatibility Rules",
    description:
      "AI-generated compatibility rules for LoveSac product configurations - components, fabrics, and inserts",
    asset_type: "document",
    file_name: "lovesac-compatibility-rules.docx",
    file_size_bytes: 21688,
  },
  {
    name: "LoveSac Solution Design",
    description:
      "Conscia solution design for LoveSac - DX Graph and DX Engine architecture for product configurator",
    asset_type: "document",
    file_name: "lovesac-solution-design.docx",
    file_size_bytes: 24373,
  },
];

async function main() {
  // Find Conscia client
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

  // Check for existing assets to avoid duplicates
  const { data: existing } = await supabase
    .from("assets")
    .select("file_name")
    .eq("client_id", clientId);

  const existingNames = new Set(
    (existing ?? []).map((a: { file_name: string }) => a.file_name),
  );

  const toInsert = LOVESAC_FILES.filter(
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

  console.log(`Inserted ${toInsert.length} LoveSac assets`);

  // Also create as deliverables (solution design and requirements)
  const deliverables = [
    {
      name: "LoveSac Solution Design Document",
      description:
        "Complete solution architecture for LoveSac product configurator using DX Graph and DX Engine",
      status: "in_progress",
      file_name: "lovesac-solution-design.docx",
      file_url: `file:///C:/Projects/conscia-fractional/CRM/lovesac/lovesac-solution-design.docx`,
    },
    {
      name: "LoveSac Compatibility Rules Document",
      description:
        "AI-generated compatibility rules mapping for components, fabrics, and inserts",
      status: "draft",
      file_name: "lovesac-compatibility-rules.docx",
      file_url: `file:///C:/Projects/conscia-fractional/CRM/lovesac/lovesac-compatibility-rules.docx`,
    },
  ];

  const { data: existingDeliverables } = await supabase
    .from("deliverables")
    .select("file_name")
    .eq("client_id", clientId);

  const existingDelNames = new Set(
    (existingDeliverables ?? []).map((d: { file_name: string }) => d.file_name),
  );

  const delToInsert = deliverables
    .filter((d) => !existingDelNames.has(d.file_name))
    .map((d) => ({
      client_id: clientId,
      ...d,
      is_client_visible: false,
    }));

  if (delToInsert.length > 0) {
    const { error: delError } = await supabase
      .from("deliverables")
      .insert(delToInsert);
    if (delError) {
      console.error("Failed to insert deliverables:", delError.message);
    } else {
      console.log(`Inserted ${delToInsert.length} LoveSac deliverables`);
    }
  }

  console.log("Done!");
}

main().catch(console.error);
