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

async function main() {
  // Run migration
  const { error } = await supabase.rpc(
    "exec_sql" as never,
    {
      query:
        "ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL",
    } as never,
  );

  if (error) {
    // Try direct approach - the rpc might not exist
    console.log("rpc not available, trying fetch approach...");
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        query:
          "ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL",
      }),
    });
    if (!res.ok) {
      console.log(
        "Direct SQL not available. Please run this SQL in Supabase dashboard:",
      );
      console.log(
        "ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL;",
      );
      console.log("\nContinuing with seed anyway...");
    }
  }

  // Check if column exists by trying to query it
  const { error: testError } = await supabase
    .from("assets")
    .select("crm_customer_id")
    .limit(1);

  if (testError) {
    console.log(
      "Column doesn't exist yet. Run this SQL in Supabase SQL Editor:",
    );
    console.log(
      "ALTER TABLE public.assets ADD COLUMN crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL;",
    );
  } else {
    console.log("Column crm_customer_id exists on assets table!");
  }
}

main().catch(console.error);
