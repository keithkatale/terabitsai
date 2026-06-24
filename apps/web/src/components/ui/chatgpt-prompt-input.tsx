"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  ArrowUp,
  Check,
  Globe,
  Lightbulb,
  LineChart,
  Plus,
  Settings2,
  Telescope,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_TOOLS, type AiToolId } from "@/lib/chat/ai-tools";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import { AssetTagPicker } from "@/components/ui/asset-tag-picker";
import type { ChatStatus, TaggedAsset } from "@/components/ui/input-bar";

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
      placeholder = "Message…",
      taggedAssets = [],
      onToggleTaggedAsset,
      onRemoveTaggedAsset,
      maxTaggedAssets = 3,
      selectedAiTools = [],
      onSelectedAiToolsChange,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [internalValue, setInternalValue] = React.useState("");
    const [toolsOpen, setToolsOpen] = React.useState(false);
    const [assetsOpen, setAssetsOpen] = React.useState(false);

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
          "neo-surface flex cursor-text flex-col rounded-[30px] p-2 shadow-2xl transition-colors",
          className,
        )}
      >
        {hasTags ? (
          <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1">
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
            "custom-scrollbar min-h-11 w-full resize-none border-0 bg-transparent p-3 text-[14px] text-zinc-100 placeholder:text-zinc-500",
            "focus:ring-0 focus-visible:outline-none",
            disabled && "cursor-not-allowed opacity-50",
          )}
          {...props}
        />

        <div className="mt-0.5 p-1 pt-0">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-1.5">
              <Popover open={assetsOpen} onOpenChange={setAssetsOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={disabled}
                        className="flex size-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
                      >
                        <Plus className="size-5" strokeWidth={2} />
                        <span className="sr-only">Tag assets</span>
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow>
                    <p>Tag assets</p>
                  </TooltipContent>
                </Tooltip>
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

              <Popover open={toolsOpen} onOpenChange={setToolsOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                          "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-50",
                          selectedAiTools.length > 0 && "text-cyan-300",
                        )}
                      >
                        <Settings2 className="size-4" />
                        {selectedAiTools.length === 0 ? (
                          <span className="text-xs font-medium">Tools</span>
                        ) : (
                          <span className="text-xs font-medium">{selectedAiTools.length}</span>
                        )}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow>
                    <p>AI tools</p>
                  </TooltipContent>
                </Tooltip>
                <PopoverContent side="top" align="start" className="w-64 p-2">
                  <p className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    AI capabilities
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {AI_TOOLS.map((tool) => {
                      const Icon = TOOL_ICONS[tool.id];
                      const active = selectedAiTools.includes(tool.id);
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => toggleTool(tool.id)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm transition-colors",
                            active
                              ? "bg-cyan-500/15 text-cyan-100"
                              : "text-zinc-200 hover:bg-white/[0.06]",
                          )}
                        >
                          <Icon className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{tool.name}</span>
                            <span className="mt-0.5 block text-[10px] text-zinc-500">
                              {tool.description}
                            </span>
                          </span>
                          {active ? <Check className="mt-0.5 size-3.5 shrink-0 text-cyan-400" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {selectedAiTools.map((toolId) => {
                const tool = AI_TOOLS.find((t) => t.id === toolId);
                const Icon = TOOL_ICONS[toolId];
                if (!tool) return null;
                return (
                  <button
                    key={toolId}
                    type="button"
                    onClick={() => toggleTool(toolId)}
                    className="flex h-8 items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-500/15"
                  >
                    <Icon className="size-3.5" />
                    {tool.shortName}
                    <X className="size-3.5 opacity-70" />
                  </button>
                );
              })}

              <div className="ml-auto flex items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSend && !isStreaming}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40",
                        canSend || isStreaming
                          ? "bg-white text-black hover:bg-white/90"
                          : "bg-white/10 text-zinc-600",
                        disabled && !isStreaming && "pointer-events-none opacity-50",
                      )}
                    >
                      {isStreaming ? (
                        <span className="size-2.5 rounded-sm bg-black" />
                      ) : (
                        <ArrowUp className="size-5" strokeWidth={2.25} />
                      )}
                      <span className="sr-only">{isStreaming ? "Stop" : "Send"}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow>
                    <p>{isStreaming ? "Stop" : "Send"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>

        {taggedAssets.length >= maxTaggedAssets ? (
          <p className="px-3 pb-1 text-center text-[10px] text-zinc-500">
            Max {maxTaggedAssets} assets — remove one to tag another.
          </p>
        ) : null}
      </div>
    );
  },
);

PromptBox.displayName = "PromptBox";
