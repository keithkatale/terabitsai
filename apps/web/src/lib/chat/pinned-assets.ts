export type PinnedAssetRef = {
  symbol: string;
  displayName: string;
  assetClass: string;
  sector?: string | null;
};

export type TaggedAssetInput = {
  symbol: string;
  name?: string;
  assetClass?: string;
  sector?: string | null;
};

export function toPinnedAssetRef(tag: TaggedAssetInput): PinnedAssetRef {
  return {
    symbol: tag.symbol,
    displayName: tag.name ?? tag.symbol,
    assetClass: tag.assetClass ?? "stock",
    sector: tag.sector ?? null,
  };
}

export function parsePinnedAssets(raw: unknown): PinnedAssetRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): PinnedAssetRef | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      if (typeof o.symbol !== "string" || !o.symbol.trim()) return null;
      return {
        symbol: o.symbol.trim(),
        displayName:
          typeof o.displayName === "string" && o.displayName.trim()
            ? o.displayName.trim()
            : typeof o.name === "string" && o.name.trim()
              ? o.name.trim()
              : o.symbol.trim(),
        assetClass:
          typeof o.assetClass === "string" && o.assetClass.trim()
            ? o.assetClass.trim()
            : "stock",
        sector:
          typeof o.sector === "string" ? o.sector : o.sector === null ? null : undefined,
      };
    })
    .filter((x): x is PinnedAssetRef => x !== null)
    .slice(0, 3);
}

/** Visible in the chat thread — no tool directives. */
export function formatUserDisplayMessage(text: string, tags: TaggedAssetInput[]): string {
  const trimmed = text.trim();
  if (tags.length === 0) return trimmed;
  const label = tags.map((t) => t.symbol).join(", ");
  if (!trimmed) {
    return `[Pinned: ${label}]`;
  }
  return `[Pinned: ${label}]\n\n${trimmed}`;
}

/** Prepended for the model — explicit catalog symbols + required tool calls. */
export function augmentMessageWithPinnedAssets(
  message: string,
  assets: PinnedAssetRef[],
): string {
  if (assets.length === 0) return message.trim();

  const trimmed = message.trim();
  const userQuestion =
    trimmed ||
    "Give a concise outlook with key levels and risk considerations for each pinned asset.";

  const catalogBlock = assets
    .map(
      (a) =>
        `  - symbol: "${a.symbol}" | display_name: "${a.displayName}" | asset_class: ${a.assetClass}${a.sector ? ` | sector: ${a.sector}` : ""}`,
    )
    .join("\n");

  return `<pinned_assets>
The user pinned these exact Terabits catalog instruments. Use the symbol field verbatim in every tool call — never infer or substitute tickers.

${catalogBlock}

Before answering you MUST:
1. Call get_asset_details once per pinned symbol (all symbols listed above).
2. Call get_asset_market_data once per pinned symbol with range 1M (unless the user asks for another window).
3. Ground charts, prices, and analysis only in those tool results.
</pinned_assets>

<user_question>
${userQuestion}
</user_question>`;
}
