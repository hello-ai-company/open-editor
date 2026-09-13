import * as ts from "typescript";

const PROVIDER_TYPE_NAME = /^(NativeBridge|[A-Za-z][A-Za-z0-9]*Provider)$/;

export function isProviderTypeName(name: string): boolean {
  return name !== "EditorProviders" && PROVIDER_TYPE_NAME.test(name);
}

/**
 * Collect provider method names with TypeScript AST as the primary parser.
 * Also unions method?( / method?: / method() / method: ( patterns from
 * provider type bodies so host-specific actions cannot hide behind syntax.
 */
export function collectProviderMethods(source: string): string[] {
  const names = new Set<string>([
    ...collectProviderMethodsFromAst(source),
    ...collectProviderMethodsByPattern(source)
  ]);
  return [...names];
}

export function collectProviderMethodsFromAst(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    "providers.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const methods = new Set<string>();

  const addMembers = (members: readonly ts.TypeElement[]): void => {
    for (const member of members) {
      if (ts.isMethodSignature(member) && ts.isIdentifier(member.name)) {
        methods.add(member.name.text);
        continue;
      }
      if (ts.isPropertySignature(member) && ts.isIdentifier(member.name) && member.type) {
        if (ts.isFunctionTypeNode(member.type) || ts.isConstructorTypeNode(member.type)) {
          methods.add(member.name.text);
        }
      }
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && isProviderTypeName(node.name.text)) {
      addMembers(node.members);
    }
    if (ts.isTypeAliasDeclaration(node) && isProviderTypeName(node.name.text) && ts.isTypeLiteralNode(node.type)) {
      addMembers(node.type.members);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return [...methods];
}

export function collectProviderMethodsByPattern(source: string): string[] {
  const bodies: string[] = [];
  const typeDecl = /(?:export\s+)?type\s+(NativeBridge|[A-Za-z][A-Za-z0-9]*Provider)\s*=\s*\{([\s\S]*?)\n\s*\}/g;
  const ifaceDecl = /(?:export\s+)?interface\s+(NativeBridge|[A-Za-z][A-Za-z0-9]*Provider)\s*\{([\s\S]*?)\n\s*\}/g;
  for (const expression of [typeDecl, ifaceDecl]) {
    for (const match of source.matchAll(expression)) {
      if (match[1] && match[2] && isProviderTypeName(match[1])) bodies.push(match[2]);
    }
  }

  const names = new Set<string>();
  const patterns = [
    /^\s*([A-Za-z][A-Za-z0-9]*)\s*\?\s*\(/gm,
    /^\s*([A-Za-z][A-Za-z0-9]*)\s*\?\s*:/gm,
    /^\s*([A-Za-z][A-Za-z0-9]*)\s*\(/gm,
    /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(?:<[^>\n]+>)?\s*\(/gm
  ];
  for (const body of bodies) {
    for (const pattern of patterns) {
      for (const match of body.matchAll(pattern)) {
        if (match[1]) names.add(match[1]);
      }
    }
  }
  return [...names];
}
