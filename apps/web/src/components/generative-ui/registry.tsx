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
import { GenUiErrorBoundary } from "./genui-error-boundary";
import { QuantUiFailure } from "@/components/quant-ui/quant-ui-failure";

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

const KNOWN_COMPONENTS = new Set([
  "AssetCatalogGrid",
  "AssetComparativeChart",
  "AssetPriceChart",
  "PortfolioBreakdown",
  "TransactionSummary",
  "TradeConfirmationWidget",
  "GoalProgressWidget",
  "TradingViewChart",
]);

export function normalizeComponentName(name: string): string {
  const trimmed = name.trim();
  const alias = COMPONENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return trimmed;
}

function validateProps(componentName: string, props: Record<string, unknown>): string | null {
  switch (componentName) {
    case "AssetPriceChart":
      if (!props.symbol) return "Missing required 'symbol' prop";
      break;
    case "AssetComparativeChart":
      if (!props.symbol1 || !props.symbol2) return "Missing required 'symbol1' or 'symbol2' props";
      break;
    case "TradeConfirmationWidget":
      if (!props.symbol) return "Missing required 'symbol' prop";
      break;
    case "GoalProgressWidget":
      if (!props.goalId && !props.mode) return "Missing required 'goalId' or 'mode' props";
      break;
  }
  return null;
}

export function GenerativeUiRegistry({ name, props = {} }: GenerativeUiRegistryProps) {
  const resolved = normalizeComponentName(name);
  const cleanProps =
    props && typeof props === "object"
      ? Object.fromEntries(Object.entries(props).filter(([k]) => k !== "component" && k !== "name" && k !== "type"))
      : props;

  // Check for unknown component
  if (!KNOWN_COMPONENTS.has(resolved)) {
    const suggestions = [...KNOWN_COMPONENTS].filter(
      (c) => c.toLowerCase().includes(resolved.toLowerCase().replace(/[^a-z]/g, ""))
    );
    
    return (
      <QuantUiFailure
        title="Unknown component requested"
        reason={`The component "${resolved}" is not available.${suggestions.length > 0 ? ` Did you mean: ${suggestions.join(", ")}?` : ""}`}
        errorDetails={`Available components: ${[...KNOWN_COMPONENTS].join(", ")}`}
        rawPayload={JSON.stringify({ name, props }, null, 2)}
      />
    );
  }

  // Validate required props
  const propError = validateProps(resolved, cleanProps);
  if (propError) {
    return (
      <QuantUiFailure
        title="Invalid component props"
        reason={propError}
        errorDetails={`Component ${resolved} received invalid props`}
        rawPayload={JSON.stringify({ name, props }, null, 2)}
      />
    );
  }

  // Wrap in error boundary to catch runtime errors
  return (
    <GenUiErrorBoundary
      fallbackTitle={`${resolved} failed to render`}
      rawPayload={JSON.stringify({ name, props }, null, 2)}
    >
      <RegistryComponent name={resolved} props={cleanProps} />
    </GenUiErrorBoundary>
  );
}

function RegistryComponent({ name, props }: { name: string; props: any }) {
  switch (name) {
    case "AssetCatalogGrid":
      return <AssetCatalogGrid {...props} />;
    case "AssetComparativeChart":
      return <AssetComparativeChart {...props} />;
    case "AssetPriceChart":
      return <AssetPriceChart {...props} />;
    case "PortfolioBreakdown":
      return <PortfolioBreakdown {...props} />;
    case "TransactionSummary":
      return <TransactionSummary {...props} />;
    case "TradeConfirmationWidget":
      return <TradeConfirmationWidget {...props} />;
    case "GoalProgressWidget":
      return <GoalProgressWidget {...props} />;
    case "TradingViewChart":
      return <TradingViewChart {...props} />;
    default:
      return null;
  }
}
