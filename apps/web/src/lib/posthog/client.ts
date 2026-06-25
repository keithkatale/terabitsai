import posthog from "posthog-js";
import { readPostHogConfig } from "./config";

let initialized = false;

export function initPostHog(): typeof posthog | null {
  if (typeof window === "undefined" || initialized) {
    return initialized ? posthog : null;
  }

  const config = readPostHogConfig();
  if (!config) return null;

  posthog.init(config.key, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    defaults: "2026-01-30",
  });

  initialized = true;
  return posthog;
}

export function getPostHog(): typeof posthog | null {
  if (!initialized) return initPostHog();
  return posthog;
}
