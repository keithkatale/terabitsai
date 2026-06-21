import { ASSET_CATALOG } from "@/lib/catalog/asset-catalog";
import { getCapitalAssetCatalog } from "@/lib/catalog/capital-assets";
import type { AssetCatalogGroup } from "@/components/generative-ui/asset-catalog-grid";

const GROUP_ORDER = ["Crypto", "Stocks", "Forex", "Indices", "Commodities", "ETFs"] as const;

function buildGroups(assetClassFilter?: string): AssetCatalogGroup[] {
  if (assetClassFilter) {
    const all = getCapitalAssetCatalog().filter((a) => a.asset_class === assetClassFilter);
    const label =
      assetClassFilter === "crypto"
        ? "Crypto"
        : assetClassFilter === "stock"
          ? "Stocks"
          : assetClassFilter === "etf"
            ? "ETFs"
            : assetClassFilter;
    return [
      {
        label,
        assets: all.map((a) => ({
          symbol: a.symbol,
          name: a.display_name,
          asset_class: a.asset_class,
          sector: a.sector ?? undefined,
        })),
      },
    ];
  }

  const groups: AssetCatalogGroup[] = [];

  for (const key of GROUP_ORDER) {
    const assets = ASSET_CATALOG[key] ?? [];
    if (assets.length === 0) continue;
    groups.push({
      label: key,
      assets: assets.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        asset_class: a.asset_class,
        sector: a.sector,
      })),
    });
  }

  // Benchmark-style merge for smaller screens: combine non-crypto/stock into one column on xl
  // Keep separate columns for clarity (matches screenshot 3 columns: Crypto | Stocks | Rest)
  const forex = groups.find((g) => g.label === "Forex");
  const indices = groups.find((g) => g.label === "Indices");
  const commodities = groups.find((g) => g.label === "Commodities");
  const etfs = groups.find((g) => g.label === "ETFs");

  const mergedAssets = [
    ...(forex?.assets ?? []),
    ...(indices?.assets ?? []),
    ...(commodities?.assets ?? []),
    ...(etfs?.assets ?? []),
  ];

  const core = groups.filter((g) => g.label === "Crypto" || g.label === "Stocks");

  if (mergedAssets.length > 0) {
    core.push({
      label: "ETFs, Indices, Commodities, Forex",
      assets: mergedAssets,
    });
  }

  return core;
}

export async function fetchAssetCatalog(assetClassFilter?: string) {
  const groups = buildGroups(assetClassFilter);
  const allAssets = groups.flatMap((g) => g.assets);
  const count = allAssets.length;

  return {
    success: true,
    count,
    assets: allAssets,
    groups,
    genui: {
      view: [
        {
          type: "component",
          name: "AssetCatalogGrid",
          props: {
            title: "Available Assets by Class",
            groups,
          },
        },
      ],
    },
  };
}
