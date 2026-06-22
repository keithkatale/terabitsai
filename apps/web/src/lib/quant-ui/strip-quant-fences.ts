/** Remove ```quant fenced blocks (including unclosed trailing fences) from markdown text. */
export function stripQuantFences(text: string): string {
  return text.replace(/```quant\b[\s\S]*?(?:```|$)/gi, "").trim();
}

/** Remove inline quant markup blocks when the server already injected the artifact. */
export function stripQuantMarkup(text: string): string {
  return text.replace(/<quant:[\s\S]*?(?:<\/quant:[\w-]+>|\/\>)/gi, "").trim();
}
