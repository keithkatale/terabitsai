import { getCapitalAssetCatalog } from "./capital-assets";

export type CatalogAsset = {
  symbol: string;
  name: string;
  asset_class?: string;
  sector?: string;
};

export const ASSET_CATALOG: Record<string, CatalogAsset[]> = {
  Crypto: [],
  Stocks: [],
  Forex: [],
  Indices: [],
  Commodities: [],
  ETFs: [],
};

const rawCapitalCatalog = getCapitalAssetCatalog();

rawCapitalCatalog.forEach((item) => {
  let cat = "Stocks";
  if (item.asset_class === "crypto") cat = "Crypto";
  else if (item.sector === "Forex") cat = "Forex";
  else if (item.sector === "Indices") cat = "Indices";
  else if (item.sector === "Commodities") cat = "Commodities";
  else if (item.sector === "ETFs") cat = "ETFs";

  const assetObj: CatalogAsset = {
    symbol: item.symbol,
    name: item.display_name,
    asset_class: item.asset_class,
    sector: item.sector ?? undefined,
  };

  if (ASSET_CATALOG[cat]) {
    ASSET_CATALOG[cat].push(assetObj);
  }
});

export const ALL_CATALOG_SYMBOLS = Object.values(ASSET_CATALOG).flat();

export function categoryForAsset(assetClass?: string, sector?: string): string {
  if (assetClass === "crypto") return "Crypto";
  if (sector === "Forex") return "Forex";
  if (sector === "Indices") return "Indices";
  if (sector === "Commodities") return "Commodities";
  if (sector === "ETFs") return "ETFs";
  return "Stocks";
}
