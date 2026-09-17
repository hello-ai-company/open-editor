import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "packages/blocknote/src/power.css");
const dest = join(root, "packages/blocknote/dist/power.css");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
