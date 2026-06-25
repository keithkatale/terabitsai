import { getPostHog } from "./client";

export const AnalyticsEvents = {
  TAB_CHANGED: "app_tab_changed",
  CHART_ANALYZED: "chart_analyzed",
  CHAT_MESSAGE_SENT: "chat_message_sent",
  ONBOARDING_COMPLETED: "onboarding_completed",
  CTA_CLICKED: "cta_clicked",
  MARKETS_PANEL_CHANGED: "markets_panel_changed",
} as const;

export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  try {
    getPostHog()?.capture(event, properties);
  } catch {
    /* non-fatal */
  }
}
