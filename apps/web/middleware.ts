import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_PATHS = ["/login", "/signup"];

const PROTECTED_PATHS = ["/"];

function isProtectedPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/api/ledger")) return true;
  if (pathname.startsWith("/api/funding")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          request.cookies.set({ name, value, ...options })
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/auth/callback")
  ) {
    return response;
  }

  const hasSession = Boolean(data.user);

  if (isProtectedPath(pathname) && !hasSession) {
    const urlObj = request.nextUrl.clone();
    urlObj.pathname = "/login";
    urlObj.searchParams.set("next", pathname);
    return NextResponse.redirect(urlObj);
  }

  if (hasSession && AUTH_PATHS.includes(pathname)) {
    const urlObj = request.nextUrl.clone();
    urlObj.pathname = "/";
    return NextResponse.redirect(urlObj);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
