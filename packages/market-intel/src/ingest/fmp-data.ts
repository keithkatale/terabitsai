const FMP_BASE = "https://financialmodelingprep.com/api/v3";

function fmpKey(): string | undefined {
  return process.env.FMP_API_KEY;
}

export async function fetchFmpInsiderTrades(symbol: string): Promise<
  Array<{
    symbol: string;
    transactionType?: string;
    securitiesTransacted?: number;
    price?: number;
    reportingName?: string;
    transactionDate?: string;
  }>
> {
  const key = fmpKey();
  if (!key) return [];
  try {
    const url = `${FMP_BASE}/insider-trading?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const raw = (await res.json()) as Array<Record<string, unknown>>;
    return raw.map((row) => ({
      symbol: String(row.symbol ?? symbol),
      transactionType: row.transactionType ? String(row.transactionType) : undefined,
      securitiesTransacted: row.securitiesTransacted != null ? Number(row.securitiesTransacted) : undefined,
      price: row.price != null ? Number(row.price) : undefined,
      reportingName: row.reportingName ? String(row.reportingName) : undefined,
      transactionDate: row.transactionDate ? String(row.transactionDate) : undefined
    }));
  } catch {
    return [];
  }
}

export async function fetchFmpTranscript(symbol: string, year?: number, quarter?: number): Promise<string | null> {
  const key = fmpKey();
  if (!key) return null;
  const y = year ?? new Date().getFullYear();
  const q = quarter ?? Math.ceil((new Date().getMonth() + 1) / 3);
  try {
    const url = `${FMP_BASE}/earning_call_transcript/${encodeURIComponent(symbol)}?year=${y}&quarter=${q}&apikey=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ content?: string }>;
    return data[0]?.content ?? null;
  } catch {
    return null;
  }
}

export async function fetchFmp13FHolders(symbol: string): Promise<
  Array<{ holder?: string; shares?: number; change?: number; dateReported?: string }>
> {
  const key = fmpKey();
  if (!key) return [];
  try {
    const url = `${FMP_BASE}/institutional-holder/${encodeURIComponent(symbol)}?apikey=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}
