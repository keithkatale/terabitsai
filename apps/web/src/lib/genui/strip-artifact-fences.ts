import { stripGenuiFences } from "./strip-genui-fences";
import { stripQuantFences, stripQuantMarkup } from "@/lib/quant-ui/strip-quant-fences";

/** Remove artifact fences/markup when the server already injected UI. */
export function stripInjectedArtifactMarkdown(text: string): string {
  let t = stripGenuiFences(text);
  t = stripQuantFences(t);
  t = stripQuantMarkup(t);
  t = t.replace(/```json\s*\n?\{[\s\S]*?"component"\s*:[\s\S]*?```/gi, "").trim();
  return t;
}
