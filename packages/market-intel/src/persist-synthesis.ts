import { prisma, Prisma } from "@quant/db";
import type { NormalizedIntelDoc } from "./enrich/normalizer.js";
import { embedText } from "./enrich/embedder.js";

export async function persistIntelDocument(
  doc: NormalizedIntelDoc,
  scanRunId?: string
): Promise<string | null> {
  if (!doc.externalId) return null;

  try {
    const row = await prisma.intelDocument.upsert({
      where: {
        source_externalId: { source: doc.source, externalId: doc.externalId }
      },
      create: {
        diet: doc.diet,
        source: doc.source,
        externalId: doc.externalId,
        symbol: doc.symbol ?? null,
        symbols: doc.symbols,
        title: doc.title,
        body: doc.body,
        url: doc.url ?? null,
        sentiment: doc.sentiment ?? null,
        eventType: doc.eventType ?? null,
        publishedAt: doc.publishedAt ?? null,
        payload: (doc.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        scanRunId: scanRunId ?? null
      },
      update: {
        title: doc.title,
        body: doc.body,
        sentiment: doc.sentiment ?? null,
        publishedAt: doc.publishedAt ?? null
      }
    });

    const text = `${doc.title}\n${doc.body}`;
    const { vector, dimensions } = await embedText(text);
    await prisma.documentEmbedding.upsert({
      where: { documentId: row.id },
      create: {
        documentId: row.id,
        dimensions,
        embedding: vector as Prisma.InputJsonValue
      },
      update: {
        dimensions,
        embedding: vector as Prisma.InputJsonValue
      }
    });

    return row.id;
  } catch {
    return null;
  }
}

export async function persistSynthesisBrief(input: {
  briefType: string;
  symbols: string[];
  headline: string;
  thesis: string;
  bullets: { bullish?: string[]; bearish?: string[]; actionable?: string[] };
  impactScore: number;
  confidence: number;
  provenance: Array<{ source: string; url?: string; excerpt?: string; title?: string }>;
  analogs?: Array<{ summary: string; return1d?: number }>;
  regime?: string;
  expiresAt?: Date;
  scanRunId?: string;
}) {
  return prisma.synthesisBrief.create({
    data: {
      briefType: input.briefType,
      symbols: input.symbols,
      headline: input.headline,
      thesis: input.thesis,
      bullets: input.bullets as Prisma.InputJsonValue,
      impactScore: input.impactScore,
      confidence: input.confidence,
      provenance: input.provenance as Prisma.InputJsonValue,
      analogs: (input.analogs ?? undefined) as Prisma.InputJsonValue | undefined,
      regime: input.regime ?? null,
      expiresAt: input.expiresAt,
      scanRunId: input.scanRunId ?? null
    }
  });
}

export async function persistMacroRegime(
  regime: string,
  themes: Array<{ label: string; value: string }>,
  fredData?: Record<string, unknown>
) {
  return prisma.macroRegimeSnapshot.create({
    data: {
      regime,
      themes: themes as Prisma.InputJsonValue,
      fredData: (fredData ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
}

export async function upsertEntityNode(input: {
  type: string;
  label: string;
  symbol?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const existing = await prisma.entityNode.findFirst({
    where: {
      symbol: input.symbol ?? undefined,
      label: input.label,
      type: input.type
    }
  });
  if (existing) return existing.id;
  const row = await prisma.entityNode.create({
    data: {
      type: input.type,
      label: input.label,
      symbol: input.symbol ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
  return row.id;
}

export async function persistEntityEdge(input: {
  fromId: string;
  toId: string;
  relation: string;
  weight?: number;
  sourceDocId?: string;
}) {
  const dup = await prisma.entityEdge.findFirst({
    where: { fromId: input.fromId, toId: input.toId, relation: input.relation }
  });
  if (dup) return dup;
  return prisma.entityEdge.create({
    data: {
      fromId: input.fromId,
      toId: input.toId,
      relation: input.relation,
      weight: input.weight ?? 1,
      sourceDocId: input.sourceDocId ?? null
    }
  });
}

export async function persistContradiction(input: {
  symbol: string;
  newsBias: string;
  flowBias?: string;
  technicalBias?: string;
  summary: string;
  severity: number;
  payload?: Record<string, unknown>;
}) {
  return prisma.contradictionAlert.create({
    data: {
      ...input,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined
    }
  });
}

export async function persistHistoricalAnalog(input: {
  documentId?: string;
  synthesisId?: string;
  symbol?: string;
  eventSummary: string;
  return1h?: number;
  return1d?: number;
  return1w?: number;
}) {
  return prisma.historicalAnalog.create({ data: input });
}
