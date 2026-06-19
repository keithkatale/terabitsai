/** Read env at request time (avoids Next.js build-time inlining of NEXT_PUBLIC_*). */
export function readRuntimeEnv(name: string): string | undefined {
  return process.env[name];
}

export function readSupabasePublicEnv(): { url: string; anonKey: string } | null {
  const url =
    readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL") ?? readRuntimeEnv("SUPABASE_URL");
  const anonKey =
    readRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    readRuntimeEnv("SUPABASE_ANON_KEY");

  if (!url || !anonKey) return null;
  return { url, anonKey };
}
