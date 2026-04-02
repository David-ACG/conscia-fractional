// Local dev: curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3002/api/cron/embed-documents
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDocument } from "@/lib/services/auto-embed-service";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || !cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database connection unavailable" },
      { status: 503 },
    );
  }

  const startTime = Date.now();

  // Fetch pending documents (embedded_at IS NULL), skip those with too many failures
  const { data: pending, error: fetchError } = await admin
    .from("documents")
    .select("id, name, metadata")
    .is("embedded_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE + 20); // fetch extra so we can skip failed ones within the batch

  if (fetchError) {
    return NextResponse.json(
      { error: `Failed to fetch pending documents: ${fetchError.message}` },
      { status: 500 },
    );
  }

  const docs = pending ?? [];

  // Filter out documents that have exceeded max attempts
  const toProcess = docs
    .filter((doc) => {
      const meta = (doc.metadata ?? {}) as Record<string, unknown>;
      const attempts =
        typeof meta.embed_attempts === "number" ? meta.embed_attempts : 0;
      return attempts < MAX_ATTEMPTS;
    })
    .slice(0, BATCH_SIZE);

  const skipped = docs.length - toProcess.length;

  // Count remaining after this batch
  const { count: remainingCount } = await admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .is("embedded_at", null);

  let succeeded = 0;
  let failed = 0;

  for (const doc of toProcess) {
    try {
      await processDocument(doc.id as string);
      succeeded++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[embed-cron] Failed to process document ${doc.id}: ${message}`,
      );

      // Update metadata with error info
      const meta = (doc.metadata ?? {}) as Record<string, unknown>;
      const attempts =
        typeof meta.embed_attempts === "number" ? meta.embed_attempts : 0;
      await admin
        .from("documents")
        .update({
          metadata: {
            ...meta,
            embed_error: message,
            embed_attempts: attempts + 1,
          },
        })
        .eq("id", doc.id as string);
    }
  }

  const durationMs = Date.now() - startTime;
  const avgMs =
    toProcess.length > 0 ? Math.round(durationMs / toProcess.length) : 0;

  return NextResponse.json({
    processed: toProcess.length,
    succeeded,
    failed,
    skipped,
    remaining: Math.max(0, (remainingCount ?? 0) - succeeded),
    durationMs,
    avgMsPerDoc: avgMs,
  });
}
