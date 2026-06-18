"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, ArrowRight, Check, Sparkles, Loader2, Landmark } from "lucide-react";

interface TradeConfirmationWidgetProps {
  symbol?: string;
  direction?: "BUY" | "SELL" | "LONG" | "SHORT";
  size?: number; // quantitative size e.g. 0.1 BTC or shares count
  estimatedPrice?: number;
  leverage?: number;
  fee?: number;
}

export function TradeConfirmationWidget({
  symbol = "BTCUSD",
  direction = "BUY",
  size = 0.5,
  estimatedPrice = 67250,
  leverage = 5,
  fee = 12.50
}: TradeConfirmationWidgetProps) {
  const [dragPercent, setDragPercent] = useState(0);
  const [status, setStatus] = useState<"idle" | "dragging" | "executing" | "confirmed">("idle");
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);

  // Normalize direction string to standard BUY/SELL for consistent event dispatching
  const normalizedDirection = React.useMemo(() => {
    const d = direction.toUpperCase();
    if (d === "LONG" || d === "BUY") return "BUY";
    return "SELL";
  }, [direction]);

  const marginRequired = (size * estimatedPrice) / leverage;
  const totalNotional = size * estimatedPrice;

  // Handle Swipe/Drag events
  const handleStart = (clientX: number) => {
    if (status === "confirmed" || status === "executing") return;
    isDraggingRef.current = true;
    startXRef.current = clientX;
    setStatus("dragging");
  };

  const handleMove = (clientX: number) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const width = rect.width - 48; // track width minus knob size
    const deltaX = clientX - startXRef.current;
    const percent = Math.min(100, Math.max(0, (deltaX / width) * 100));
    setDragPercent(percent);

    if (percent >= 99) {
      handleConfirm();
    }
  };

  const handleEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (dragPercent < 95) {
      // Snap back to 0 if not completed
      setDragPercent(0);
      setStatus("idle");
    }
  };

  const handleConfirm = () => {
    isDraggingRef.current = false;
    setDragPercent(100);
    setStatus("executing");

    // Mock network lag execution for 1.2s to build high anticipation with glowing shimmers
    setTimeout(() => {
      setStatus("confirmed");
      
      // Dispatch browser custom event to update simulated positions and account cash balance
      if (typeof window !== "undefined") {
        const tradeEvent = new CustomEvent("execute-simulated-trade", {
          detail: {
            symbol,
            direction: normalizedDirection,
            size,
            price: estimatedPrice
          }
        });
        window.dispatchEvent(tradeEvent);
      }
    }, 1200);
  };

  // Add mouse and touch event listeners globally when dragging
  useEffect(() => {
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleMouseUpGlobal = () => {
      handleEnd();
    };

    const handleTouchMoveGlobal = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleTouchEndGlobal = () => {
      handleEnd();
    };

    if (status === "dragging") {
      window.addEventListener("mousemove", handleMouseMoveGlobal);
      window.addEventListener("mouseup", handleMouseUpGlobal);
      window.addEventListener("touchmove", handleTouchMoveGlobal);
      window.addEventListener("touchend", handleTouchEndGlobal);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMoveGlobal);
      window.removeEventListener("mouseup", handleMouseUpGlobal);
      window.removeEventListener("touchmove", handleTouchMoveGlobal);
      window.removeEventListener("touchend", handleTouchEndGlobal);
    };
  }, [status, dragPercent]);

  const isBuy = normalizedDirection === "BUY";

  return (
    <div className="w-full bg-zinc-950/50 backdrop-blur-xl border border-zinc-900 rounded-2xl p-4 flex flex-col gap-4 shadow-xl animate-fade-in my-3 text-left">
      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-zinc-900/40 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Landmark className="size-3.5 text-zinc-400" />
          <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Simulated Trade Ticket</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md border border-indigo-500/10 bg-indigo-950/10 text-indigo-400 font-extrabold uppercase tracking-wide">
          <span>{leverage}x Leverage cfd</span>
        </div>
      </div>

      {/* Ticket Details */}
      <div className="bg-zinc-950/40 p-3 rounded-xl border border-zinc-900/60 flex flex-col gap-2.5 font-mono text-[11px]">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 uppercase tracking-wider font-semibold">Contract Ticker</span>
          <span className="text-white font-extrabold text-xs">{symbol}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500 uppercase tracking-wider font-semibold">Order Side</span>
          <span className={cn(
            "font-extrabold px-1.5 py-0.5 rounded text-[10px]",
            isBuy ? "bg-emerald-950/30 text-emerald-400 border border-emerald-500/10" : "bg-rose-950/30 text-rose-400 border border-rose-500/10"
          )}>
            {isBuy ? "BUY / LONG" : "SELL / SHORT"}
          </span>
        </div>

        <div className="flex justify-between items-center border-b border-zinc-900/40 pb-2.5">
          <span className="text-zinc-500 uppercase tracking-wider font-semibold">Contracts Quantity</span>
          <span className="text-zinc-100 font-extrabold">{size} Units</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500 uppercase tracking-wider font-semibold">Avg Filled price</span>
          <span className="text-zinc-300 font-bold">${estimatedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500 uppercase tracking-wider font-semibold">Execution Commissions</span>
          <span className="text-zinc-400 font-bold">${fee.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center border-t border-zinc-900/40 pt-2.5 mt-0.5">
          <span className="text-indigo-400 uppercase tracking-wider font-extrabold">Estimated Margin</span>
          <span className="text-indigo-400 font-extrabold text-sm">${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-600 uppercase tracking-wider font-semibold">Total Notional Value</span>
          <span className="text-zinc-500 font-bold">${totalNotional.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Interactive Swipe Area */}
      {status === "confirmed" ? (
        <div className="w-full h-11 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center gap-2 font-bold text-xs select-none uppercase tracking-wider animate-scale-up">
          <Sparkles className="size-4 animate-pulse text-emerald-300" />
          <span>Simulated Trade Dispatched!</span>
          <Check className="size-4 text-emerald-400 stroke-[3px]" />
        </div>
      ) : status === "executing" ? (
        <div className="w-full h-11 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center gap-2 font-bold text-xs select-none uppercase tracking-wider">
          <Loader2 className="size-4 animate-spin text-indigo-400" />
          <span>Confirming order details...</span>
        </div>
      ) : (
        <div 
          ref={trackRef}
          className="relative w-full h-11 bg-zinc-950 border border-zinc-900 rounded-xl p-1 overflow-hidden select-none flex items-center"
        >
          {/* Glowing sliding progress overlay */}
          <div 
            className={cn(
              "absolute left-0 top-0 h-full transition-opacity duration-200 pointer-events-none rounded-l-xl",
              isBuy ? "bg-emerald-500/10" : "bg-rose-500/10"
            )}
            style={{ width: `${dragPercent}%` }}
          />

          {/* Swipe Track text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 animate-pulse flex items-center gap-1">
              <span>Swipe right to execute simulated {isBuy ? "BUY" : "SELL"}</span>
              <ArrowRight className="size-3 text-zinc-500" />
            </span>
          </div>

          {/* Drag Knob slider */}
          <div
            onMouseDown={(e) => handleStart(e.clientX)}
            onTouchStart={(e) => {
              if (e.touches.length > 0) handleStart(e.touches[0].clientX);
            }}
            className={cn(
              "size-9 rounded-lg flex items-center justify-center shadow-lg transition-all duration-150 cursor-grab active:cursor-grabbing z-10 shrink-0",
              isBuy 
                ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/10" 
                : "bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/10"
            )}
            style={{ 
              transform: `translateX(${(dragPercent / 100) * (trackRef.current ? trackRef.current.getBoundingClientRect().width - 48 : 0)}px)`
            }}
          >
            {status === "dragging" ? (
              <ArrowRight className="size-4 animate-ping text-inherit" />
            ) : (
              <ShieldCheck className="size-4 text-inherit" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
