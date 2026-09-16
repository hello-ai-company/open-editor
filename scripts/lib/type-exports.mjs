import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function hasExportModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function scriptKindFor(fileName) {
  if (fileName.endsWith(".d.ts")) return ts.ScriptKind.TS;
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

/**
 * Collect type-only public export names from a TS / .d.ts barrel.
 *
 * Includes:
 * - `export type { Foo, Bar }`
 * - `export { type Foo, valueBar }` → Foo only
 * - `export type Alias = ...`
 * - `export interface I { ... }`
 *
 * Excludes runtime value exports (functions, classes, const, non-type specifiers).
 */
export function collectTypeExportNames(source, fileName = "index.d.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName)
  );
  const names = new Set();

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const declarationIsTypeOnly = statement.isTypeOnly === true;
      for (const specifier of statement.exportClause.elements) {
        if (!declarationIsTypeOnly && specifier.isTypeOnly !== true) continue;
        if (ts.isIdentifier(specifier.name)) {
          names.add(specifier.name.text);
        }
      }
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement)) {
      names.add(statement.name.text);
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) && hasExportModifier(statement)) {
      names.add(statement.name.text);
    }
  }

  return [...names];
}

export function diffTypeExports(actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((name) => !actualSet.has(name)).sort();
  const extra = [...actualSet].filter((name) => !expectedSet.has(name)).sort();
  return { missing, extra };
}

export function typeExportsMatch(actual, expected) {
  const { missing, extra } = diffTypeExports(actual, expected);
  return missing.length === 0 && extra.length === 0;
}
