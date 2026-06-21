export const PORTFOLIO_UPDATED_EVENT = "quant-portfolio-updated";

export function notifyPortfolioUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PORTFOLIO_UPDATED_EVENT));
  }
}
