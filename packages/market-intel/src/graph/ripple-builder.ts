import { prisma } from "@quant/db";
import { upsertEntityNode, persistEntityEdge } from "../persist-synthesis.js";
import { sectorForSymbol } from "../symbols.js";

const PEER_MAP: Record<string, string[]> = {
  NVDA: ["AMD", "MSFT", "GOOGL", "AVGO"],
  AAPL: ["MSFT", "GOOGL", "META", "AMZN"],
  BTCUSD: ["ETHUSD", "SOLUSD"],
  TSLA: ["F", "GM", "RIVN", "LI"],
  GOLD: ["SILVER", "OIL"]
};

export async function buildEntityGraphForSymbol(symbol: string, sourceDocId?: string) {
  const companyId = await upsertEntityNode({
    type: "company",
    label: symbol,
    symbol
  });

  const sector = sectorForSymbol(symbol);
  if (sector) {
    const sectorId = await upsertEntityNode({ type: "sector", label: sector });
    await persistEntityEdge({
      fromId: companyId,
      toId: sectorId,
      relation: "belongs_to",
      sourceDocId
    });
  }

  const peers = PEER_MAP[symbol] ?? [];
  for (const peer of peers) {
    const peerId = await upsertEntityNode({ type: "company", label: peer, symbol: peer });
    await persistEntityEdge({
      fromId: companyId,
      toId: peerId,
      relation: "correlates",
      weight: 0.7,
      sourceDocId
    });
  }

  return companyId;
}

export async function getRippleGraph(rootSymbol: string, depth = 2) {
  const root = await prisma.entityNode.findFirst({ where: { symbol: rootSymbol } });
  if (!root) {
    await buildEntityGraphForSymbol(rootSymbol);
    return getRippleGraph(rootSymbol, depth);
  }

  const visited = new Set<string>([root.id]);
  const nodes = [{ id: root.id, type: root.type, label: root.label, symbol: root.symbol }];
  const edges: Array<{ id: string; fromId: string; toId: string; relation: string; weight: number }> = [];

  let frontier = [root.id];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      const outEdges = await prisma.entityEdge.findMany({ where: { fromId: nodeId } });
      for (const e of outEdges) {
        edges.push({ id: e.id, fromId: e.fromId, toId: e.toId, relation: e.relation, weight: e.weight });
        if (!visited.has(e.toId)) {
          visited.add(e.toId);
          const n = await prisma.entityNode.findUnique({ where: { id: e.toId } });
          if (n) {
            nodes.push({ id: n.id, type: n.type, label: n.label, symbol: n.symbol });
            next.push(n.id);
          }
        }
      }
    }
    frontier = next;
  }

  return { nodes, edges, rootSymbol };
}
