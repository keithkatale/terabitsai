/** Server-side PostHog public config (safe to expose in the browser). */
export function readPostHogPublicEnv(): { key: string; host: string } | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  return {
    key,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  };
}

declare global {
  interface Window {
    __TERABITS_POSTHOG__?: { key: string; host: string };
  }
}

/** Client-side config — prefers runtime injection from PostHogConfigScript. */
export function readPostHogConfig(): { key: string; host: string } | null {
  if (typeof window !== "undefined" && window.__TERABITS_POSTHOG__?.key) {
    return window.__TERABITS_POSTHOG__;
  }
  return readPostHogPublicEnv();
}
