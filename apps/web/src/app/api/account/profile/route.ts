import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAccountProfile } from "@/lib/account/user-profile";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getUserAccountProfile(user.id);
  return Response.json({ profile });
}
