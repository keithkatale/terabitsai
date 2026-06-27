import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell";
import { APP_BASE } from "@/lib/routes";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${APP_BASE}/markets`);
  }

  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
