"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { initPostHog } from "@/lib/posthog/client";
import { readPostHogConfig } from "@/lib/posthog/config";
import { PostHogPageView } from "./posthog-pageview";
import { PostHogUserSync } from "./posthog-user-sync";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<typeof posthog | null>(null);

  useEffect(() => {
    if (!readPostHogConfig()) return;
    const ph = initPostHog();
    if (ph) setClient(ph);
  }, []);

  if (!client) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={client}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogUserSync />
      {children}
    </PHProvider>
  );
}
