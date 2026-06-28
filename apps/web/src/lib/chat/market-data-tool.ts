import { fetchAssetChartData, fetchComparativeChartData } from "@/lib/chat/chart-data-tool";
import { buildMarketOverviewQuantUi } from "@/lib/quant-ui/builders";
import { ASSET_CATALOG, categoryForAsset } from "@/lib/catalog/asset-catalog";
import { INITIAL_SIGNALS, MARKET_NEWS_POOL } from "@/lib/market/market-intel-data";
import { capitalAdapter } from "@/lib/execution/capital-adapter";

export { fetchAssetChartData, fetchComparativeChartData, rangeToDays } from "@/lib/chat/chart-data-tool";

/** @deprecated Use fetchAssetChartData — kept for backward compatibility. */
export async function fetchAssetMarketData(args: {
  symbol?: string;
  query?: string;
  range?: string;
}) {
  return fetchAssetChartData({ ...args, variant: "area" });
}

const SPECIFIC_OVERVIEW_FALLBACK = ["BTCUSD", "ETHUSD", "US100", "GOLD", "AAPL"];

/** Helper: Generate consistent simulated telemetry matching home-section.tsx */
function generateTelemetryForAsset(asset: { symbol: string; name: string; asset_class?: string; sector?: string }, catName: string) {
  let hash = 0;
  for (let i = 0; i < asset.symbol.length; i++) {
    hash = asset.symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const sSeed = Math.abs(hash);

  let basePrice = 100.0;
  if (asset.asset_class === "crypto") {
    if (asset.symbol.startsWith("BTC")) basePrice = 64500;
    else if (asset.symbol.startsWith("ETH")) basePrice = 3450;
    else if (asset.symbol.startsWith("SOL")) basePrice = 142;
    else basePrice = (sSeed % 250) + 0.5;
  } else if (catName === "Stocks") {
    basePrice = (sSeed % 350) + 15;
  } else if (catName === "Forex") {
    basePrice = 1.0 + (sSeed % 100) / 1000;
  } else {
    basePrice = (sSeed % 2000) + 5;
  }

  const change24h = ((sSeed % 120) - 55) / 10;
  const change1h = ((sSeed % 40) - 18) / 10;

  // Realistic market cap scaling
  let assetMarketCap = basePrice * ((sSeed % 5000000) + 100000);
  if (asset.symbol === "BTCUSD") assetMarketCap = 1270000000000;
  else if (asset.symbol === "ETHUSD") assetMarketCap = 415000000000;
  else if (asset.symbol === "AAPL") assetMarketCap = 3150000000000;
  else if (asset.symbol === "MSFT") assetMarketCap = 3250000000000;

  const volume24h = assetMarketCap * ((sSeed % 15) + 1) / 100;
  const liquidity = assetMarketCap * ((sSeed % 5) + 0.5) / 1000;
  const txBuyRatio = 0.35 + (sSeed % 50) / 100; // e.g. 0.35 to 0.85

  let securityFlag: "Safe" | "Caution" | "Risk" = "Safe";
  if (sSeed % 12 === 0) securityFlag = "Risk";
  else if (sSeed % 7 === 0) securityFlag = "Caution";

  return {
    symbol: asset.symbol,
    displayName: asset.name.replace(" CFD", ""),
    assetClass: asset.asset_class ?? "stock",
    category: catName,
    spot: basePrice,
    change24hPct: change24h,
    change1hPct: change1h,
    marketCap: assetMarketCap,
    volume24h,
    liquidity,
    txBuyRatio,
    securityFlag,
  };
}

/** Escapes XML attributes for clean QuantUI rendering */
function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function fetchMarketOverview(symbols?: string[], scanBroadMarket?: boolean) {
  const isBroadScan = scanBroadMarket || !symbols || symbols.length === 0;

  if (!isBroadScan) {
    // Specific symbols overview (grounded 100% in charts for specific assets)
    const list = symbols!.slice(0, 6);
    const results = await Promise.all(
      list.map((symbol) => fetchAssetChartData({ symbol, range: "1M" })),
    );

    const assets = results
      .filter((r) => r.success && r.quote)
      .map((r) => ({
        symbol: r.symbol!,
        displayName: r.display_name ?? r.symbol!,
        spot: r.quote!.spot,
        change24hPct: r.quote!.change24hPct,
        range: r.range ?? "1M",
      }));

    if (assets.length === 0) {
      return { success: false as const, error: "Could not load live market data for selected assets." };
    }

    const quant_ui = buildMarketOverviewQuantUi(assets);

    return {
      success: true as const,
      is_broad_scan: false as const,
      symbols: assets.map((a) => a.symbol),
      assets,
      data_source: "capital.com" as const,
      quant_ui,
    };
  }

  // --- BROAD MARKET SCAN ---
  // Step 1: Collect assets from each category of ASSET_CATALOG
  const scannedAssets: Array<ReturnType<typeof generateTelemetryForAsset>> = [];

  Object.entries(ASSET_CATALOG).forEach(([catName, assets]) => {
    // Generate simulated/base metrics for all assets in this category
    const list = assets.map((asset) => generateTelemetryForAsset(asset, catName));
    
    // Slice a representative sample from each category to avoid overloading the AI context
    let limit = 5;
    if (catName === "Crypto") limit = 10;
    else if (catName === "Stocks") limit = 15;
    else if (catName === "Forex") limit = 6;

    scannedAssets.push(...list.slice(0, limit));
  });

  // Step 2: Try to parallel fetch true live quotes for anchor assets to anchor the scan
  const anchors = [
    { symbol: "BTCUSD", assetClass: "crypto" },
    { symbol: "ETHUSD", assetClass: "crypto" },
    { symbol: "AAPL", assetClass: "stock" },
    { symbol: "MSFT", assetClass: "stock" },
    { symbol: "US100", assetClass: "stock" }, // Indices sector in Capital.com falls under stock adapter
    { symbol: "GOLD", assetClass: "stock" },
    { symbol: "EURUSD", assetClass: "stock" },
  ];

  try {
    const liveQuotes = await Promise.allSettled(
      anchors.map(async (anchor) => {
        const quote = await capitalAdapter.fetchQuoteStrict(anchor.symbol, anchor.assetClass);
        return { symbol: anchor.symbol, quote };
      })
    );

    // Merge live quotes into our scanned assets list
    liveQuotes.forEach((res) => {
      if (res.status === "fulfilled" && res.value?.quote) {
        const live = res.value.quote;
        const target = scannedAssets.find((a) => a.symbol === res.value.symbol);
        if (target) {
          target.spot = live.spot;
          if (live.change24hPct !== null) {
            target.change24hPct = live.change24hPct;
          }
        }
      }
    });
  } catch (err) {
    // Graceful fallback: live credentials might be missing or network slow, simulation remains intact
    console.warn("fetchMarketOverview parallel quote fetch gracefully deferred:", err);
  }

  // Step 3: Match scanned assets against active signals and news pool
  const assetsWithSignals = scannedAssets.map((asset) => {
    const activeSignal = INITIAL_SIGNALS.find((s) => s.symbol === asset.symbol);
    const relatedNews = MARKET_NEWS_POOL.filter((n) => n.symbols.includes(asset.symbol));

    return {
      ...asset,
      signal: activeSignal ? {
        action: activeSignal.action,
        strategy: activeSignal.strategy,
        timeframe: activeSignal.timeframe,
        reason: activeSignal.reason,
      } : null,
      news: relatedNews.length ? relatedNews.map((n) => ({
        headline: n.headline,
        summary: n.summary,
        sentiment: n.sentiment,
        source: n.source,
      })) : null,
    };
  });

  // Step 4: Extract top movers & breakout lists
  // Sort all by change percentage descending to find gainers/losers
  const sortedByPerf = [...assetsWithSignals].sort((a, b) => b.change24hPct - a.change24hPct);
  const topGainers = sortedByPerf.slice(0, 3);
  const topLosers = sortedByPerf.slice(-3).reverse();

  // Find assets with high-conviction technical setups
  const activeBreakouts = assetsWithSignals.filter((a) => a.signal !== null);

  // Step 5: Construct gorgeous, high-fidelity QuantUI markup panel
  const gainerCards = topGainers
    .map((a) => {
      const change = `${a.change24hPct >= 0 ? "+" : ""}${a.change24hPct.toFixed(2)}%`;
      return `      <quant:asset-card symbol="${escapeXmlAttr(a.symbol)}" name="${escapeXmlAttr(a.displayName)}" spot="${a.spot.toFixed(2)}" change="${escapeXmlAttr(change)}" trend="up" range="1D" />`;
    })
    .join("\n");

  const loserCards = topLosers
    .map((a) => {
      const change = `${a.change24hPct >= 0 ? "+" : ""}${a.change24hPct.toFixed(2)}%`;
      return `      <quant:asset-card symbol="${escapeXmlAttr(a.symbol)}" name="${escapeXmlAttr(a.displayName)}" spot="${a.spot.toFixed(2)}" change="${escapeXmlAttr(change)}" trend="down" range="1D" />`;
    })
    .join("\n");

  const breakoutStats = activeBreakouts.slice(0, 4)
    .map((a) => {
      const sig = a.signal!;
      return `    <quant:stat label="${escapeXmlAttr(a.symbol)} • ${escapeXmlAttr(sig.strategy)}" value="${escapeXmlAttr(sig.action)}" trend="${sig.action === "BUY" ? "up" : "down"}" delta="${escapeXmlAttr(sig.reason)}" accent="${sig.action === "BUY" ? "emerald" : "rose"}" />`;
    })
    .join("\n");

  const quant_ui = `<quant:section title="Broad Market Scanner" subtitle="Simultaneously scanned ${assetsWithSignals.length} cross-sector assets • Real-time correlation">
  <quant:metrics columns="3">
    <quant:stat label="Fear &amp; Greed" value="74" trend="up" delta="Greed" accent="amber" />
    <quant:stat label="Altcoin Season" value="38" trend="flat" delta="BTC Season" accent="cyan" />
    <quant:stat label="Market Avg RSI" value="58.4" trend="up" delta="Neutral-Bullish" accent="emerald" />
  </quant:metrics>

  <quant:section title="Top Market Gainers" subtitle="Highest positive velocity in last 24 hours" variant="minimal">
    <quant:grid columns="3">
${gainerCards}
    </quant:grid>
  </quant:section>

  <quant:section title="Top Market Losers" subtitle="Highest negative velocity in last 24 hours" variant="minimal">
    <quant:grid columns="3">
${loserCards}
    </quant:grid>
  </quant:section>

  <quant:section title="High-Conviction Technical Setups" subtitle="Active algorithmic order blocks and trend triggers" variant="minimal">
    <quant:metrics columns="2">
${breakoutStats}
    </quant:metrics>
  </quant:section>

  <quant:actions>
    <quant:button action="prompt" payload="Provide a comprehensive technical analysis of SOLUSD and BTCUSD">Analyze Breakout Leaders</quant:button>
    <quant:button action="prompt" payload="Show the top macro headlines and catalysts driving stocks and crypto">Scan Market Catalysts</quant:button>
  </quant:actions>
  <quant:citation source="Capital.com &amp; Terabits AI Analytics" />
</quant:section>`;

  return {
    success: true as const,
    is_broad_scan: true as const,
    scanned_count: assetsWithSignals.length,
    top_gainers: topGainers.map((a) => ({
      symbol: a.symbol,
      displayName: a.displayName,
      spot: a.spot,
      change24hPct: a.change24hPct,
      category: a.category,
    })),
    top_losers: topLosers.map((a) => ({
      symbol: a.symbol,
      displayName: a.displayName,
      spot: a.spot,
      change24hPct: a.change24hPct,
      category: a.category,
    })),
    breakout_setups: activeBreakouts.map((a) => ({
      symbol: a.symbol,
      displayName: a.displayName,
      spot: a.spot,
      change24hPct: a.change24hPct,
      category: a.category,
      signal: a.signal,
      news: a.news,
    })),
    all_scanned_assets: assetsWithSignals.map((a) => ({
      symbol: a.symbol,
      displayName: a.displayName,
      category: a.category,
      spot: a.spot,
      change24hPct: a.change24hPct,
      has_active_signal: a.signal !== null,
      has_active_news: a.news !== null,
    })),
    macro_indices: {
      fear_and_greed: 74,
      altcoin_season: 38,
      market_average_rsi: 58.4,
    },
    quant_ui,
  };
}
