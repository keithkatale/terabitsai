export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

declare global {
  interface Window {
    __TERABITS_SUPABASE__?: SupabasePublicConfig;
  }
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  if (typeof window !== "undefined" && window.__TERABITS_SUPABASE__) {
    const { url, anonKey } = window.__TERABITS_SUPABASE__;
    if (url && anonKey) return { url, anonKey };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env vars are not configured");
  }
  return { url, anonKey };
}
