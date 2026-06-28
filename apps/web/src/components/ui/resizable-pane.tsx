"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ResizablePaneProps {
  children: React.ReactNode;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  side?: "left" | "right";
  className?: string;
  onWidthChange?: (width: number) => void;
}

export function ResizablePane({
  children,
  minWidth = 280,
  maxWidth = 700,
  defaultWidth = 420,
  side = "right",
  className,
  onWidthChange,
}: ResizablePaneProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const delta = side === "right"
      ? startXRef.current - e.clientX
      : e.clientX - startXRef.current;
    
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
    setWidth(newWidth);
    onWidthChange?.(newWidth);
  }, [isDragging, side, minWidth, maxWidth, onWidthChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={paneRef}
      className={cn("relative flex shrink-0", className)}
      style={{ width }}
    >
      <div
        className={cn(
          "absolute top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors",
          "hover:bg-cyan-500/40",
          isDragging && "bg-cyan-500/60",
          side === "right" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-0.5 rounded-full bg-zinc-700/80 px-0.5 py-2 opacity-0 transition-opacity",
            "hover:opacity-100",
            isDragging && "opacity-100",
            side === "right" ? "-left-1.5" : "-right-1.5"
          )}
        >
          <div className="h-4 w-0.5 rounded-full bg-zinc-400" />
        </div>
      </div>
      <div className="min-w-0 flex-1 h-full flex flex-col">{children}</div>
    </div>
  );
}
