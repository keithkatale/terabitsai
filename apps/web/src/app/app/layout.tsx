import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell";

export default async function AppLayout() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  return <AuthenticatedAppShell />;
}
