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

// tsc removes source comments. Preserve the upstream SVG license in emitted code
// so downstream bundlers can retain its @license notice without a runtime dependency.
const iconsSource = readFileSync(join(srcRoot, "react/notesLucideIcons.ts"), "utf8");
const iconLicense = iconsSource.match(/^\/\*\* @license[\s\S]*?\*\/\n/)?.[0];
if (!iconLicense?.includes("Lucide Contributors") || !iconLicense.includes("Permission to use")) throw new Error("Missing Lucide license notice");
const iconsOutput = join(root, "packages/blocknote/dist/react/notesLucideIcons.js");
writeFileSync(join(dirname(iconsOutput), "NOTES-ICON-LICENSE.txt"), iconLicense);
const emittedIcons = readFileSync(iconsOutput, "utf8");
if (!emittedIcons.startsWith(iconLicense)) {
  writeFileSync(iconsOutput, iconLicense + emittedIcons);
  const sourceMapPath = iconsOutput + ".map", sourceMap = JSON.parse(readFileSync(sourceMapPath, "utf8"));
  sourceMap.mappings = ";".repeat(iconLicense.split("\n").length - 1) + sourceMap.mappings;
  writeFileSync(sourceMapPath, JSON.stringify(sourceMap));
}
