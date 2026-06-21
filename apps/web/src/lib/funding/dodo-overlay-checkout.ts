"use client";

import { DodoPayments, type CheckoutEvent } from "dodopayments-checkout";

type DodoCheckoutMode = "test" | "live";

let initialized = false;
let initializedMode: DodoCheckoutMode | null = null;

export function ensureDodoOverlayCheckout(
  mode: DodoCheckoutMode,
  onEvent: (event: CheckoutEvent) => void,
) {
  if (initialized && initializedMode === mode) return;

  DodoPayments.Initialize({
    mode,
    displayType: "overlay",
    onEvent,
  });

  initialized = true;
  initializedMode = mode;
}

export async function openDodoOverlayCheckout(checkoutUrl: string) {
  await DodoPayments.Checkout.open({
    checkoutUrl,
    options: {
      themeConfig: {
        dark: {
          bgPrimary: "#0A0D10",
          bgSecondary: "#121820",
          borderPrimary: "#1c232b",
          textPrimary: "#FFFFFF",
          textSecondary: "#CED8E1",
          buttonPrimary: "#2EC9FF",
          buttonPrimaryHover: "#5DD8FF",
          buttonTextPrimary: "#000000",
        },
        radius: "16px",
      },
    },
  });
}
