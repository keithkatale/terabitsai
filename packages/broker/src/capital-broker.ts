import type { ExecutionResult, OpenPosition, SizedOrder } from "@quant/contracts"

export type CapitalBrokerConfig = {
  apiKey: string
  password: string
  identifier: string
  baseUrl?: string
}

export type CapitalQuote = {
  symbol: string
  bid: number
  ask: number
  spot: number
  change24hPct: number | null
}

export type CapitalCandle = {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export type BrokerAccount = {
  accountId: string
  balance: number
  currency: string
  available: number
  profitLoss: number
}

const DEMO_BASE_URL = "https://demo-api-capital.backend-capital.com"

export class CapitalBroker {
  private cstToken: string | null = null
  private xSecurityToken: string | null = null
  private killSwitch = false

  constructor(private readonly config: CapitalBrokerConfig) {}

  get baseUrl(): string {
    return this.config.baseUrl ?? DEMO_BASE_URL
  }

  activateKillSwitch(): void {
    this.killSwitch = true
  }

  deactivateKillSwitch(): void {
    this.killSwitch = false
  }

  isKillSwitchActive(): boolean {
    return this.killSwitch
  }

  static fromEnv(): CapitalBroker {
    const apiKey = process.env.CAPITAL_API_KEY
    const password = process.env.CAPITAL_PASSWORD
    const identifier = process.env.CAPITAL_IDENTIFIER
    if (!apiKey || !password || !identifier) {
      throw new Error(
        "Missing CAPITAL_API_KEY, CAPITAL_PASSWORD, or CAPITAL_IDENTIFIER"
      )
    }
    return new CapitalBroker({
      apiKey,
      password,
      identifier,
      baseUrl: process.env.CAPITAL_BASE_URL
    })
  }

  private async ensureSession(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/session`, {
      method: "POST",
      headers: {
        "X-CAP-API-KEY": this.config.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        identifier: this.config.identifier,
        password: this.config.password,
        encryptedPassword: false
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        `Capital.com session failed: ${(err as { errorCode?: string }).errorCode ?? res.status}`
      )
    }

    this.cstToken = res.headers.get("cst") || res.headers.get("CST")
    this.xSecurityToken =
      res.headers.get("x-security-token") || res.headers.get("X-SECURITY-TOKEN")

    if (!this.cstToken || !this.xSecurityToken) {
      throw new Error("Missing session tokens from Capital.com")
    }
  }

  private authHeaders(): Record<string, string> {
    if (!this.cstToken || !this.xSecurityToken) {
      throw new Error("Capital.com session not established")
    }
    return {
      CST: this.cstToken,
      "X-SECURITY-TOKEN": this.xSecurityToken,
      "X-CAP-API-KEY": this.config.apiKey
    }
  }

  async fetchQuote(symbol: string): Promise<CapitalQuote> {
    await this.ensureSession()
    const res = await fetch(
      `${this.baseUrl}/api/v1/markets/${encodeURIComponent(symbol)}`,
      { headers: this.authHeaders() }
    )
    if (!res.ok) {
      throw new Error(`Quote fetch failed for ${symbol}: HTTP ${res.status}`)
    }
    const data = await res.json()
    const bid = Number(data.snapshot?.bid)
    const ask = Number(data.snapshot?.offer)
    return {
      symbol,
      bid,
      ask,
      spot: (bid + ask) / 2,
      change24hPct: Number(data.snapshot?.netChangePercent) || null
    }
  }

  async fetchCandles(
    symbol: string,
    resolution: "MINUTE_5" | "MINUTE_15" | "HOUR" | "DAY" = "HOUR",
    max = 200
  ): Promise<CapitalCandle[]> {
    await this.ensureSession()
    const res = await fetch(
      `${this.baseUrl}/api/v1/prices/${encodeURIComponent(symbol)}?resolution=${resolution}&max=${max}`,
      { headers: this.authHeaders() }
    )
    if (!res.ok) {
      throw new Error(`Candles fetch failed for ${symbol}: HTTP ${res.status}`)
    }
    const data = await res.json()
    return (data.prices ?? []).map((p: Record<string, unknown>) => ({
      t: Math.floor(
        new Date(String(p.snapshotTime) + "Z").getTime() / 1000
      ),
      o: midPrice(p.openPrice),
      h: midPrice(p.highPrice),
      l: midPrice(p.lowPrice),
      c: midPrice(p.closePrice),
      v: Number(p.lastTradedVolume) || 0
    }))
  }

  async getAccounts(): Promise<BrokerAccount[]> {
    await this.ensureSession()
    const res = await fetch(`${this.baseUrl}/api/v1/accounts`, {
      headers: this.authHeaders()
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.accounts ?? []).map((acc: Record<string, unknown>) => ({
      accountId: String(acc.accountId),
      balance: Number((acc.balance as { balance?: number })?.balance) || 0,
      currency: String(acc.currency ?? "USD"),
      available: Number((acc.balance as { available?: number })?.available) || 0,
      profitLoss: Number((acc.balance as { profitLoss?: number })?.profitLoss) || 0
    }))
  }

  async getOpenPositions(): Promise<OpenPosition[]> {
    await this.ensureSession()
    const res = await fetch(`${this.baseUrl}/api/v1/positions`, {
      headers: this.authHeaders()
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.positions ?? []).map((p: Record<string, unknown>) => {
      const pos = p.position as Record<string, unknown>
      return {
        symbol: String(pos.epic),
        side: pos.direction as "BUY" | "SELL",
        volume: Number(pos.size) || 0,
        entryPrice: Number(pos.level) || 0,
        unrealizedPnl: Number(pos.upl) || 0,
        dealId: String(pos.dealId)
      }
    })
  }

  async executeOrder(
    order: SizedOrder,
    clientOrderId?: string
  ): Promise<ExecutionResult> {
    if (this.killSwitch) {
      return {
        orderId: clientOrderId ?? crypto.randomUUID(),
        status: "REJECTED",
        error: "Kill switch active"
      }
    }

    if (process.env.LIVE_EXECUTION_ENABLED !== "true") {
      return {
        orderId: clientOrderId ?? crypto.randomUUID(),
        status: "FILLED",
        filledPrice: undefined,
        dealId: `PAPER-${Date.now()}`
      }
    }

    await this.ensureSession()

    const body: Record<string, unknown> = {
      epic: order.symbol,
      direction: order.side,
      size: order.volume,
      guaranteedStop: false,
      stopLevel: order.stopLoss,
      profitLevel: order.takeProfit
    }

    const res = await fetch(`${this.baseUrl}/api/v1/positions`, {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return {
        orderId: clientOrderId ?? crypto.randomUUID(),
        status: "REJECTED",
        error: String(
          (err as { errorMessage?: string }).errorMessage ?? res.statusText
        )
      }
    }

    const data = await res.json()
    const dealReference = data.dealReference as string
    const confirm = await this.confirmDeal(dealReference)

    return {
      orderId: clientOrderId ?? dealReference,
      status: "FILLED",
      filledPrice: confirm.level,
      dealId: confirm.dealId
    }
  }

  private async confirmDeal(
    dealReference: string,
    maxAttempts = 12
  ): Promise<{ dealId: string; level: number }> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const res = await fetch(
        `${this.baseUrl}/api/v1/confirms/${dealReference}`,
        { headers: this.authHeaders() }
      )
      if (!res.ok) continue
      const data = await res.json()
      const ok =
        data.dealStatus === "ACCEPTED" ||
        data.status === "SUCCESS" ||
        data.status === "OPEN"
      if (ok) {
        return {
          dealId: data.affectedDeals?.[0]?.dealId ?? data.dealId ?? "",
          level: Number(data.level) || 0
        }
      }
      if (data.status && data.status !== "PENDING") {
        throw new Error(
          `Trade rejected: ${data.errorMessage ?? data.rejectReason ?? data.status}`
        )
      }
    }
    throw new Error(`Trade confirmation timed out: ${dealReference}`)
  }

  async closePosition(
    dealId: string,
    size?: number
  ): Promise<{ dealId: string; level: number; status: string }> {
    if (this.killSwitch) {
      throw new Error("Kill switch active — cannot close positions")
    }

    await this.ensureSession()

    const res = await fetch(
      `${this.baseUrl}/api/v1/positions/${encodeURIComponent(dealId)}`,
      {
        method: "DELETE",
        headers: {
          ...this.authHeaders(),
          "Content-Type": "application/json"
        },
        body: size != null && size > 0 ? JSON.stringify({ size }) : undefined
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        `Close position failed: ${(err as { errorMessage?: string }).errorMessage ?? res.statusText}`
      )
    }

    const data = await res.json()
    const dealReference = data.dealReference as string
    if (!dealReference) {
      return { dealId, level: 0, status: "CLOSED" }
    }

    const confirm = await this.confirmDeal(dealReference)
    return { dealId: confirm.dealId || dealId, level: confirm.level, status: "CLOSED" }
  }
}

function midPrice(pair: unknown): number {
  const p = pair as { bid?: number; ask?: number }
  return (Number(p?.bid) + Number(p?.ask)) / 2 || 0
}
