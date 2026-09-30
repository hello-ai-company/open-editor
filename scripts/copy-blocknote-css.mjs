import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "packages/blocknote/src");
const src = join(srcRoot, "power.css");
const dest = join(root, "packages/blocknote/dist/power.css");

let importCount = 0;
const css = readFileSync(src, "utf8").replace(
  /^@import\s+["']([^"']+)["'];\s*$/gm,
  (_match, request) => {
    const modulePath = resolve(srcRoot, request);
    const moduleRoot = resolve(srcRoot, "power") + sep;
    if (!modulePath.startsWith(moduleRoot)) {
      throw new Error(`BlockNote CSS import must stay inside src/power: ${request}`);
    }
    importCount += 1;
    return readFileSync(modulePath, "utf8");
  }
);
if (importCount === 0 || /@import\s/.test(css)) {
  throw new Error("BlockNote CSS entry must contain only local, resolvable @import statements.");
}

mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, css);
