import * as ts from "typescript";

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(
    (node as ts.TypeAliasDeclaration | ts.InterfaceDeclaration).modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  );
}

/**
 * Type-only public export names. Keep in sync with scripts/lib/type-exports.mjs.
 * Runtime named exports (functions, classes, const) are excluded.
 */
export function collectTypeExportNames(source: string, fileName = "index.ts"): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const names = new Set<string>();

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

export function diffTypeExports(
  actual: readonly string[],
  expected: readonly string[]
): { missing: string[]; extra: string[] } {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((name) => !actualSet.has(name)).sort();
  const extra = [...actualSet].filter((name) => !expectedSet.has(name)).sort();
  return { missing, extra };
}

export function typeExportsMatch(actual: readonly string[], expected: readonly string[]): boolean {
  const { missing, extra } = diffTypeExports(actual, expected);
  return missing.length === 0 && extra.length === 0;
}
