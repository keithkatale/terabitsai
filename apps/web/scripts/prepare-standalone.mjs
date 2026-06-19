import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "../..");
const standaloneRoot = join(webRoot, ".next/standalone");
const standaloneWeb = join(standaloneRoot, "apps/web");

if (!existsSync(standaloneWeb)) {
  console.error("Standalone output missing:", standaloneWeb);
  process.exit(1);
}

cpSync(join(webRoot, "public"), join(standaloneWeb, "public"), { recursive: true });

const staticSrc = join(webRoot, ".next/static");
const staticDest = join(standaloneWeb, ".next/static");
mkdirSync(dirname(staticDest), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });

const pnpmRoot = join(repoRoot, "node_modules/.pnpm");
const prismaPkg = existsSync(pnpmRoot)
  ? readdirSync(pnpmRoot).find((entry) => entry.startsWith("@prisma+client@"))
  : undefined;

if (prismaPkg) {
  const prismaClientDir = join(pnpmRoot, prismaPkg, "node_modules/.prisma/client");
  const prismaTargets = [
    join(standaloneWeb, ".prisma/client"),
    join(standaloneRoot, "node_modules/.pnpm", prismaPkg, "node_modules/.prisma/client"),
  ];

  for (const target of prismaTargets) {
    mkdirSync(dirname(target), { recursive: true });
    cpSync(prismaClientDir, target, { recursive: true });
  }
}

console.log("Standalone bundle prepared at", standaloneWeb);
