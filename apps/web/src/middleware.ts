import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_PATHS = new Set(["/login", "/signup"]);
const PUBLIC_PATHS = new Set(["/pricing", "/auth/callback", "/api/webhooks/dodo"]);

function isPublicPath(pathname: string): boolean {
  if (AUTH_PATHS.has(pathname)) return true;
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  return false;
}

function isAuthRequired(pathname: string): boolean {
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  if (pathname.startsWith("/api/ledger")) return true;
  if (pathname.startsWith("/api/funding")) return true;
  if (pathname.startsWith("/api/subscriptions")) return true;
  if (pathname.startsWith("/api/subscription")) return true;
  return false;
}

function isProRequired(pathname: string): boolean {
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  if (pathname.startsWith("/api/intel")) return true;
  return false;
}

function redirectToLogin(request: NextRequest, nextPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url);
}

function redirectToPricing(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/pricing";
  url.searchParams.set("upgrade", "terminal");
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (!isAuthRequired(pathname) && !isProRequired(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail closed: never allow protected routes without Supabase configured
  if (!supabaseUrl || !supabaseAnon) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }
    return redirectToLogin(request, pathname);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hasSession = Boolean(user);

  if (!hasSession) {
    if (isPublicPath(pathname)) {
      return response;
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectToLogin(request, pathname);
  }

  if (AUTH_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProRequired(pathname)) {
    const { data: sub, error } = await supabase
      .from("app_subscriptions")
      .select("plan_id, status")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .in("plan_id", ["pro", "premium"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[middleware] subscription lookup failed:", error.message);
    }

    if (!sub) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Terminal plan required", upgrade: "/pricing" },
          { status: 402 }
        );
      }
      return redirectToPricing(request);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/app",
    "/app/:path*",
    "/login",
    "/signup",
    "/pricing",
    "/api/intel/:path*",
    "/api/ledger/:path*",
    "/api/funding/:path*",
    "/api/subscriptions/:path*",
    "/api/subscription/:path*",
  ],
};
