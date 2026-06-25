"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PostHogUserSync() {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    const supabase = createSupabaseBrowserClient();

    const syncUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        posthog.identify(user.id, {
          email: user.email,
        });
      } else {
        posthog.reset();
      }
    };

    void syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        posthog.identify(user.id, {
          email: user.email,
        });
      } else {
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [posthog]);

  return null;
}
