import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Exchange a Google ID token (issued directly by Google) for a Supabase session.
 * OAuth runs browser ↔ Google only; Supabase validates the JWT — no Supabase OAuth redirect.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
}
