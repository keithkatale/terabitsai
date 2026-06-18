export type MarketSignalDirection = "bullish" | "bearish" | "neutral"

/** Matches persisted rows + consumer DTO shape */
export type MarketSignalDTO = {
  id: string
  cluster: string
  title: string
  primary_symbol: string
  symbols: string[]
  direction: MarketSignalDirection
  confidence: number
  teaser: string
  rationale_short: string
  domain: string | null
  snapshot_id?: string | null
  created_at?: string
}
