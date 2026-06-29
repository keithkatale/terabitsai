"use client";

import * as React from "react";
import { useEffect, useRef, useCallback, useState } from "react";
import DOMPurify from "dompurify";
import { createPortal } from "react-dom";
import { GenerativeUiRegistry, normalizeComponentName } from "@/components/generative-ui/registry";
import { GenUiErrorBoundary } from "@/components/generative-ui/genui-error-boundary";
import { useChatWidgetAction } from "@/contexts/chat-widget-context";
import type { WidgetAction } from "@/lib/chat/widget-actions";

interface CanvasDocumentProps {
  html: string;
  title?: string;
  onAction?: (action: WidgetAction) => void;
}

/**
 * CanvasDocument: Renders AI-authored HTML in-document with design tokens,
 * component slot hydration, and sanitization.
 */
export function CanvasDocument({ html, title, onAction }: CanvasDocumentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [componentSlots, setComponentSlots] = useState<
    Array<{ element: Element; name: string; props: Record<string, unknown> }>
  >([]);
  const contextAction = useChatWidgetAction();

  const emitAction = useCallback(
    (action: WidgetAction) => {
      onAction?.(action);
      contextAction?.(action);
    },
    [contextAction, onAction],
  );

  // Sanitize HTML: allow layout, text, SVG, inline styles, but forbid scripts and event handlers
  const sanitizedHtml = React.useMemo(() => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "div",
        "span",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "a",
        "strong",
        "em",
        "br",
        "hr",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "svg",
        "path",
        "circle",
        "rect",
        "line",
        "polyline",
        "polygon",
        "g",
        "text",
        "defs",
        "linearGradient",
        "stop",
        "style",
        "section",
        "article",
        "header",
        "footer",
        "nav",
        "aside",
        "main",
        "img",
        "figure",
        "figcaption",
        "blockquote",
        "code",
        "pre",
        "label",
        "input",
        "button",
        "select",
        "option",
      ],
      ALLOWED_ATTR: [
        "class",
        "style",
        "data-component",
        "data-props",
        "data-action",
        "data-prompt",
        "id",
        "href",
        "target",
        "rel",
        "width",
        "height",
        "viewBox",
        "fill",
        "stroke",
        "stroke-width",
        "d",
        "cx",
        "cy",
        "r",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "points",
        "transform",
        "offset",
        "stop-color",
        "src",
        "alt",
        "title",
        "type",
        "value",
        "placeholder",
        "disabled",
      ],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ["script", "iframe", "object", "embed", "link"],
      FORBID_ATTR: [
        "onerror",
        "onload",
        "onclick",
        "onmouseover",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
      ],
    });
  }, [html]);

  // Scan for component slots after render and set up portals
  useEffect(() => {
    if (!containerRef.current) return;

    const slots = Array.from(
      containerRef.current.querySelectorAll("[data-component]"),
    ) as HTMLElement[];

    const slotData = slots
      .map((el) => {
        const name = el.getAttribute("data-component");
        const propsJson = el.getAttribute("data-props");
        if (!name) return null;

        let props: Record<string, unknown> = {};
        if (propsJson) {
          try {
            props = JSON.parse(propsJson);
          } catch {
            console.warn("[CanvasDocument] Invalid data-props JSON:", propsJson);
          }
        }

        return { element: el, name, props };
      })
      .filter((slot): slot is NonNullable<typeof slot> => slot !== null);

    setComponentSlots(slotData);
  }, [sanitizedHtml]);

  // Wire up declarative actions: [data-action="prompt"]
  useEffect(() => {
    if (!containerRef.current) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionButton = target.closest("[data-action]") as HTMLElement | null;
      if (!actionButton) return;

      const action = actionButton.getAttribute("data-action");
      const prompt = actionButton.getAttribute("data-prompt");

      if (action === "prompt" && prompt) {
        e.preventDefault();
        emitAction({ type: "prompt", prompt });
      }
    };

    containerRef.current.addEventListener("click", handleClick);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      containerRef.current?.removeEventListener("click", handleClick);
    };
  }, [emitAction, sanitizedHtml]);

  return (
    <GenUiErrorBoundary
      fallbackTitle={title ? `Canvas: ${title}` : "Canvas document failed to render"}
      rawPayload={html}
    >
      <div className="canvas-document relative w-full">
        {title && (
          <div className="mb-3 flex items-center gap-2 border-b border-zinc-800/60 pb-2">
            <div className="size-2 animate-pulse rounded-full bg-cyan-500" />
            <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
          </div>
        )}

        {/* Inject design tokens as scoped CSS variables */}
        <style>{`
          .canvas-document {
            /* Dark terminal color palette */
            --canvas-bg-primary: #09090b;
            --canvas-bg-secondary: #18181b;
            --canvas-bg-tertiary: #27272a;
            --canvas-text-primary: #fafafa;
            --canvas-text-secondary: #a1a1aa;
            --canvas-text-tertiary: #71717a;
            --canvas-border-primary: rgba(255, 255, 255, 0.1);
            --canvas-border-secondary: rgba(255, 255, 255, 0.06);
            --canvas-border-tertiary: rgba(255, 255, 255, 0.04);
            
            /* Accent colors */
            --canvas-cyan-500: #06b6d4;
            --canvas-cyan-400: #22d3ee;
            --canvas-violet-500: #8b5cf6;
            --canvas-violet-400: #a78bfa;
            --canvas-emerald-500: #10b981;
            --canvas-emerald-400: #34d399;
            --canvas-rose-500: #f43f5e;
            --canvas-rose-400: #fb7185;
            --canvas-amber-500: #f59e0b;
            --canvas-amber-400: #fbbf24;
            
            /* Semantic colors */
            --canvas-color-info: var(--canvas-cyan-400);
            --canvas-color-success: var(--canvas-emerald-400);
            --canvas-color-warning: var(--canvas-amber-400);
            --canvas-color-danger: var(--canvas-rose-400);
            
            /* Spacing */
            --canvas-spacing-xs: 0.25rem;
            --canvas-spacing-sm: 0.5rem;
            --canvas-spacing-md: 1rem;
            --canvas-spacing-lg: 1.5rem;
            --canvas-spacing-xl: 2rem;
            
            /* Border radius */
            --canvas-radius-sm: 0.375rem;
            --canvas-radius-md: 0.5rem;
            --canvas-radius-lg: 0.75rem;
            --canvas-radius-xl: 1rem;
            
            /* Typography */
            --canvas-font-sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
            --canvas-font-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
          }
          
          .canvas-document * {
            box-sizing: border-box;
          }
        `}</style>

        {/* Render sanitized HTML */}
        <div
          ref={containerRef}
          className="canvas-content"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />

        {/* Portal-mount component slots */}
        {componentSlots.map((slot, idx) =>
          createPortal(
            <div key={idx} className="canvas-slot-mount">
              <GenerativeUiRegistry name={normalizeComponentName(slot.name)} props={slot.props} />
            </div>,
            slot.element,
          ),
        )}
      </div>
    </GenUiErrorBoundary>
  );
}
