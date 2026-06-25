import { tradingViewAuthHint, tradingViewFetch } from "./client";

export const SCANNER_BASE = "https://scanner.tradingview.com";

const QUOTE_FIELDS = ["close", "change", "change_abs", "currency", "description"];

export type ScannerRow = Record<string, string | number | null> & { symbol: string };

export function buildTvSymbol(exchange: string, ticker: string): string {
  return `${exchange.toUpperCase()}:${ticker.toUpperCase()}`;
}

export function buildQuoteBody(exchange: string, ticker: string) {
  return {
    symbols: { tickers: [buildTvSymbol(exchange, ticker)], query: { types: [] } },
    columns: QUOTE_FIELDS,
  };
}

export function decodeScannerRows(payload: {
  fields?: string[];
  symbols?: Array<{ s: string; f?: unknown[] }>;
}): ScannerRow[] {
  const fields = payload?.fields ?? [];
  const symbols = payload?.symbols ?? [];
  return symbols.map((row) => {
    const out: ScannerRow = { symbol: row.s };
    for (let i = 0; i < fields.length; i++) {
      const v = row.f?.[i];
      out[fields[i]] = v == null ? null : typeof v === "number" ? v : String(v);
    }
    return out;
  });
}

export function buildScreenerBody(opts: {
  market: string;
  columns: string[];
  filter?: unknown[];
  filter2?: unknown;
  sort?: { sortBy: string; sortOrder?: "asc" | "desc" };
  limit?: number;
  offset?: number;
  tickers?: string[];
}) {
  const limit = Math.min(Math.max(1, Number(opts.limit) || 50), 500);
  const offset = Math.max(0, Number(opts.offset) || 0);
  const body: Record<string, unknown> = {
    markets: [String(opts.market).toLowerCase()],
    symbols:
      opts.tickers && opts.tickers.length
        ? { tickers: opts.tickers, query: { types: [] } }
        : { query: { types: [] } },
    options: { lang: "en" },
    columns: opts.columns,
    range: [offset, offset + limit],
  };
  if (opts.filter) body.filter = opts.filter;
  if (opts.filter2) body.filter2 = opts.filter2;
  if (opts.sort) {
    body.sort = { sortBy: opts.sort.sortBy, sortOrder: opts.sort.sortOrder ?? "desc" };
  }
  return body;
}

export async function scannerFetch(
  endpoint: string,
  body: Record<string, unknown>,
  opts: { labelProduct?: string } = {},
) {
  const labelProduct = opts.labelProduct ?? "symbols-options";
  const url = `${SCANNER_BASE}/${endpoint}?label-product=${encodeURIComponent(labelProduct)}`;
  const res = await tradingViewFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const hint = res.status === 401 || res.status === 403 ? ` ${tradingViewAuthHint()}` : "";
    throw new Error(`TradingView scanner ${res.status}: ${text.slice(0, 200)}.${hint}`);
  }
  return res.json();
}

function numericOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchTradingViewQuote(ticker: string, exchange = "NASDAQ") {
  const body = buildQuoteBody(exchange, ticker);
  const payload = await scannerFetch("global/scan2", body);
  const rows = decodeScannerRows(payload);
  if (rows.length === 0) {
    return { success: false as const, error: `No quote for ${exchange}:${ticker}` };
  }
  const row = rows[0];
  return {
    success: true as const,
    quote: {
      symbol: row.symbol,
      description: row.description ?? null,
      close: numericOrNull(row.close),
      change: numericOrNull(row.change),
      change_abs: numericOrNull(row.change_abs),
      currency: row.currency ?? null,
      time: (payload as { time?: number }).time ?? null,
    },
  };
}

export async function fetchTradingViewScreener(opts: {
  market?: string;
  columns?: string[];
  filter?: unknown[];
  sort?: string;
  tickers?: string[];
  limit?: number;
  offset?: number;
  labelProduct?: string;
}) {
  const market = (opts.market ?? "america").toLowerCase();
  const columns = opts.columns?.length
    ? opts.columns
    : ["name", "close", "change", "volume", "market_cap_basic", "sector.tr"];

  let sort: { sortBy: string; sortOrder?: "asc" | "desc" } | undefined;
  if (opts.sort) {
    const [field, order] = opts.sort.split(":");
    sort = { sortBy: field, sortOrder: (order === "asc" ? "asc" : "desc") as "asc" | "desc" };
  } else {
    sort = { sortBy: "volume", sortOrder: "desc" };
  }

  const body = buildScreenerBody({
    market,
    columns,
    filter: opts.filter,
    sort,
    tickers: opts.tickers,
    limit: opts.limit,
    offset: opts.offset,
  });

  const payload = await scannerFetch(`${encodeURIComponent(market)}/scan2`, body, {
    labelProduct: opts.labelProduct ?? "screener-stock",
  });

  return {
    success: true as const,
    market,
    totalCount: (payload as { totalCount?: number }).totalCount ?? null,
    rows: decodeScannerRows(payload),
  };
}

const CHAIN_FIELDS = [
  "ask", "bid", "currency", "delta", "expiration", "gamma", "iv",
  "option-type", "pricescale", "rho", "root", "strike", "theoPrice",
  "theta", "vega", "bid_iv", "ask_iv",
];

export function buildChainBody(exchange: string, ticker: string) {
  return {
    columns: CHAIN_FIELDS,
    ignore_unknown_fields: false,
    index_filters: [{ name: "underlying_symbol", values: [buildTvSymbol(exchange, ticker)] }],
    filter2: {
      operator: "and",
      operands: [{ expression: { left: "type", operation: "equal", right: "option" } }],
    },
  };
}

function expirationToIso(value: unknown): string {
  const s = String(value);
  if (!/^\d{8}$/.test(s)) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function daysToExpiry(iso: string, now = new Date()): number {
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

export type OptionsChainRow = {
  expiry: string;
  dte: number;
  strike: number | null;
  type: "call" | "put";
  bid: number | null;
  ask: number | null;
  mid: number | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  symbol: string;
};

function normalizeChainRow(raw: ScannerRow, now = new Date()): OptionsChainRow {
  const expiry = expirationToIso(raw.expiration);
  const bid = numericOrNull(raw.bid);
  const ask = numericOrNull(raw.ask);
  const opraType = String(raw["option-type"] ?? "").toLowerCase();
  return {
    expiry,
    dte: daysToExpiry(expiry, now),
    strike: numericOrNull(raw.strike),
    type: opraType === "call" ? "call" : "put",
    bid,
    ask,
    mid: bid != null && ask != null ? (bid + ask) / 2 : null,
    iv: numericOrNull(raw.iv),
    delta: numericOrNull(raw.delta),
    gamma: numericOrNull(raw.gamma),
    theta: numericOrNull(raw.theta),
    vega: numericOrNull(raw.vega),
    symbol: raw.symbol,
  };
}

function strikesAroundSpot(rows: OptionsChainRow[], spot: number, halfBand: number): OptionsChainRow[] {
  if (halfBand <= 0) return rows;
  const groups = new Map<string, OptionsChainRow[]>();
  for (const r of rows) {
    const key = `${r.expiry}|${r.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const out: OptionsChainRow[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => (a.strike ?? 0) - (b.strike ?? 0));
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < group.length; i++) {
      const d = Math.abs((group[i].strike ?? 0) - spot);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const lo = Math.max(0, bestIdx - halfBand);
    const hi = Math.min(group.length, bestIdx + halfBand + 1);
    out.push(...group.slice(lo, hi));
  }
  return out;
}

export async function fetchTradingViewOptionsChain(opts: {
  ticker: string;
  exchange?: string;
  expiry?: string;
  type?: "call" | "put";
  strikesAroundSpot?: number;
}) {
  const ticker = opts.ticker.toUpperCase();
  const exchange = (opts.exchange ?? "NASDAQ").toUpperCase();
  const halfBand = opts.strikesAroundSpot ?? 6;

  const [chainPayload, quotePayload] = await Promise.all([
    scannerFetch("options/scan2", buildChainBody(exchange, ticker)),
    scannerFetch("global/scan2", buildQuoteBody(exchange, ticker)),
  ]);

  let rows = decodeScannerRows(chainPayload).map((r) => normalizeChainRow(r));
  if (rows.length === 0) {
    return { success: false as const, error: `Empty options chain for ${exchange}:${ticker}` };
  }

  rows = rows.filter((r) => r.dte >= 0);
  if (opts.expiry) rows = rows.filter((r) => r.expiry === opts.expiry);
  if (opts.type) rows = rows.filter((r) => r.type === opts.type);

  if (halfBand > 0) {
    const quoteRows = decodeScannerRows(quotePayload);
    const spot = Number(quoteRows[0]?.close);
    if (Number.isFinite(spot)) {
      rows = strikesAroundSpot(rows, spot, halfBand);
    }
  }

  rows.sort(
    (a, b) => a.expiry.localeCompare(b.expiry) || (a.strike ?? 0) - (b.strike ?? 0) || a.type.localeCompare(b.type),
  );

  return { success: true as const, underlying: `${exchange}:${ticker}`, chain: rows };
}
