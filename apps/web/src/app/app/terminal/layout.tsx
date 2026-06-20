import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserPlan, planMeetsRequirement } from "@/lib/subscription/access";

export default async function AppTerminalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/terminal");
  }

  const plan = await getUserPlan(user.id);
  if (!planMeetsRequirement(plan, "pro")) {
    redirect("/pricing?upgrade=terminal");
  }

  return children;
}
