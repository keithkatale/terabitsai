"use client";

import * as React from "react";
import { AssetComparativeChart } from "./asset-comparative-chart";
import { PortfolioBreakdown } from "./portfolio-breakdown";
import { TransactionSummary } from "./transaction-summary";
import { TradeConfirmationWidget } from "./trade-confirmation-widget";

interface GenerativeUiRegistryProps {
  name: string;
  props?: any;
}

export function GenerativeUiRegistry({ name, props = {} }: GenerativeUiRegistryProps) {
  switch (name) {
    case "AssetComparativeChart":
      return <AssetComparativeChart {...props} />;
    case "PortfolioBreakdown":
      return <PortfolioBreakdown {...props} />;
    case "TransactionSummary":
      return <TransactionSummary {...props} />;
    case "TradeConfirmation":
    case "TradeConfirmationWidget":
      return <TradeConfirmationWidget {...props} />;
    default:
      return (
        <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-mono my-2 text-left">
          <p className="font-bold">Error: Unknown Generative UI Component</p>
          <p className="mt-1 text-[10px] text-zinc-500">The component name &quot;{name}&quot; could not be matched with any prebuilt dashboard widget.</p>
        </div>
      );
  }
}
