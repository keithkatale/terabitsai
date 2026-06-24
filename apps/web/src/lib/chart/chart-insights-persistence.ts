import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ChartAnalysis, ChartSpec } from "./tradingview-spec";

export interface ChartInsightRow {
  id: string;
  user_id: string;
  symbol: string;
  interval: string;
  spec: ChartSpec;
  analysis: ChartAnalysis;
  snapshot_hash: string;
  source: string;
  created_at: string;
}

/**
 * Persist a chart analysis for TA-only users and signal journaling.
 */
export async function persistChartInsight(params: {
  userId: string;
  spec: ChartSpec;
  analysis: ChartAnalysis;
  snapshotHash: string;
  source: string;
}): Promise<{ id: string } | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chart_insights")
      .insert({
        user_id: params.userId,
        symbol: params.spec.symbol,
        interval: params.spec.interval,
        spec_json: params.spec,
        analysis_json: params.analysis,
        snapshot_hash: params.snapshotHash,
        source: params.source,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[persistChartInsight] Failed:", error.message);
      return null;
    }
    return { id: data.id as string };
  } catch (err) {
    console.warn("[persistChartInsight] Error:", err);
    return null;
  }
}

export async function listRecentChartInsights(
  userId: string,
  limit = 20,
): Promise<ChartInsightRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chart_insights")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      symbol: row.symbol as string,
      interval: row.interval as string,
      spec: row.spec_json as ChartSpec,
      analysis: row.analysis_json as ChartAnalysis,
      snapshot_hash: row.snapshot_hash as string,
      source: row.source as string,
      created_at: row.created_at as string,
    }));
  } catch {
    return [];
  }
}
