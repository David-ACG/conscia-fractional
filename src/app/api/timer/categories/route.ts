import { NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";

interface CategoryRow {
  category: string;
  count: number;
  last_used: string;
  avg_hour: number;
}

export async function GET() {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ categories: [] });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ categories: [] });
  }

  // Get category stats from time_entries
  // We use a raw RPC-like approach via select + group
  const { data: entries } = await supabase
    .from("time_entries")
    .select("category, started_at");

  if (!entries || entries.length === 0) {
    return NextResponse.json({ categories: [] });
  }

  // Aggregate in JS since Supabase REST doesn't support GROUP BY
  const stats = new Map<
    string,
    { count: number; lastUsed: Date; hourSum: number }
  >();

  for (const entry of entries) {
    const cat = entry.category || "General";
    const started = new Date(entry.started_at);
    const existing = stats.get(cat);

    if (existing) {
      existing.count++;
      if (started > existing.lastUsed) existing.lastUsed = started;
      existing.hourSum += started.getHours();
    } else {
      stats.set(cat, {
        count: 1,
        lastUsed: started,
        hourSum: started.getHours(),
      });
    }
  }

  const now = Date.now();
  const currentHour = new Date().getHours();

  // Convert to ranked list
  const categories: (CategoryRow & { score: number })[] = [];

  for (const [category, { count, lastUsed, hourSum }] of stats) {
    const avgHour = hourSum / count;

    // Recency score: exponential decay over 7 days
    const daysSince = (now - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSince / 7);

    // Frequency score: log scale
    const maxCount = Math.max(
      ...Array.from(stats.values()).map((s) => s.count),
    );
    const frequencyScore = Math.log(count + 1) / Math.log(maxCount + 1);

    // Time-of-day score: how close avg usage hour is to current hour
    const hourDiff = Math.abs(currentHour - avgHour);
    const wrappedDiff = Math.min(hourDiff, 24 - hourDiff);
    const todScore = 1 - wrappedDiff / 12;

    // Hybrid score: recency 40%, frequency 30%, time-of-day 30%
    const score = recencyScore * 0.4 + frequencyScore * 0.3 + todScore * 0.3;

    categories.push({
      category,
      count,
      last_used: lastUsed.toISOString(),
      avg_hour: avgHour,
      score,
    });
  }

  // Sort by score descending
  categories.sort((a, b) => b.score - a.score);

  return NextResponse.json({ categories });
}
