import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildOnboardAccountContext,
  toClientAccountSnapshot,
} from "@/lib/onboard/onboard-account-context";
import { generateWelcomeMessage } from "@/lib/onboard/generate-profile-question";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await buildOnboardAccountContext(user.id);
  const welcomeMessage = await generateWelcomeMessage(account);

  return Response.json({
    account: toClientAccountSnapshot(account),
    welcomeMessage,
  });
}
