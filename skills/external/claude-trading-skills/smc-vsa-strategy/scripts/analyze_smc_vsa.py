#!/usr/bin/env python3
"""SMC + VSA Mechanical Strategy v2 — CLI analysis entry point.

Fetches OHLCV data via yfinance, runs the signal calculation, and outputs:
  - JSON report: smc_vsa_<SYMBOL>_<YYYYMMDD_HHMMSS>.json
  - Markdown trade card: smc_vsa_<SYMBOL>_<YYYYMMDD_HHMMSS>.md

Usage
-----
python3 analyze_smc_vsa.py --symbol BTCUSD --equity 10000 --risk-pct 1.0
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Allow running as `python analyze_smc_vsa.py` from any working directory
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from signals import calculate_signals, to_json_dict, to_markdown


# ---------------------------------------------------------------------------
# yfinance interval mapping
# ---------------------------------------------------------------------------

_YF_INTERVAL_MAP = {
    "1m": "1m", "2m": "2m", "5m": "5m", "15m": "15m",
    "30m": "30m", "60m": "60m", "1h": "60m", "90m": "90m",
    "1d": "1d", "5d": "5d", "1w": "1wk", "1wk": "1wk",
    "4h": "1h",  # yfinance doesn't have 4h; we resample 1h to 4h below
}

_YF_PERIOD_FOR_INTERVAL = {
    "1m": "7d", "2m": "60d", "5m": "60d", "15m": "60d",
    "30m": "60d", "60m": "730d", "90m": "60d",
    "1d": "5y", "5d": "5y", "1wk": "10y",
    "4h": "730d",   # fetched as 1h then resampled
}


def _fetch_ohlcv(symbol: str, interval: str, period: str | None = None):
    """Download OHLCV data from yfinance and return a normalised DataFrame."""
    try:
        import yfinance as yf
    except ImportError:
        print("ERROR: yfinance is not installed. Run: pip install yfinance", file=sys.stderr)
        sys.exit(1)

    import pandas as pd

    # yfinance symbol normalisation: crypto typically uses BTC-USD format
    yf_symbol = symbol
    for old, new in [("BTCUSD", "BTC-USD"), ("ETHUSD", "ETH-USD"),
                     ("SOLUSD", "SOL-USD"), ("XRPUSD", "XRP-USD"),
                     ("BNBUSD", "BNB-USD")]:
        if symbol.upper() == old:
            yf_symbol = new
            break

    is_4h = interval == "4h"
    fetch_interval = "1h" if is_4h else _YF_INTERVAL_MAP.get(interval, interval)
    fetch_period = period or _YF_PERIOD_FOR_INTERVAL.get(interval, "730d")

    ticker = yf.Ticker(yf_symbol)
    raw = ticker.history(period=fetch_period, interval=fetch_interval, auto_adjust=True)

    if raw.empty:
        raise ValueError(f"No data returned for symbol '{yf_symbol}' (interval={fetch_interval}). "
                         "Check the ticker symbol and try again.")

    # Normalise column names
    raw.columns = [c.lower() for c in raw.columns]
    df = raw[["open", "high", "low", "close", "volume"]].copy()
    df.index = pd.to_datetime(df.index, utc=True)
    df = df.sort_index()

    if is_4h:
        # Resample 1H bars to 4H
        df = df.resample("4h").agg({
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }).dropna()

    df.attrs["interval"] = interval
    df.attrs["symbol"] = yf_symbol
    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="SMC + VSA Mechanical Strategy v2 — signal analyser",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--symbol", required=True,
                   help="Ticker symbol, e.g. BTCUSD, AAPL, ES=F, EURUSD=X")
    p.add_argument("--ltf-interval", default="15m",
                   help="Lower timeframe interval (1m,5m,15m,30m,1h,4h,1d)")
    p.add_argument("--htf-interval", default="4h",
                   help="Higher timeframe interval for macro bias EMA")
    p.add_argument("--equity", type=float, default=10000,
                   help="Account equity in USD")
    p.add_argument("--risk-pct", type=float, default=1.0,
                   help="Risk per trade as %% of equity")
    p.add_argument("--rr-target", type=float, default=3.0,
                   help="TP1 risk-to-reward ratio")
    p.add_argument("--lookback", type=int, default=50,
                   help="N-bar lookback for liquidity high/low")
    p.add_argument("--point-value", type=float, default=1.0,
                   help="Instrument point value in USD (50 for ES futures)")
    p.add_argument("--killzone", default="03:00-11:00",
                   help="NYC kill zone window HH:MM-HH:MM")
    p.add_argument("--max-losses", type=int, default=2,
                   help="Consecutive-loss kill switch threshold")
    p.add_argument("--consecutive-losses", type=int, default=0,
                   help="Current consecutive loss count (for kill switch state)")
    p.add_argument("--output-dir", default="reports",
                   help="Directory for output files")
    p.add_argument("--stdout", action="store_true",
                   help="Also print Markdown trade card to stdout")
    p.add_argument("--json-only", action="store_true",
                   help="Write JSON only (skip Markdown file)")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    print(f"[SMC+VSA] Fetching {args.symbol} — LTF: {args.ltf_interval}  HTF: {args.htf_interval}")

    ltf_df = _fetch_ohlcv(args.symbol, args.ltf_interval)
    htf_df = _fetch_ohlcv(args.symbol, args.htf_interval)

    print(f"[SMC+VSA] LTF bars: {len(ltf_df)}  HTF bars: {len(htf_df)}")

    result = calculate_signals(
        ltf_df=ltf_df,
        htf_df=htf_df,
        symbol=args.symbol,
        equity=args.equity,
        risk_pct=args.risk_pct,
        rr_target=args.rr_target,
        lookback=args.lookback,
        point_value=args.point_value,
        killzone=args.killzone,
        max_losses=args.max_losses,
        consecutive_losses=args.consecutive_losses,
    )

    # -----------------------------------------------------------------------
    # Write outputs
    # -----------------------------------------------------------------------
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_sym = args.symbol.replace("/", "_").replace("=", "").replace("-", "_")
    base_name = f"smc_vsa_{safe_sym}_{stamp}"

    json_path = out_dir / f"{base_name}.json"
    md_path = out_dir / f"{base_name}.md"

    json_data = to_json_dict(result)
    with open(json_path, "w") as f:
        json.dump(json_data, f, indent=2)
    print(f"[SMC+VSA] JSON written: {json_path}")

    md_text = to_markdown(result)

    if not args.json_only:
        with open(md_path, "w") as f:
            f.write(md_text)
        print(f"[SMC+VSA] Markdown written: {md_path}")

    if args.stdout or args.json_only is False:
        print("\n" + "=" * 50)
        print(md_text)
        print("=" * 50)


if __name__ == "__main__":
    main()
