import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getServerUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false as const, status: 401 as const, message: "Unauthorized" };
  }
  return { ok: true as const, user: data.user, supabase };
}
