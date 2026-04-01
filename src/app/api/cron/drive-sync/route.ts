// Local dev: curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3002/api/cron/drive-sync
import { NextRequest, NextResponse } from "next/server";
import { syncAllFolders } from "@/lib/services/drive-sync-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || !cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const results = await syncAllFolders();

    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const totalRemoved = results.reduce((sum, r) => sum + r.removed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    return NextResponse.json({
      success: true,
      synced: results.length,
      results,
      totalAdded,
      totalUpdated,
      totalRemoved,
      totalErrors,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
