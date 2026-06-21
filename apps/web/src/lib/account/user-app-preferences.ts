import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TradingMode } from "@/lib/account/api";

export async function getUserTradingMode(userId: string): Promise<TradingMode> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("user_app_preferences")
      .select("trading_mode")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[user-app-preferences] read:", error.message);
      return "demo";
    }
    return data?.trading_mode === "live" ? "live" : "demo";
  } catch {
    return "demo";
  }
}

export async function upsertUserTradingModeForSessionUser(mode: TradingMode): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const now = new Date().toISOString();
  const { error } = await supabase.from("user_app_preferences").upsert(
    { user_id: user.id, trading_mode: mode, updated_at: now },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}
