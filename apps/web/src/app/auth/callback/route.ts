import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { chatDraftPath } from "@/lib/routes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || chatDraftPath();

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
