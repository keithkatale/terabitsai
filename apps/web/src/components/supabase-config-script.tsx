export function SupabaseConfigScript() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const payload = JSON.stringify({ url, anonKey });
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__TERABITS_SUPABASE__=${payload}`,
      }}
    />
  );
}
