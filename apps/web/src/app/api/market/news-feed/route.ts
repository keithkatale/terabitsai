import { NextRequest, NextResponse } from "next/server";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { prisma } from "@quant/db";
import { fetchYahooFinanceNews, fetchFinnhubNews, normalizeNews } from "@quant/market-intel";

export const dynamic = "force-dynamic";

interface NewsItem {
  title: string;
  source: string;
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  timestamp: string;
}

interface NewsFeedResponse {
  catalysts: string[];
  narrative: string;
  news: NewsItem[];
  social: {
    author: string;
    username: string;
    verified: boolean;
    text: string;
    cardTitle: string;
    cardDesc: string;
    cardImage: string;
    link: string;
  };
  expirationDays: number;
}

// Module-level in-memory cache for news feeds (resilient across Next dev session refreshes)
const newsFeedCache = new Map<string, { feed: Omit<NewsFeedResponse, "expirationDays">; expiresAt: number }>();

const DB_NEWS_TTL_MS = 30 * 60 * 1000;

async function feedFromDatabase(symbol: string): Promise<Omit<NewsFeedResponse, "expirationDays"> | null> {
  const since = new Date(Date.now() - DB_NEWS_TTL_MS);
  const rows = await prisma.marketNewsItem.findMany({
    where: { symbol, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5
  });
  if (rows.length === 0) return null;

  const news: NewsItem[] = rows.map((r) => ({
    title: r.headline,
    source: r.source,
    summary: r.summary,
    sentiment: r.sentiment as NewsItem["sentiment"],
    timestamp: r.publishedAt
      ? `${Math.max(1, Math.round((Date.now() - r.publishedAt.getTime()) / 3_600_000))}h ago`
      : "recent"
  }));

  const bullish = rows.filter((r) => r.sentiment === "bullish").length;
  const bearish = rows.filter((r) => r.sentiment === "bearish").length;
  const bias = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral";

  return {
    catalysts: [
      `News flow (${bias === "bullish" ? "Bullish" : bias === "bearish" ? "Bearish" : "Neutral"})`,
      `${rows.length} fresh headlines`,
      "Intel worker scan"
    ],
    narrative: `Latest persisted intelligence for ${symbol} from Yahoo, Finnhub, and scanner synthesis. ${news[0]?.summary ?? ""}`,
    news,
    social: {
      author: "Lumina Intelligence",
      username: "@LuminaIntel",
      verified: true,
      text: `Fresh ${symbol} headlines from the 24/7 intel worker. ${news[0]?.title ?? ""}`,
      cardTitle: `${symbol} Intelligence Brief`,
      cardDesc: "DB-backed market news from the intelligence scanner.",
      cardImage: getFallbackImage(symbol, symbol, "stock"),
      link: `lumina.market/${symbol.toLowerCase()}`
    }
  };
}

async function persistHeadlines(symbol: string, scanRunId?: string) {
  const [yahoo, finnhub] = await Promise.all([
    fetchYahooFinanceNews(symbol),
    fetchFinnhubNews(symbol)
  ]);
  const headlines = normalizeNews(symbol, yahoo, finnhub);
  for (const h of headlines) {
    await prisma.marketNewsItem.create({
      data: {
        symbol,
        headline: h.headline,
        summary: h.summary,
        sentiment: h.sentiment,
        source: h.source,
        url: h.url,
        category: "symbol",
        publishedAt: h.publishedAt,
        scanRunId: scanRunId ?? null
      }
    }).catch(() => {});
  }
}

/**
 * Aggregates recent headlines.
 */
async function getRecentNewsForSymbol(symbol: string): Promise<string> {
  const [yahooNews, finnhubNews] = await Promise.all([
    fetchYahooFinanceNews(symbol),
    fetchFinnhubNews(symbol)
  ]);

  const allArticles = [...yahooNews, ...finnhubNews];
  if (allArticles.length === 0) {
    return "No recent headlines found. Generate standard recent developments, macro catalysts, and typical sentiment for this asset class based on your knowledge base.";
  }
  return allArticles.join("\n");
}

const DEFAULT_FEEDS: Record<string, Omit<NewsFeedResponse, "expirationDays">> = {
  GOOGL: {
    catalysts: ["Cloud Infrastructure (Bullish)", "AI-Powered Ads (Bullish)", "Gemini Scaling (Bullish)"],
    narrative: "Alphabet's Cloud Segment margins continue to surprise on the upside. Enterprise GenAI deployments on Vertex AI have scaled 4.5x year-over-year, leading to a major re-rating of core infrastructure multiples. Strong ad spend recovery across retail and travel sectors remains a bedrock support.",
    news: [
      {
        title: "Alphabet Announces Premium Gemini Integration across Workspace Suite",
        source: "Bloomberg Finance",
        summary: "Google rolls out deep enterprise AI productivity enhancements, pushing higher margins and expanding software subscription pricing power.",
        sentiment: "bullish",
        timestamp: "2h ago"
      },
      {
        title: "Vertex AI Enterprise Spend Scales 4.5x in Q1 Infrastructure Audit",
        source: "S&P Global Market Intelligence",
        summary: "Latest spending reports reflect substantial enterprise transition into Vertex development pipelines, driving cloud server division revenue up.",
        sentiment: "bullish",
        timestamp: "5h ago"
      },
      {
        title: "Consensus Watch: Google Ad Spends Recover across Key Markets",
        source: "Reuters",
        summary: "Broad recovery in digital advertising spend across commerce and leisure sectors provides support for core Google advertising network channels.",
        sentiment: "neutral",
        timestamp: "8h ago"
      }
    ],
    social: {
      author: "Lumina Research",
      username: "@LuminaResearch",
      verified: true,
      text: "Google's TPU v5p cluster capacity is fully booked through Q4. Infrastructure margins are rising rapidly as training costs amortize. Very bullish on $GOOGL.",
      cardTitle: "AI Scaling Multiple Breakdown",
      cardDesc: "Deep dive into Cloud margins, TPU pricing, and Gemini API monetization trends.",
      cardImage: "https://images.unsplash.com/photo-1542744094-3a31f103e35f?auto=format&fit=crop&w=600&q=80",
      link: "lumina.market/googl-infra"
    }
  },
  AAPL: {
    catalysts: ["On-Device AI (Bullish)", "Service Monetization (Bullish)", "Upgrade Cycle (Bullish)"],
    narrative: "Apple's local LLM strategy (Apple Intelligence) is driving early signs of a multi-year iPhone upgrade supercycle. Service revenues reach new record highs with margins exceeding 72%, cementing the valuation floor even during hardware transition cycles.",
    news: [
      {
        title: "Apple Intelligence Beta Signals Massive Local Model Upgrade Demand",
        source: "TechCrunch",
        summary: "Developer sentiment checks indicate that on-device LLM integrations are driving high consumer interest, pointing to a strong hardware refresh cycle.",
        sentiment: "bullish",
        timestamp: "3h ago"
      },
      {
        title: "Services Division Margins Scale Past 72% as App Store Growth Firms",
        source: "Wall Street Journal",
        summary: "Apple's highly lucrative services arm reaches a new milestone, providing steady Cash Flow hedges and securing underlying valuation.",
        sentiment: "bullish",
        timestamp: "6h ago"
      },
      {
        title: "Supply Chain Reports: Apple Secures Multi-Year Chip Supply from TSMC",
        source: "Nikkei Asia",
        summary: "Apple cements silicon supremacy by booking exclusive TSMC 2nm wafer capacity, guaranteeing high-performance AI engines for upcoming cycles.",
        sentiment: "neutral",
        timestamp: "10h ago"
      }
    ],
    social: {
      author: "Apple Intelligence Insider",
      username: "@AppleInsider",
      verified: true,
      text: "Private Cloud Compute is a sleeper hit for Apple. Seamless integration of on-device & cloud models is showing massive retention. Upgrading target to bullish. $AAPL",
      cardTitle: "Private Cloud Compute Security Review",
      cardDesc: "Technical analysis of cryptographic verifiability in Apple's server clusters.",
      cardImage: "https://images.unsplash.com/photo-1510519138101-570d1dca3d66?auto=format&fit=crop&w=600&q=80",
      link: "insider.apple/pcc-verifiability"
    }
  },
  BTCUSD: {
    catalysts: ["Halving Amortization (Bullish)", "ETF Net Inflow (Bullish)", "Illiquid Supply High (Bullish)"],
    narrative: "Bitcoin continues to mature as a pristine global reserve asset. Spot ETF net inflows continue to absorb block rewards 1.8x faster than miners can produce, creating structural illiquid supply dynamics.",
    news: [
      {
        title: "Spot Bitcoin ETFs Register Largest Net Inflow in Two Weeks",
        source: "Bloomberg Finance",
        summary: "U.S. spot Bitcoin exchange-traded funds register over $480M in daily inflows, led by BlackRock's IBIT, absorbing mine supply at record rates.",
        sentiment: "bullish",
        timestamp: "2h ago"
      },
      {
        title: "Glassnode: Illiquid Supply Reaches New Historic Peak of 14.8M BTC",
        source: "Glassnode Analytics",
        summary: "On-chain wallet flows reflect extreme lockups from long-term holding cohorts, dramatically tightening liquid supply in secondary markets.",
        sentiment: "bullish",
        timestamp: "4h ago"
      },
      {
        title: "Macro Focus: Fed Chairman Comments Spark Short-Term Sideways Consolidation",
        source: "Reuters",
        summary: "Remarks indicating persistent interest rate parameters trigger minor rangebound trade before the next major institutional expansion.",
        sentiment: "neutral",
        timestamp: "8h ago"
      }
    ],
    social: {
      author: "Glassnode On-Chain",
      username: "@GlassnodeOnChain",
      verified: true,
      text: "Illiquid supply has reached an all-time high. Long-term holder cohort has stopped selling despite macroeconomic headwinds. Bullish divergence. $BTC",
      cardTitle: "BTC Illiquid Supply Divergence",
      cardDesc: "Analyzing exchange deposit addresses, HODL wallets, and custody trends.",
      cardImage: "https://images.unsplash.com/photo-1516245834210-c4c142787335?auto=format&fit=crop&w=600&q=80",
      link: "glassnode.com/btc-illiquid"
    }
  }
};

function getFallbackImage(symbol: string, name: string, assetClass: string): string {
  const sym = symbol.toUpperCase();
  const lowerName = name.toLowerCase();
  
  if (sym.includes("BTC") || lowerName.includes("bitcoin") || sym.includes("ETH") || sym.includes("SOL") || assetClass === "crypto") {
    return "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=600&q=80";
  }
  if (sym.includes("GOLD") || lowerName.includes("gold") || sym.includes("PAXG") || sym.includes("XAUT")) {
    return "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=600&q=80";
  }
  if (sym.includes("OIL") || lowerName.includes("crude") || lowerName.includes("energy") || assetClass === "commodity") {
    return "https://images.unsplash.com/photo-1518152006812-edab29b069ac?auto=format&fit=crop&w=600&q=80";
  }
  if (sym.includes("NVDA") || sym.includes("AMD") || sym.includes("INTC") || sym.includes("TSM") || lowerName.includes("semiconductor")) {
    return "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80";
  }
  if (sym.includes("AAPL") || sym.includes("MSFT") || sym.includes("GOOG") || sym.includes("META") || sym.includes("AMZN") || assetClass === "stock") {
    return "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80";
}

function getFallbackFeed(symbol: string, assetClass = "other", assetName = ""): Omit<NewsFeedResponse, "expirationDays"> {
  const sym = symbol.toUpperCase();
  if (DEFAULT_FEEDS[sym]) return DEFAULT_FEEDS[sym];

  const isCrypto = assetClass === "crypto" || sym.endsWith("USD") || sym.includes("BTC") || sym.includes("ETH");
  const isStock = assetClass === "stock" || sym.length <= 5;
  const name = assetName || symbol;

  return {
    catalysts: isCrypto
      ? ["Network Activity (Bullish)", "Decentralized Liquidity (Bullish)", "Adoption Curve (Bullish)"]
      : isStock
        ? ["EPS Resilience (Bullish)", "Operational Efficiencies (Bullish)", "Balance Sheet High (Bullish)"]
        : ["Macro Alignment (Bullish)", "Volume Expansion (Bullish)", "Liquidity Channel (Neutral)"],
    narrative: isCrypto
      ? `${name} is showing solid progress in daily active address growth and smart contract volume. Capital flows into Decentralized Finance and protocol integrations have formed an ascending floor.`
      : isStock
        ? `${name} operates a highly defensive business model with resilient recurring revenue pipelines. Recent restructuring efforts and automation implementations are expanding operating margins ahead of consensus estimates.`
        : `${name} continues to benefit from broader macroeconomic trends and localized supply-chain optimization. Trading volume has broken out of its 30-day average, signaling strong institutional accumulatory interest.`,
    news: [
      {
        title: `${name} (${sym}) Demonstrates Strong Volume Retracement above Main Averages`,
        source: "Capital Market Insider",
        summary: `Sustained trade interest triggers a structural bounce near key support lines for ${name}, pointing to a healthy consolidation zone.`,
        sentiment: "bullish",
        timestamp: "3h ago"
      },
      {
        title: "Institutional Block Flow Indexes Signal Steady Multi-Asset Capital Rotation",
        source: "Financial Times",
        summary: `Asset allocation indicators demonstrate subtle institutional rotation into top-tier liquid entities, reinforcing support across primary categories.`,
        sentiment: "neutral",
        timestamp: "6h ago"
      },
      {
        title: `Macro Summary: Sector Adaptability Tailwinds Form Solid Bedrock for ${name}`,
        source: "Reuters Markets",
        summary: `Strategic product revisions and structural cost-containment programs provide positive long-term momentum metrics for ${name}.`,
        sentiment: "bullish",
        timestamp: "12h ago"
      }
    ],
    social: {
      author: isCrypto ? "Web3 Intelligence" : isStock ? "Consensus Equity" : "Macro Catalyst Group",
      username: isCrypto ? "@Web3Intel" : isStock ? "@ConsensusEquity" : "@MacroCatalyst",
      verified: true,
      text: isCrypto
        ? `On-chain activity for $${sym} is forming a steady bull flag. Active wallets up 14% this week. Network security is pristine.`
        : isStock
          ? `${name} is displaying high operating leverage. Margin targets have been revised upward by major institutional brokers. Strong entry zone. $${sym}`
          : `Institutional flow data shows accumulation in ${name}. Momentum indicators are flipping bullish on the daily chart. Symbol $${sym}`,
      cardTitle: `${name} Performance Analysis`,
      cardDesc: "Full research review, financial models, volume tracking, and market positioning.",
      cardImage: getFallbackImage(symbol, name, assetClass),
      link: `${sym.toLowerCase()}-research.lumina.market`
    }
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const assetClass = searchParams.get("class")?.trim() || "other";
  const assetName = searchParams.get("name")?.trim() || "";
  const forceRefresh = searchParams.get("refresh") === "true";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  // 1. Check persisted DB news (intel worker)
  if (!forceRefresh) {
    try {
      const dbFeed = await feedFromDatabase(symbol);
      if (dbFeed) {
        return NextResponse.json({ success: true, feed: dbFeed, cached: true, source: "db" });
      }
    } catch {
      // fall through to cache / live fetch
    }
  }

  // 2. Check module-level in-memory cache
  const cached = newsFeedCache.get(symbol);
  if (cached && cached.expiresAt > Date.now() && !forceRefresh) {
    return NextResponse.json({
      success: true,
      feed: cached.feed,
      cached: true
    });
  }

  // 3. Fetch the news headlines as context
  const newsContext = await getRecentNewsForSymbol(symbol);

  // 4. Persist raw headlines for future DB reads
  persistHeadlines(symbol).catch(() => {});

  // 5. Construct prompt & system instruction for Gemini Vertex completion
  const systemInstruction = `You are a world-class financial analyst and AI researcher at Lumina Intelligence.
Your task is to generate a premium real-time market catalyst feed and a list of exactly 3 relevant news articles for a given asset symbol based on provided recent news headlines.

You MUST return a single JSON object matching this exact schema:
{
  "catalysts": [string, string, string], // Exactly 3 catalyst tags with a bullish/bearish/neutral tag in parentheses, e.g., "Earnings Surge (Bullish)" or "Supply Chain Pressure (Bearish)" or "Liquidity Support (Neutral)"
  "narrative": string, // A beautiful, premium 2-3 sentence market summary narrative. Explain the core catalyst driver and target outlook. Keep it realistic, premium, and professional.
  "news": [
    {
      "title": string, // Highly realistic, news headline of an event happening right now or recently for this asset.
      "source": string, // A plausible premium news publisher, e.g., "Bloomberg", "Wall Street Journal", "Reuters", "Financial Times", "Coindesk", etc.
      "summary": string, // A concise, engaging 1-2 sentence description summarizing the event details, the context, and its direct market implication.
      "sentiment": "bullish" | "bearish" | "neutral", // Sentiment tag
      "timestamp": string // Dynamic elapsed time, e.g., "2h ago", "5h ago", "12h ago"
    }
  ], // MUST contain exactly 3 news articles. Make sure each article is unique and highly specific to the given symbol.
  "social": {
    "author": string, // E.g., "Lumina Research" or "Autonomous Autonomy"
    "username": string, // E.g., "@LuminaResearch"
    "verified": boolean, // true or false
    "text": string, // A simulated high-quality post on X/Twitter about this asset's market dynamics. Include the symbol like $AAPL or $BTC.
    "cardTitle": string, // A rich card title for the linked research
    "cardDesc": string, // A short, engaging description for the card
    "cardImage": string, // A premium stock image URL from Unsplash. Use highly relevant financial/tech imagery.
    "link": string // A clean domain-relative link e.g. "lumina.market/aap-update"
  },
  "expirationDays": number // An integer between 1 and 7. Choose a lower number (1-3) if the news is highly volatile/short-term (like earnings release, CPI print, sudden crash), or a higher number (5-7) if it is structural/macro news.
}

IMPORTANT: Do not return any markdown code block fences (like \`\`\`json) or other text. Return ONLY the raw JSON string. Ensure the JSON is perfectly valid.`;

  const userPrompt = `
Generate a new catalyst feed for the asset symbol: ${symbol}.

RECENT MARKET HEADLINES / NEWS:
${newsContext}

Analyze the above headlines. Synthesize an updated, highly polished, real-time catalyst feed of what is driving this asset right now.
Return exactly the structured JSON object representing this news feed.
`;

  let newsFeed: NewsFeedResponse;
  let parsedSuccessfully = false;

  try {
    const rawResult = await generateVertexTextCompletion({
      userPrompt,
      systemInstruction,
      temperature: 0.2
    });

    const cleanJson = rawResult
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    newsFeed = JSON.parse(cleanJson);
    parsedSuccessfully = true;
  } catch (err) {
    console.error("Gemini news generation or parsing failed, using fallback feed:", err);
    const fallback = getFallbackFeed(symbol, assetClass, assetName);
    newsFeed = {
      ...fallback,
      expirationDays: 3
    };
  }

  // 4. Save to in-memory cache
  const expirationDays = Math.max(1, Math.min(7, newsFeed.expirationDays || 3));
  const expiresAt = Date.now() + expirationDays * 24 * 60 * 60 * 1000;
  const cachedFeedValue = {
    catalysts: newsFeed.catalysts,
    narrative: newsFeed.narrative,
    news: newsFeed.news || [],
    social: newsFeed.social
  };

  newsFeedCache.set(symbol, {
    feed: cachedFeedValue,
    expiresAt
  });

  return NextResponse.json({
    success: true,
    feed: cachedFeedValue,
    cached: !parsedSuccessfully
  });
}
