"use client";

import {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TypingPlaceholderOverlay } from "@/components/ui/typing-placeholder";
import { PromptBox } from "@/components/ui/chatgpt-prompt-input";
import { AssetLogoIcon } from "@/components/ui/asset-logo";
import type { AiToolId } from "@/lib/chat/ai-tools";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ChatStatus = "ready" | "streaming" | "submitted" | "idle";

export type AttachedImage = {
  id: string;
  filename: string;
  url: string;
  size?: number;
};

export type AttachedFile = {
  id: string;
  filename: string;
  size?: number;
};

export type TaggedAsset = {
  symbol: string;
  name?: string;
  assetClass?: string;
  sector?: string | null;
};

export type InputBarProps = {
  onSend?: (message: { role: "user"; content: string }) => void;
  onStop?: () => void;
  status?: ChatStatus;
  placeholder?: string;
  className?: string;
  onAttach?: () => void;
  attachedImages?: AttachedImage[];
  attachedFiles?: AttachedFile[];
  onRemoveImage?: (id: string) => void;
  onRemoveFile?: (id: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  placeholderSuggestions?: string[];
  variant?: "default" | "landing";
  taggedAssets?: TaggedAsset[];
  onRemoveTaggedAsset?: (symbol: string) => void;
  onToggleTaggedAsset?: (symbol: string) => void;
  maxTaggedAssets?: number;
  selectedAiTools?: AiToolId[];
  onSelectedAiToolsChange?: (tools: AiToolId[]) => void;
};

const PaperclipIcon = ({ className = "w-[18px] h-[18px]" }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
);

const SendIcon = ({ className = "w-[14px] h-[14px]" }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const StopIcon = ({ className = "w-[12px] h-[12px]" }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </svg>
);

const StreamingStopIcon = () => (
  <span className="relative flex items-center justify-center w-5 h-5">
    <svg
      className="animate-spin h-5 w-5 text-black absolute"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <svg
      width="7"
      height="7"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-black relative z-10"
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  </span>
);

const XIcon = ({ className = "w-3 h-3" }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const FileIcon = ({ className = "w-4 h-4" }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

function AssetTagChip({
  tag,
  onRemove,
}: {
  tag: TaggedAsset;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-400/25 bg-blue-500/10 py-0.5 pl-1 pr-1 text-[11px] font-semibold text-blue-100">
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
          className="inline-flex size-4 items-center justify-center rounded-full text-blue-200/80 hover:bg-blue-400/20 hover:text-white"
        >
          <XIcon className="size-2.5" />
        </button>
      ) : null}
    </span>
  );
}

function AttachmentButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Attach"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
    >
      <PaperclipIcon />
    </button>
  );
}

function SendButton({
  state,
  onClick,
}: {
  state: "idle" | "typing" | "streaming";
  onClick: () => void;
}) {
  const isStreaming = state === "streaming";
  const isActive = state === "typing" || isStreaming;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isStreaming ? "Stop" : "Send"}
      className={cn(
        "inline-flex items-center justify-center w-9 h-9 rounded-full transition-all duration-150",
        isActive
          ? "prompt-send-btn !p-0 !min-w-9 !min-h-9"
          : "bg-white/[0.04] text-zinc-600 border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      )}
    >
      {isStreaming ? <StreamingStopIcon /> : <SendIcon />}
    </button>
  );
}

function ImageChip({
  url,
  onRemove,
}: {
  url: string;
  onRemove?: () => void;
}) {
  return (
    <div className="relative w-12 h-12 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-800 group">
      <img src={url} alt="" className="w-full h-full object-cover" />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove image"
          className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XIcon className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

function FileChip({
  filename,
  size,
  onRemove,
}: {
  filename: string;
  size?: number;
  onRemove?: () => void;
}) {
  const sizeText =
    size === undefined
      ? null
      : size < 1024
        ? `${size} B`
        : size < 1024 * 1024
          ? `${(size / 1024).toFixed(1)} KB`
          : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 group">
      <span className="text-neutral-500 dark:text-neutral-400">
        <FileIcon />
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate text-neutral-900 dark:text-neutral-100 max-w-[140px]">
          {filename}
        </span>
        {sizeText && (
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {sizeText}
          </span>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove file"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}

export const InputBar = memo(function InputBar({
  onSend,
  onStop,
  status = "ready",
  placeholder = "Send a message...",
  className,
  onAttach,
  attachedImages = [],
  attachedFiles = [],
  onRemoveImage,
  onRemoveFile,
  value: controlledValue,
  onChange: controlledOnChange,
  disabled,
  autoFocus,
  leftActions,
  rightActions,
  placeholderSuggestions,
  variant = "default",
  taggedAssets = [],
  onRemoveTaggedAsset,
  onToggleTaggedAsset,
  maxTaggedAssets = 3,
  selectedAiTools = [],
  onSelectedAiToolsChange,
}: InputBarProps) {
  const [internalInput, setInternalInput] = useState("");
  const [focused, setFocused] = useState(false);
  const isControlled = controlledValue !== undefined;
  const input = isControlled ? controlledValue : internalInput;
  const setInput = useCallback(
    (v: string) => {
      if (isControlled) controlledOnChange?.(v);
      else setInternalInput(v);
    },
    [isControlled, controlledOnChange],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLanding = variant === "landing";
  const isStreaming = status === "streaming" || status === "submitted";
  const hasInput = input.trim().length > 0;
  const hasTags = taggedAssets.length > 0;
  const hasContextItems =
    attachedImages.length > 0 || attachedFiles.length > 0;

  useEffect(() => {
    if (isLanding) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    const next = Math.min(el.scrollHeight, 120);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }, [input, isLanding]);

  useEffect(() => {
    if (!autoFocus) return;
    if (isLanding) inputRef.current?.focus();
    else textareaRef.current?.focus();
  }, [autoFocus, isLanding]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && !hasTags) || isStreaming || disabled) return;
    onSend?.({ role: "user", content: trimmed });
    setInput("");
  }, [input, hasTags, isStreaming, disabled, onSend, setInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (
        e.target === e.currentTarget ||
        !(e.target as HTMLElement).closest("button, textarea, input")
      ) {
        if (isLanding) inputRef.current?.focus();
        else textareaRef.current?.focus();
      }
    },
    [isLanding],
  );

  const sendState: "idle" | "typing" | "streaming" = isStreaming
    ? "streaming"
    : (hasInput || hasTags) && !disabled
      ? "typing"
      : "idle";

  const showTypingPlaceholder =
    Boolean(placeholderSuggestions?.length) &&
    !hasInput &&
    !hasTags &&
    !focused &&
    !disabled;

  if (isLanding) {
    return (
      <div className={cn("shrink-0 w-full", className)}>
        <div className="mx-auto max-w-2xl">
          <PromptBox
            value={input}
            onValueChange={setInput}
            onSend={handleSubmit}
            onStop={onStop}
            status={status}
            disabled={disabled}
            placeholder={showTypingPlaceholder ? " " : placeholder}
            taggedAssets={taggedAssets}
            onToggleTaggedAsset={onToggleTaggedAsset}
            onRemoveTaggedAsset={onRemoveTaggedAsset}
            maxTaggedAssets={maxTaggedAssets}
            selectedAiTools={selectedAiTools}
            onSelectedAiToolsChange={onSelectedAiToolsChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 px-3 pb-3 w-full", className)}>
      <div className="mx-auto max-w-2xl">
        <PromptBox
          value={input}
          onValueChange={setInput}
          onSend={handleSubmit}
          onStop={onStop}
          status={status}
          disabled={disabled}
          placeholder={showTypingPlaceholder ? " " : placeholder}
          taggedAssets={taggedAssets}
          onToggleTaggedAsset={onToggleTaggedAsset}
          onRemoveTaggedAsset={onRemoveTaggedAsset}
          maxTaggedAssets={maxTaggedAssets}
          selectedAiTools={selectedAiTools}
          onSelectedAiToolsChange={onSelectedAiToolsChange}
        />
      </div>
    </div>
  );
});

export default InputBar;
