"use client";

import { useState, useEffect } from "react";
import { AssetLogoIcon } from "./asset-logo";
import { X, ShieldAlert, ArrowUpRight, ArrowDownRight, CheckCircle2, DollarSign, Percent, TrendingUp } from "lucide-react";

interface QuickTradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
  bid: number;
  ask: number;
  change24hPct: number | null;
  onExecute: (trade: {
    id: string;
    symbol: string;
    direction: "BUY" | "SELL";
    price: number;
    size: number;
    leverage: number;
    margin: number;
    tp: number | null;
    sl: number | null;
    timestamp: number;
  }) => void;
}

export default function QuickTradeDialog({
  isOpen,
  onClose,
  symbol,
  currentPrice,
  bid,
  ask,
  change24hPct,
  onExecute,
}: QuickTradeDialogProps) {
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [size, setSize] = useState<number>(1);
  const [leverage, setLeverage] = useState<number>(10);
  const [useTpSl, setUseTpSl] = useState(false);
  const [tp, setTp] = useState<string>("");
  const [sl, setSl] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);

  // Set standard initial size/values based on asset
  useEffect(() => {
    if (isOpen) {
      setIsExecuting(false);
      setDirection("BUY");
      setUseTpSl(false);
      setTp("");
      setSl("");
      
      const isCrypto = symbol.includes("USD");
      const isForex = symbol.length === 6 && !symbol.includes("USD") && !symbol.includes("GOLD") && !symbol.includes("OIL");
      
      if (isCrypto) {
        setSize(0.1);
        setLeverage(10);
      } else if (isForex) {
        setSize(1000);
        setLeverage(50);
      } else {
        setSize(10);
        setLeverage(5);
      }
    }
  }, [isOpen, symbol]);

  if (!isOpen) return null;

  // Calculations
  const notionalValue = size * currentPrice;
  const marginRequired = notionalValue / leverage;
  const spreadValue = ask - bid;
  const spreadPct = (spreadValue / currentPrice) * 100;

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      onExecute({
        id: "TRD-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        symbol,
        direction,
        price: direction === "BUY" ? ask : bid,
        size,
        leverage,
        margin: marginRequired,
        tp: useTpSl && tp ? parseFloat(tp) : null,
        sl: useTpSl && sl ? parseFloat(sl) : null,
        timestamp: Math.floor(Date.now() / 1000),
      });
      setIsExecuting(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl p-6 shadow-2xl shadow-black/80 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-zinc-500">Simulate CFD Position</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Selected Asset Header */}
        <div className="flex items-center justify-between border-b border-zinc-900/60 pb-4">
          <div className="flex items-center gap-3">
            <AssetLogoIcon symbol={symbol} size="md" className="rounded-lg shadow-md border border-zinc-900/40 shrink-0" />
            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight leading-none">{symbol}</h3>
              <p className="text-[11px] font-medium text-zinc-500 uppercase mt-1">Capital.com Spot CFD</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-zinc-100">
              ${currentPrice >= 1000 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : currentPrice.toFixed(4)}
            </div>
            <div className="flex items-center justify-end gap-1 text-xs">
              {change24hPct !== null && (
                <span className={change24hPct >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                  {change24hPct >= 0 ? "+" : ""}{change24hPct.toFixed(2)}%
                </span>
              )}
              <span className="text-zinc-600 text-[10px] font-medium">24h</span>
            </div>
          </div>
        </div>

        {/* Direction Switcher (Buy / Sell) */}
        <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-900/60">
          <button
            onClick={() => setDirection("BUY")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              direction === "BUY"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_2px_10px_rgba(16,185,129,0.05)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ArrowUpRight className="size-4" />
            Buy (Long)
          </button>
          <button
            onClick={() => setDirection("SELL")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              direction === "SELL"
                ? "bg-red-500/10 border border-red-500/30 text-red-400 shadow-[0_2px_10px_rgba(239,68,68,0.05)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ArrowDownRight className="size-4" />
            Sell (Short)
          </button>
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          {/* Position Size */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-400">Position Size (Contracts)</label>
              <span className="text-[10px] font-mono text-zinc-500">Notional: ${notionalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={size}
                onChange={(e) => setSize(Math.max(0.0001, parseFloat(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg px-3.5 py-2 text-sm font-mono text-white outline-none"
                step={symbol.includes("USD") ? "0.01" : "1"}
              />
              <div className="flex gap-1">
                {[-50, -10, 10, 50].map((delta) => {
                  const pct = 1 + delta / 100;
                  return (
                    <button
                      key={delta}
                      onClick={() => setSize(prev => Math.max(0.0001, parseFloat((prev * pct).toFixed(4))))}
                      className="px-2 py-1 bg-zinc-900 border border-zinc-800/60 rounded text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      {delta > 0 ? `+${delta}%` : `${delta}%`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leverage Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-400">Leverage (Multiplier)</label>
              <span className="text-xs font-bold text-cyan-400 tabular-nums">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max={symbol.includes("USD") ? "20" : symbol.length === 6 ? "100" : "50"}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
              className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[9px] font-bold text-zinc-600 px-0.5 mt-1">
              <span>1x (No Leverage)</span>
              <span>10x</span>
              <span>25x</span>
              <span>{symbol.includes("USD") ? "20x Max" : symbol.length === 6 ? "100x Max" : "50x Max"}</span>
            </div>
          </div>

          {/* TP / SL Accordion Toggle */}
          <div className="border border-zinc-900/60 bg-zinc-950/20 rounded-xl p-3 space-y-3">
            <button
              onClick={() => setUseTpSl(!useTpSl)}
              className="w-full flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <span>Add Take Profit / Stop Loss</span>
              <span className="text-[10px] text-zinc-500 font-bold">{useTpSl ? "Enabled" : "Disabled (Click to add)"}</span>
            </button>

            {useTpSl && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-900/40 animate-in fade-in duration-200">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 block mb-1">Take Profit ($)</label>
                  <input
                    type="number"
                    placeholder={`e.g. ${(currentPrice * 1.05).toFixed(2)}`}
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-400 outline-none placeholder:text-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 block mb-1">Stop Loss ($)</label>
                  <input
                    type="number"
                    placeholder={`e.g. ${(currentPrice * 0.95).toFixed(2)}`}
                    value={sl}
                    onChange={(e) => setSl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-red-400 outline-none placeholder:text-zinc-700"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live CFD Order Breakdown */}
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-zinc-500">
            <span>Trading Fee / Commission</span>
            <span className="text-zinc-300 font-mono font-medium">FREE ($0.00)</span>
          </div>
          <div className="flex justify-between items-center text-zinc-500">
            <span>Bid/Ask Spread</span>
            <span className="text-zinc-300 font-mono font-medium">
              ${spreadValue.toFixed(4)} ({spreadPct.toFixed(3)}%)
            </span>
          </div>
          <div className="flex justify-between items-center text-zinc-500">
            <span>Estimated Leverage Margin</span>
            <span className="text-cyan-400 font-mono font-bold">
              ${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-zinc-900/60 pt-2 font-bold">
            <span className="text-zinc-400">Total Contract Value</span>
            <span className="text-white font-mono">
              ${notionalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Simulated Warning */}
        <div className="flex gap-2 p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/10 text-[10px] text-zinc-400/90 leading-normal">
          <ShieldAlert className="size-4 shrink-0 text-cyan-400" />
          <span>This is a simulated transaction powered by Quant's local paper-trading engine. No actual capital is exposed or placed on real exchanges.</span>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleExecute}
          disabled={isExecuting || size <= 0}
          className={`w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
            direction === "BUY"
              ? "bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              : "bg-red-500 text-white hover:bg-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          {isExecuting ? (
            <>
              <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Transmitting simulated contract...
            </>
          ) : (
            `Execute Simulated ${direction} CFD`
          )}
        </button>

      </div>
    </div>
  );
}
