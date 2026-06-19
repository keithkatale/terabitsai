import { readSupabasePublicEnv } from "@/lib/runtime-env";

export function SupabaseConfigScript() {
  const config = readSupabasePublicEnv();
  if (!config) return null;

  const payload = JSON.stringify(config);
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__TERABITS_SUPABASE__=${payload}`,
      }}
    />
  );
}
