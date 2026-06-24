import { existsSync } from "fs";
import { join } from "path";

/** Resolve skills/ directory from monorepo root or apps/web cwd. */
export function resolveSkillsPath(): string {
  const candidates = [
    join(process.cwd(), "skills"),
    join(process.cwd(), "..", "..", "skills"),
    join(process.cwd(), "..", "skills"),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "skills-index.yaml"))) {
      return candidate;
    }
  }

  return join(process.cwd(), "..", "..", "skills");
}
