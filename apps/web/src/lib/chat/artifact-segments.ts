import { hasQuantMarkup, parseQuantMarkup } from "@/lib/quant-ui/parser";

export type ArtifactSegment =
  | { kind: "prose"; markdown: string }
  | { kind: "quant-ui"; markup: string }
  | { kind: "genui"; body: string }
  | { kind: "html"; body: string; lang: string };

const FENCE_RE = /```(quant|genui|html|svg|xml)\s*\n?([\s\S]*?)```/gi;
const RAW_QUANT_RE = /(<quant:[\s\S]*?<\/quant:[\w-]+>|<quant:[\w-]+[^>]*\/>)/gi;

/** Split assistant markdown into prose + renderable artifact segments. Artifacts never pass through as code blocks. */
export function splitMarkdownIntoArtifactSegments(markdown: string): ArtifactSegment[] {
  if (!markdown.trim()) return [];

  const segments: ArtifactSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;

  while ((match = FENCE_RE.exec(markdown)) !== null) {
    const [full, lang, body] = match;
    const before = markdown.slice(lastIndex, match.index);
    if (before.trim()) {
      segments.push(...splitRawQuantInProse(before));
    }

    const langLower = lang.toLowerCase();
    if (langLower === "quant") {
      segments.push({ kind: "quant-ui", markup: body.trim() });
    } else if (langLower === "genui") {
      segments.push({ kind: "genui", body: body.trim() });
    } else {
      segments.push({ kind: "html", body: body.trim(), lang: langLower });
    }

    lastIndex = match.index + full.length;
  }

  const tail = markdown.slice(lastIndex);
  if (tail.trim()) {
    segments.push(...splitRawQuantInProse(tail));
  }

  return segments.length > 0 ? segments : [{ kind: "prose", markdown }];
}

function splitRawQuantInProse(text: string): ArtifactSegment[] {
  if (!hasQuantMarkup(text)) {
    return text.trim() ? [{ kind: "prose", markdown: text }] : [];
  }

  const segments: ArtifactSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  RAW_QUANT_RE.lastIndex = 0;

  while ((match = RAW_QUANT_RE.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before.trim()) segments.push({ kind: "prose", markdown: before });
    segments.push({ kind: "quant-ui", markup: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  const tail = text.slice(lastIndex);
  if (tail.trim()) segments.push({ kind: "prose", markdown: tail });

  return segments;
}

/** Validate quant markup before rendering — used to show failure UI instead of raw code. */
export function validateQuantMarkup(markup: string): { ok: true } | { ok: false; reason: string } {
  if (!markup.trim()) return { ok: false, reason: "Empty interface markup." };
  if (!hasQuantMarkup(markup)) return { ok: false, reason: "No Quant UI tags found." };
  const nodes = parseQuantMarkup(markup);
  if (nodes.length === 0) return { ok: false, reason: "Could not parse Quant UI tags." };
  return { ok: true };
}
