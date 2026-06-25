/**
 * Unified skill library — loads SKILL.md content from native + external repos.
 */
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { resolveSkillsPath } from "./resolve-skills-path";

export type SkillSource = "native" | "claude-trading-skills" | "finance-skills";

export type SkillDocument = {
  id: string;
  source: SkillSource;
  relativePath: string;
  skillMdPath: string;
  name: string;
  description: string;
  body: string;
  category: string;
};

const CACHE = new Map<string, SkillDocument>();

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim().replace(/^>|$/, "").trim();
  }
  return { meta, body: match[2].trim() };
}

async function findSkillMdPaths(baseDir: string, source: SkillSource): Promise<Array<{ rel: string; abs: string }>> {
  const results: Array<{ rel: string; abs: string }> = [];

  async function walk(dir: string, prefix: string) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith("_") || name.startsWith(".")) continue;
      const abs = join(dir, name);
      const st = await stat(abs);
      if (st.isDirectory()) {
        await walk(abs, prefix ? `${prefix}/${name}` : name);
      } else if (name === "SKILL.md") {
        results.push({ rel: prefix, abs });
      }
    }
  }

  await walk(baseDir, "");
  return results.map((r) => ({ ...r, source } as { rel: string; abs: string; source: SkillSource }));
}

export async function loadSkillDocument(skillId: string): Promise<SkillDocument | null> {
  if (CACHE.has(skillId)) return CACHE.get(skillId)!;

  const skillsRoot = resolveSkillsPath();
  const searchPaths: Array<{ source: SkillSource; base: string }> = [
    { source: "native", base: skillsRoot },
    { source: "claude-trading-skills", base: join(skillsRoot, "external/claude-trading-skills") },
    { source: "finance-skills", base: join(skillsRoot, "external/finance-skills") },
  ];

  for (const { source, base } of searchPaths) {
    const paths = await findSkillMdPaths(base, source);
    for (const p of paths) {
      const folderName = p.rel.split("/").pop() ?? p.rel;
      const raw = await readFile(p.abs, "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const id = meta.name || folderName;
      if (id !== skillId && folderName !== skillId) continue;

      const doc: SkillDocument = {
        id,
        source,
        relativePath: p.rel,
        skillMdPath: p.abs,
        name: meta.name || folderName,
        description: meta.description || "",
        body,
        category: p.rel.split("/")[0] || "general",
      };
      CACHE.set(skillId, doc);
      CACHE.set(id, doc);
      return doc;
    }
  }

  return null;
}

/** Compact skill guidance for LLM when executing a knowledge-only skill. */
export async function buildSkillGuidancePrompt(skillId: string, maxChars = 6000): Promise<string | null> {
  const doc = await loadSkillDocument(skillId);
  if (!doc) return null;

  const header = `# Skill: ${doc.name}\nSource: ${doc.source}\n\n${doc.description}\n\n`;
  const body = doc.body.slice(0, maxChars - header.length);
  return `${header}${body}\n\nFollow this skill's workflow. Use available tools for data — never invent numbers.`;
}

export async function listAvailableSkillIds(): Promise<string[]> {
  const skillsRoot = resolveSkillsPath();
  const ids = new Set<string>();

  const bases = [
    skillsRoot,
    join(skillsRoot, "external/claude-trading-skills"),
    join(skillsRoot, "external/finance-skills"),
  ];

  for (const base of bases) {
    const paths = await findSkillMdPaths(base, "native");
    for (const p of paths) {
      const folderName = p.rel.split("/").pop() ?? p.rel;
      try {
        const raw = await readFile(p.abs, "utf8");
        const { meta } = parseFrontmatter(raw);
        ids.add(meta.name || folderName);
      } catch {
        ids.add(folderName);
      }
    }
  }

  return [...ids].sort();
}
