import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabasePublicEnv } from "@/lib/runtime-env";
import { APP_BASE, chatDraftPath } from "@/lib/routes";

const AUTH_PATHS = new Set(["/login", "/signup"]);
const PUBLIC_PATHS = new Set(["/pricing", "/auth/callback", "/api/webhooks/dodo"]);
const ONBOARDED_USER_COOKIE = "terabits_onboarded_user";
const ONBOARDING_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const FREE_TRIAL_CREDITS = 3000;
const FREE_TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;

function isPublicPath(pathname: string): boolean {
  if (AUTH_PATHS.has(pathname)) return true;
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  return false;
}

function isAuthRequired(pathname: string): boolean {
  if (pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`)) return true;
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  if (pathname.startsWith("/api/account")) return true;
  if (pathname.startsWith("/api/ledger")) return true;
  if (pathname.startsWith("/api/portfolio")) return true;
  if (pathname.startsWith("/api/engine")) return true;
  if (pathname.startsWith("/api/hitl")) return true;
  if (pathname.startsWith("/api/funding")) return true;
  if (pathname.startsWith("/api/subscriptions")) return true;
  if (pathname.startsWith("/api/subscription")) return true;
  if (pathname.startsWith("/api/onboard")) return true;
  if (pathname.startsWith("/api/credits")) return true;
  if (pathname.startsWith("/api/chat")) return true;
  return false;
}

function isProRequired(pathname: string): boolean {
  if (pathname === `${APP_BASE}/terminal` || pathname.startsWith(`${APP_BASE}/terminal/`)) {
    return true;
  }
  if (pathname === "/app/terminal" || pathname.startsWith("/app/terminal/")) return true;
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

function redirectToTrialExpired(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/pricing";
  url.searchParams.set("upgrade", "trial-expired");
  return NextResponse.redirect(url);
}

function isTrialExemptPath(pathname: string): boolean {
  if (pathname === "/pricing") return true;
  if (pathname.startsWith("/api/subscriptions")) return true;
  if (pathname.startsWith("/api/subscription")) return true;
  if (pathname.startsWith("/api/credits")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  return false;
}

function isTrialEnforcedPath(pathname: string): boolean {
  if (isTrialExemptPath(pathname)) return false;
  if (pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`)) return true;
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  if (pathname.startsWith("/api/chat")) return true;
  if (pathname.startsWith("/api/account")) return true;
  if (pathname.startsWith("/api/ledger")) return true;
  if (pathname.startsWith("/api/portfolio")) return true;
  if (pathname.startsWith("/api/engine")) return true;
  if (pathname.startsWith("/api/hitl")) return true;
  if (pathname.startsWith("/api/funding")) return true;
  if (pathname.startsWith("/api/intel")) return true;
  return false;
}

function trialExpiresAt(trialGrantedAt?: string | null): number | null {
  if (!trialGrantedAt) return null;
  const grantedAt = new Date(trialGrantedAt).getTime();
  if (Number.isNaN(grantedAt)) return null;
  return grantedAt + FREE_TRIAL_DURATION_MS;
}

function markOnboardingCompleted(response: NextResponse, userId: string) {
  response.cookies.set(ONBOARDED_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONBOARDING_COOKIE_MAX_AGE,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (!isAuthRequired(pathname) && !isProRequired(pathname)) {
    return NextResponse.next();
  }

  const supabaseConfig = readSupabasePublicEnv();

  if (!supabaseConfig) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }
    return redirectToLogin(request, pathname);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
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
    return NextResponse.redirect(new URL(chatDraftPath(), request.url));
  }

  let activePaidSubscription: { plan_id: string; status: string } | null = null;

  if (isTrialEnforcedPath(pathname)) {
    const { data: sub, error: subError } = await supabase
      .from("app_subscriptions")
      .select("plan_id, status")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .in("plan_id", ["pro", "premium"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("[middleware] subscription lookup failed:", subError.message);
    }

    activePaidSubscription = sub;

    if (!activePaidSubscription) {
      let { data: credits, error: creditsError } = await supabase
        .from("user_credits")
        .select("trial_granted, trial_granted_at")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!credits && !creditsError) {
        const grant = await supabase.rpc("grant_trial_credits", {
          p_user_id: user!.id,
          p_amount: FREE_TRIAL_CREDITS,
        });

        if (grant.error) {
          console.error("[middleware] trial grant failed:", grant.error.message);
        } else {
          credits = grant.data as { trial_granted: boolean; trial_granted_at: string | null };
        }
      }

      if (creditsError) {
        console.error("[middleware] trial lookup failed:", creditsError.message);
      }

      const expiresAt = trialExpiresAt(credits?.trial_granted_at);
      const trialExpired = Boolean(credits?.trial_granted && expiresAt && expiresAt <= Date.now());

      if (trialExpired) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            {
              error: "Your one-day free trial has ended. Upgrade to continue.",
              upgrade: "/pricing?upgrade=trial-expired",
              trialExpiresAt: credits?.trial_granted_at ? new Date(expiresAt!).toISOString() : null,
            },
            { status: 402 },
          );
        }
        return redirectToTrialExpired(request);
      }
    }
  }

  const setupExempt =
    pathname === `${APP_BASE}/setup` ||
    pathname.startsWith(`${APP_BASE}/setup/`) ||
    pathname === "/app/setup" ||
    pathname.startsWith("/app/setup/") ||
    pathname.startsWith("/api/onboard") ||
    pathname.startsWith("/api/credits");

  const isAppShellRoute =
    pathname === APP_BASE ||
    pathname.startsWith(`${APP_BASE}/`) ||
    pathname === "/app" ||
    pathname.startsWith("/app/");
  const hasCompletedOnboardingCookie =
    request.cookies.get(ONBOARDED_USER_COOKIE)?.value === user!.id;

  if (!setupExempt && isAppShellRoute && !hasCompletedOnboardingCookie) {
    const { data: profile, error: profileError } = await supabase
      .from("user_account_profiles")
      .select("onboarding_completed")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!profileError && !profile?.onboarding_completed) {
      return NextResponse.redirect(new URL(`${APP_BASE}/setup`, request.url));
    }
    if (!profileError && profile?.onboarding_completed) {
      markOnboardingCompleted(response, user!.id);
    }
  }

  if (
    pathname === `${APP_BASE}/setup` ||
    pathname.startsWith(`${APP_BASE}/setup/`) ||
    pathname === "/app/setup" ||
    pathname.startsWith("/app/setup/")
  ) {
    const { data: profile, error: profileError } = await supabase
      .from("user_account_profiles")
      .select("onboarding_completed")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!profileError && profile?.onboarding_completed) {
      return markOnboardingCompleted(
        NextResponse.redirect(new URL(chatDraftPath(), request.url)),
        user!.id,
      );
    }
  }

  if (isProRequired(pathname)) {
    const sub = activePaidSubscription;

    if (!sub) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Terminal plan required", upgrade: "/pricing" },
          { status: 402 },
        );
      }
      return redirectToPricing(request);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/chat",
    "/chat/:path*",
    "/app",
    "/app/:path*",
    "/login",
    "/signup",
    "/pricing",
    "/api/intel/:path*",
    "/api/ledger/:path*",
    "/api/portfolio/:path*",
    "/api/account/:path*",
    "/api/chat/:path*",
    "/api/engine/:path*",
    "/api/hitl/:path*",
    "/api/funding/:path*",
    "/api/subscriptions/:path*",
    "/api/onboard/:path*",
    "/api/credits/:path*",
  ],
};
