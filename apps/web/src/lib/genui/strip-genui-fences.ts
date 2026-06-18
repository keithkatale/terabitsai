/** Remove ```genui fenced blocks (including unclosed trailing fences) from markdown text. */
export function stripGenuiFences(text: string): string {
  return text.replace(/```genui\b[\s\S]*?(?:```|$)/gi, "").trim();
}
