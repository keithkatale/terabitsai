import { normalizeGenUiPayload } from "@/components/generative-ui/genui-types";

const LEAF_TYPES = new Set([
  "stat",
  "metricCard",
  "sparkline",
  "gauge",
  "progress",
  "callout",
  "badge",
  "keyValue",
  "barlist",
  "table",
  "chart",
  "text",
  "divider",
  "component",
  "actionButton",
]);

const LAYOUT_TYPES = new Set(["section", "grid"]);

function closeBrackets(s: string): string {
  const openBraces = (s.match(/\{/g) ?? []).length;
  const closeBraces = (s.match(/\}/g) ?? []).length;
  const openBrackets = (s.match(/\[/g) ?? []).length;
  const closeBrackets = (s.match(/\]/g) ?? []).length;
  return s + "]".repeat(Math.max(0, openBrackets - closeBrackets)) + "}".repeat(Math.max(0, openBraces - closeBraces));
}

function stripIncompleteTail(s: string): string {
  let out = s.trim();
  out = out.replace(/,\s*"[^"]*"\s*:\s*("[^"]*)?$/g, "");
  out = out.replace(/,\s*"[^"]*"\s*:\s*$/g, "");
  out = out.replace(/,\s*\{[^}]*$/g, "");
  out = out.replace(/,\s*\[[^\]]*$/g, "");
  out = out.replace(/,\s*$/g, "");
  return out;
}

/**
 * Repair common LLM JSON mistakes before parsing.
 */
export function repairAiJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:genui|json)?\s*/i, "").replace(/```\s*$/i, "");
  // Smart quotes to regular quotes
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  // Ellipses in numbers
  s = s.replace(/(\d+)\.{2,}/g, "$1");
  // Trailing ellipses
  s = s.replace(/,\s*\.{2,}[^\]\}]*/g, "");
  s = s.replace(/\.{3,}/g, "");
  // Trailing commas before close
  s = s.replace(/,\s*([\]\}])/g, "$1");
  // Fix unquoted keys (common LLM mistake)
  s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
  // Fix single quotes used for strings
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
  // Fix NaN and undefined
  s = s.replace(/:\s*NaN\b/g, ": null");
  s = s.replace(/:\s*undefined\b/g, ": null");
  // Fix trailing text after valid JSON
  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start > 0) s = s.slice(start);
  
  s = stripIncompleteTail(s);
  return closeBrackets(s).trim();
}

/** Diagnose common JSON/genui issues for helpful error messages */
export function diagnoseGenUiIssue(raw: string): string {
  const trimmed = raw.trim();
  
  if (!trimmed) return "Empty payload received";
  
  // Check if it looks like it starts with JSON
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    if (trimmed.startsWith("<")) {
      return "Received HTML/XML instead of JSON. GenUI expects a JSON object with 'type' fields.";
    }
    return "Payload doesn't start with { or [ - expected JSON object or array";
  }
  
  // Try to parse and get specific error
  try {
    JSON.parse(trimmed);
    // If it parses but normalizeGenUiPayload fails, it's a schema issue
    return "JSON is valid but doesn't contain recognized genui node types (stat, metricCard, chart, etc.)";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    
    // Parse specific JSON errors
    if (msg.includes("Unexpected token")) {
      const posMatch = msg.match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const context = trimmed.slice(Math.max(0, pos - 20), pos + 20);
        return `JSON syntax error near: "...${context}..."`;
      }
    }
    if (msg.includes("Unexpected end")) {
      return "JSON is incomplete - likely cut off mid-output";
    }
    
    return `JSON parse error: ${msg}`;
  }
}

/** Walk the string and extract every fully-balanced `{...}` object. */
function extractBalancedObjects(raw: string): unknown[] {
  const objects: unknown[] = [];
  let i = 0;

  while (i < raw.length) {
    if (raw[i] !== "{") {
      i++;
      continue;
    }

    const start = i;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (; i < raw.length; i++) {
      const c = raw[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\" && inString) {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const slice = raw.slice(start, i + 1);
          try {
            objects.push(JSON.parse(repairAiJson(slice)));
          } catch {
            // skip unparseable object
          }
          i++;
          break;
        }
      }
    }

    if (depth !== 0) break;
    if (i === start) i++;
  }

  return objects;
}

/** Progressively shorten until JSON.parse succeeds. */
function tryProgressiveSalvage(raw: string): unknown | null {
  const base = repairAiJson(raw);
  try {
    return JSON.parse(base);
  } catch {
    // continue
  }

  for (let cut = base.length; cut > 24; cut -= 1) {
    let fragment = base.slice(0, cut);
    fragment = stripIncompleteTail(fragment);
    fragment = closeBrackets(fragment);
    try {
      return JSON.parse(fragment);
    } catch {
      // keep cutting
    }
  }

  return null;
}

/** Pull renderable leaf widgets out of broken JSON text. */
function salvageLooseNodes(raw: string): unknown[] {
  const objects = extractBalancedObjects(raw);
  const leaves: unknown[] = [];

  for (const obj of objects) {
    collectLeaves(obj, leaves);
  }

  // Regex fallback for metricCard objects cut off inside incomplete parents
  if (leaves.length === 0) {
    const cardRe = /\{\s*"type"\s*:\s*"metricCard"[\s\S]*?\}/g;
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(raw)) !== null) {
      try {
        const parsed = JSON.parse(repairAiJson(m[0]));
        if ((parsed as { type?: string }).type === "metricCard") leaves.push(parsed);
      } catch {
        // skip
      }
    }
  }

  return leaves;
}

function collectLeaves(obj: unknown, leaves: unknown[]): void {
  if (!obj || typeof obj !== "object") return;
  const type = (obj as { type?: string }).type;
  if (type && LEAF_TYPES.has(type)) {
    leaves.push(obj);
    return;
  }
  if (type === "section" || type === "grid") {
    const children = (obj as { children?: unknown[] }).children;
    if (Array.isArray(children)) {
      for (const child of children) collectLeaves(child, leaves);
    }
  }
}

export type ParseGenUiResult = {
  payload: unknown;
  salvaged: boolean;
  diagnosis?: string;
};

/**
 * Parse GenUI JSON — tries strict parse, repair, progressive truncation, then loose node extraction.
 */
export function parseGenUiJson(raw: string): unknown | null {
  return parseGenUiPayload(raw)?.payload ?? null;
}

export function parseGenUiPayload(raw: string): ParseGenUiResult | null {
  if (!raw?.trim()) return null;

  // 1. Strict + repair
  try {
    const repaired = repairAiJson(raw);
    const parsed = JSON.parse(repaired);
    const nodes = normalizeGenUiPayload(parsed);
    if (nodes?.length) {
      return { payload: parsed, salvaged: false };
    }
    // Parsed but no valid nodes
    return { 
      payload: parsed, 
      salvaged: false, 
      diagnosis: "JSON parsed successfully but contains no recognized genui node types" 
    };
  } catch {
    // continue
  }

  // 2. Progressive truncation (handles cut-off mid-object)
  const progressive = tryProgressiveSalvage(raw);
  if (progressive && normalizeGenUiPayload(progressive)?.length) {
    return { payload: progressive, salvaged: true };
  }

  // 3. Extract complete leaf widgets from the raw text
  const leaves = salvageLooseNodes(raw);
  if (leaves.length > 0) {
    return { payload: { view: leaves }, salvaged: true };
  }

  // 4. Outermost slice attempt
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = raw.slice(start, end + 1);
    const fromSlice = tryProgressiveSalvage(slice);
    if (fromSlice && normalizeGenUiPayload(fromSlice)?.length) {
      return { payload: fromSlice, salvaged: true };
    }
  }

  return null;
}

/**
 * Attempt to parse and return detailed error info if it fails
 */
export function parseGenUiPayloadWithDiagnosis(raw: string): ParseGenUiResult & { error?: string } {
  const result = parseGenUiPayload(raw);
  
  if (result && normalizeGenUiPayload(result.payload)?.length) {
    return result;
  }
  
  // Generate helpful diagnosis
  const diagnosis = diagnoseGenUiIssue(raw);
  
  if (result) {
    return { ...result, error: diagnosis };
  }
  
  return { payload: null, salvaged: false, error: diagnosis };
}
