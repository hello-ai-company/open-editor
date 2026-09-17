import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      files.push(...walk(full));
    } else if (/\.(ts|tsx|js|mjs|cjs|json|md|css)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("license guard — no @blocknote/xl-*", () => {
  it("forbids xl- imports and package.json deps in editor-blocknote", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const files = [...walk(join(root, "src")), ...walk(join(root, "test"))].filter(
      (file) => !file.endsWith("license-guard.test.ts")
    );
    const violations: string[] = [];
    const pattern = /@blocknote\/xl-[A-Za-z0-9-]+/;

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (pattern.test(text)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const section of ["dependencies", "peerDependencies", "devDependencies"] as const) {
      for (const name of Object.keys(pkg[section] ?? {})) {
        expect(name.startsWith("@blocknote/xl-")).toBe(false);
      }
    }
  });
});
