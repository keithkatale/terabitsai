/** Actions dispatched from GenUI widgets and sandboxed HTML artifacts back to Command chat. */

export type WidgetAction =
  | { type: "prompt"; prompt: string }
  | { type: "custom"; action: string; data?: unknown };

export const QUANT_WIDGET_ACTION_EVENT = "quant-widget-action";

export function dispatchWidgetAction(action: WidgetAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(QUANT_WIDGET_ACTION_EVENT, { detail: action }),
  );
}
