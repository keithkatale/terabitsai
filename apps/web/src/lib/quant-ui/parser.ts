import type { QuantUiNode } from "./types";

const OPEN_RE = /<quant:([\w-]+)((?:\s[^>/]*?)?)\s*(\/?)>/;

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "true";
  }
  return attrs;
}

function findClosingTag(source: string, tag: string, from: number): number {
  const openNeedle = `<quant:${tag}`;
  const closeNeedle = `</quant:${tag}>`;
  let depth = 1;
  let pos = from;

  while (pos < source.length) {
    const nextOpen = source.indexOf(openNeedle, pos);
    const nextClose = source.indexOf(closeNeedle, pos);

    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const gt = source.indexOf(">", nextOpen);
      if (gt === -1) return -1;
      const header = source.slice(nextOpen, gt + 1);
      if (!header.endsWith("/>")) depth += 1;
      pos = gt + 1;
      continue;
    }

    depth -= 1;
    if (depth === 0) return nextClose;
    pos = nextClose + closeNeedle.length;
  }

  return -1;
}

function parseNodes(source: string): QuantUiNode[] {
  const nodes: QuantUiNode[] = [];
  let pos = 0;

  while (pos < source.length) {
    const slice = source.slice(pos);
    const match = OPEN_RE.exec(slice);
    if (!match) break;

    const full = match[0];
    const tag = match[1];
    const attrStr = match[2] ?? "";
    const selfClose = Boolean(match[3]);
    const attrs = parseAttributes(attrStr.trim());

    pos += match.index! + full.length;

    if (selfClose) {
      nodes.push({ tag, attrs, children: [] });
      continue;
    }

    const closeIdx = findClosingTag(source, tag, pos);
    if (closeIdx === -1) {
      nodes.push({ tag, attrs, children: [] });
      break;
    }

    const inner = source.slice(pos, closeIdx);
    pos = closeIdx + `</quant:${tag}>`.length;

    if (!inner.includes("<quant:")) {
      const text = inner.trim();
      nodes.push({ tag, attrs: text ? { ...attrs, text } : attrs, children: [] });
    } else {
      nodes.push({ tag, attrs, children: parseNodes(inner) });
    }
  }

  return nodes;
}

/** Parse Quant UI markup into an AST. Returns empty array if no tags found. */
export function parseQuantMarkup(source: string): QuantUiNode[] {
  if (!source || !source.includes("<quant:")) return [];
  return parseNodes(source.trim());
}

/** True when the string contains at least one quant tag. */
export function hasQuantMarkup(source: string): boolean {
  return /<quant:[\w-]+/i.test(source);
}
