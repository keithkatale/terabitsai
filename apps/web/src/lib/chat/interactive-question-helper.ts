export interface ParsedInteractiveQuestion {
  id: string;
  type: "single-select" | "multi-select" | "input";
  title: string;
  description?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

/** Parses <interactive-question> XML-like tags from assistant messages. */
export function parseInteractiveQuestion(text: string): ParsedInteractiveQuestion | null {
  const match = text.match(/<interactive-question([\s\S]*?)>([\s\S]*?)<\/interactive-question>/i);
  if (!match) return null;

  const attrsStr = match[1];
  const contentStr = match[2];

  const idMatch = attrsStr.match(/id="([^"]+)"/i);
  const typeMatch = attrsStr.match(/type="([^"]+)"/i);

  if (!idMatch || !typeMatch) return null;

  const id = idMatch[1];
  const type = typeMatch[1].toLowerCase() as ParsedInteractiveQuestion["type"];

  const titleMatch = contentStr.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Suggested next steps";

  const descMatch = contentStr.match(/<description>([\s\S]*?)<\/description>/i);
  const description = descMatch ? descMatch[1].trim() : undefined;

  const placeholderMatch = contentStr.match(/<placeholder>([\s\S]*?)<\/placeholder>/i);
  const placeholder = placeholderMatch ? placeholderMatch[1].trim() : undefined;

  const options: { value: string; label: string }[] = [];
  const optionRegex = /<option\s+value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi;
  let optionMatch: RegExpExecArray | null;
  while ((optionMatch = optionRegex.exec(contentStr)) !== null) {
    options.push({
      value: optionMatch[1],
      label: optionMatch[2].trim(),
    });
  }

  if (options.length === 0 && type !== "input") return null;

  return { id, type, title, description, placeholder, options };
}

/** Remove interactive-question blocks so they do not render as raw text. */
export function stripInteractiveQuestionMarkup(text: string): string {
  let t = text.replace(/<interactive-question[\s\S]*?<\/interactive-question>/gi, "").trimEnd();
  t = t.replace(/<interactive-question[\s\S]*$/gi, "").trimEnd();
  return t;
}

export function hasInteractiveQuestionMarkup(text: string): boolean {
  return /<interactive-question[\s\S]*?<\/interactive-question>/i.test(text);
}
