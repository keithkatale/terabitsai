"use client";

import * as React from "react";
import { AssetComparativeChart } from "./asset-comparative-chart";
import { AssetPriceChart } from "./asset-price-chart";
import { AssetCatalogGrid } from "./asset-catalog-grid";
import { PortfolioBreakdown } from "./portfolio-breakdown";
import { TransactionSummary } from "./transaction-summary";
import { TradeConfirmationWidget } from "./trade-confirmation-widget";
import { GoalProgressWidget } from "./goal-progress-widget";
import { TradingViewChart } from "./tradingview-chart";

interface GenerativeUiRegistryProps {
  name: string;
  props?: any;
}

const COMPONENT_ALIASES: Record<string, string> = {
  assetpricechart: "AssetPriceChart",
  asset_price_chart: "AssetPriceChart",
  assetcomparativechart: "AssetComparativeChart",
  asset_comparative_chart: "AssetComparativeChart",
  assetcataloggrid: "AssetCatalogGrid",
  portfoliobreakdown: "PortfolioBreakdown",
  transactionsummary: "TransactionSummary",
  tradeconfirmation: "TradeConfirmationWidget",
  tradeconfirmationwidget: "TradeConfirmationWidget",
  goalprogress: "GoalProgressWidget",
  goalprogresswidget: "GoalProgressWidget",
  tradingviewchart: "TradingViewChart",
  trading_view_chart: "TradingViewChart",
};

export function normalizeComponentName(name: string): string {
  const trimmed = name.trim();
  const alias = COMPONENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return trimmed;
}

export function GenerativeUiRegistry({ name, props = {} }: GenerativeUiRegistryProps) {
  const resolved = normalizeComponentName(name);
  const cleanProps =
    props && typeof props === "object"
      ? Object.fromEntries(Object.entries(props).filter(([k]) => k !== "component" && k !== "name" && k !== "type"))
      : props;

  switch (resolved) {
    case "AssetCatalogGrid":
      return <AssetCatalogGrid {...cleanProps} />;
    case "AssetComparativeChart":
      return <AssetComparativeChart {...cleanProps} />;
    case "AssetPriceChart":
      return <AssetPriceChart {...cleanProps} />;
    case "PortfolioBreakdown":
      return <PortfolioBreakdown {...cleanProps} />;
    case "TransactionSummary":
      return <TransactionSummary {...cleanProps} />;
    case "TradeConfirmation":
    case "TradeConfirmationWidget":
      return <TradeConfirmationWidget {...cleanProps} />;
    case "GoalProgress":
    case "GoalProgressWidget":
      return <GoalProgressWidget {...cleanProps} />;
    case "TradingViewChart":
      return <TradingViewChart {...cleanProps} />;
    default:
      return (
        <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-mono my-2 text-left">
          <p className="font-bold">Error: Unknown Generative UI Component</p>
          <p className="mt-1 text-[10px] text-zinc-500">The component name &quot;{resolved}&quot; could not be matched with any prebuilt dashboard widget.</p>
        </div>
      );
  }
}
