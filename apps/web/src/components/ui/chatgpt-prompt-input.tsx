"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Globe,
  Lightbulb,
  LineChart,
  Plus,
  Telescope,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_TOOLS, type AiToolId } from "@/lib/chat/ai-tools";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { AssetTagPicker } from "@/components/ui/asset-tag-picker";
import type { ChatStatus, TaggedAsset } from "@/components/ui/input-bar";

export type AiModel = "flash" | "pro" | "thinking";

const AI_MODELS: { id: AiModel; label: string; description: string }[] = [
  { id: "flash", label: "Flash", description: "Fast responses" },
  { id: "pro", label: "Pro", description: "Advanced reasoning" },
  { id: "thinking", label: "Thinking", description: "Deep analysis" },
];

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { showArrow?: boolean }
>(({ className, sideOffset = 4, showArrow = false, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "relative z-50 max-w-[280px] rounded-md border border-white/10 bg-[var(--terminal-surface-raised)] px-2 py-1 text-xs text-zinc-200 shadow-lg",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className,
      )}
      {...props}
    >
      {props.children}
      {showArrow ? <TooltipPrimitive.Arrow className="-my-px fill-[var(--terminal-surface-raised)]" /> : null}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded-xl border border-white/10 bg-[var(--terminal-surface)] p-3 text-zinc-100 shadow-2xl outline-none",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

const TOOL_ICONS: Record<AiToolId, React.ComponentType<{ className?: string }>> = {
  searchWeb: Globe,
  deepResearch: Telescope,
  thinkLonger: Lightbulb,
  analyzeChart: LineChart,
};

function AssetTagChip({
  tag,
  onRemove,
}: {
  tag: TaggedAsset;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 py-0.5 pl-1 pr-1 text-[11px] font-semibold text-cyan-100">
      <AssetLogoIcon
        symbol={tag.symbol}
        assetClass={tag.assetClass}
        sector={tag.sector ?? undefined}
        size="xs"
        className="size-4 shrink-0 overflow-hidden rounded-full"
      />
      <span className="max-w-[72px] truncate font-mono text-[10px]">{tag.symbol}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${tag.symbol}`}
          className="inline-flex size-4 items-center justify-center rounded-full text-cyan-200/80 hover:bg-cyan-400/20 hover:text-white"
        >
          <X className="size-2.5" />
        </button>
      ) : null}
    </span>
  );
}

export type PromptBoxProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value?: string;
  onValueChange?: (value: string) => void;
  onSend?: () => void;
  onStop?: () => void;
  status?: ChatStatus;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  taggedAssets?: TaggedAsset[];
  onToggleTaggedAsset?: (symbol: string) => void;
  onRemoveTaggedAsset?: (symbol: string) => void;
  maxTaggedAssets?: number;
  selectedAiTools?: AiToolId[];
  onSelectedAiToolsChange?: (tools: AiToolId[]) => void;
  selectedModel?: AiModel;
  onModelChange?: (model: AiModel) => void;
  onAnalyticsClick?: () => void;
};

export const PromptBox = React.forwardRef<HTMLTextAreaElement, PromptBoxProps>(
  (
    {
      className,
      value: controlledValue,
      onValueChange,
      onSend,
      onStop,
      status = "ready",
      disabled,
      placeholder = "Type @ to ask about a tab",
      taggedAssets = [],
      onToggleTaggedAsset,
      onRemoveTaggedAsset,
      maxTaggedAssets = 3,
      selectedAiTools = [],
      onSelectedAiToolsChange,
      selectedModel = "flash",
      onModelChange,
      onAnalyticsClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [internalValue, setInternalValue] = React.useState("");
    const [toolsOpen, setToolsOpen] = React.useState(false);
    const [assetsOpen, setAssetsOpen] = React.useState(false);
    const [modelOpen, setModelOpen] = React.useState(false);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;
    const setValue = React.useCallback(
      (next: string) => {
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    React.useImperativeHandle(ref, () => internalTextareaRef.current!, []);

    React.useLayoutEffect(() => {
      const textarea = internalTextareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }, [value]);

    const isStreaming = status === "streaming" || status === "submitted";
    const hasTags = taggedAssets.length > 0;
    const hasValue = value.trim().length > 0 || hasTags;
    const canSend = hasValue && !disabled && !isStreaming;

    const currentModel = AI_MODELS.find((m) => m.id === selectedModel) ?? AI_MODELS[0];

    const toggleTool = (toolId: AiToolId) => {
      const next = selectedAiTools.includes(toolId)
        ? selectedAiTools.filter((id) => id !== toolId)
        : [...selectedAiTools, toolId];
      onSelectedAiToolsChange?.(next);
    };

    const handleSubmit = () => {
      if (isStreaming) {
        onStop?.();
        return;
      }
      if (!canSend) return;
      onSend?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      onKeyDown?.(e);
    };

    return (
      <div
        className={cn(
          "flex cursor-text flex-col rounded-xl border border-white/[0.08] bg-[#18181b] px-3 py-2 shadow-lg transition-colors",
          className,
        )}
      >
        {hasTags ? (
          <div className="flex flex-wrap items-center gap-1 pb-1.5">
            {taggedAssets.map((tag) => (
              <AssetTagChip
                key={tag.symbol}
                tag={tag}
                onRemove={
                  onRemoveTaggedAsset ? () => onRemoveTaggedAsset(tag.symbol) : undefined
                }
              />
            ))}
          </div>
        ) : null}

        <textarea
          ref={internalTextareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "custom-scrollbar min-h-[24px] w-full resize-none border-0 bg-transparent px-0 py-0.5 text-[14px] text-zinc-100 placeholder:text-zinc-500",
            "focus:ring-0 focus-visible:outline-none",
            disabled && "cursor-not-allowed opacity-50",
          )}
          {...props}
        />

        <div className="mt-1.5 flex items-center justify-between">
          <Popover open={assetsOpen} onOpenChange={setAssetsOpen}>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={disabled}
                      className="flex size-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50"
                    >
                      <Plus className="size-4" strokeWidth={1.5} />
                      <span className="sr-only">Tag assets</span>
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" showArrow>
                  <p>Tag assets</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent side="top" align="start" className="w-auto p-3">
              {onToggleTaggedAsset ? (
                <AssetTagPicker
                  taggedAssets={taggedAssets}
                  maxTaggedAssets={maxTaggedAssets}
                  onToggleAsset={(symbol) => {
                    onToggleTaggedAsset(symbol);
                  }}
                />
              ) : (
                <p className="text-xs text-zinc-500">Asset tagging unavailable.</p>
              )}
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1.5">
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className="flex h-6 items-center gap-1 rounded px-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
                >
                  <span className="text-[12px] font-medium">{currentModel.label}</span>
                  <ChevronDown className="size-3.5" strokeWidth={1.5} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-44 p-1">
                <div className="flex flex-col gap-0.5">
                  {AI_MODELS.map((model) => {
                    const active = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          onModelChange?.(model.id);
                          setModelOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors",
                          active
                            ? "bg-white/[0.08] text-white"
                            : "text-zinc-300 hover:bg-white/[0.04]",
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium">{model.label}</span>
                          <span className="text-[9px] text-zinc-500">{model.description}</span>
                        </div>
                        {active ? <Check className="size-3.5 text-zinc-400" /> : null}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <TooltipProvider delayDuration={100}>
              {(canSend || isStreaming) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSend && !isStreaming}
                      className={cn(
                        "flex size-6 items-center justify-center rounded text-sm font-medium transition-colors",
                        canSend || isStreaming
                          ? "bg-white text-black hover:bg-white/90"
                          : "bg-white/10 text-zinc-600",
                        disabled && !isStreaming && "pointer-events-none opacity-50",
                      )}
                    >
                      {isStreaming ? (
                        <span className="size-2 rounded-sm bg-black" />
                      ) : (
                        <ArrowUp className="size-3.5" strokeWidth={2.25} />
                      )}
                      <span className="sr-only">{isStreaming ? "Stop" : "Send"}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow>
                    <p>{isStreaming ? "Stop" : "Send"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        {taggedAssets.length >= maxTaggedAssets ? (
          <p className="mt-1 text-center text-[9px] text-zinc-500">
            Max {maxTaggedAssets} assets — remove one to tag another.
          </p>
        ) : null}
      </div>
    );
  },
);

PromptBox.displayName = "PromptBox";
