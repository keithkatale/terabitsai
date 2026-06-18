import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  let authHeader = "";
  try {
    const headersList = await headers();
    authHeader = headersList.get("authorization") || "";
  } catch {
    // non-request context
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase env vars are not configured");
  }

  return createServerClient(url, anon, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware handles refresh.
        }
      },
    },
  });
}
