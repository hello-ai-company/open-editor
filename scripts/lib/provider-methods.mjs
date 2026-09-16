import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const PROVIDER_TYPE_NAME = /^(NativeBridge|[A-Za-z][A-Za-z0-9]*Provider)$/;

export function isProviderTypeName(name) {
  return name !== "EditorProviders" && PROVIDER_TYPE_NAME.test(name);
}

export function collectProviderMethodsFromAst(source) {
  const sourceFile = ts.createSourceFile(
    "providers.d.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const methods = new Set();

  const addMembers = (members) => {
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

  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && isProviderTypeName(node.name.text)) {
      addMembers(node.members);
    }
    if (
      ts.isTypeAliasDeclaration(node)
      && isProviderTypeName(node.name.text)
      && ts.isTypeLiteralNode(node.type)
    ) {
      addMembers(node.type.members);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return [...methods];
}

export function collectProviderMethods(source) {
  return [...new Set([
    ...collectProviderMethodsFromAst(source),
    ...collectProviderMethodsByPattern(source)
  ])];
}

export function collectProviderMethodsByPattern(source) {
  const bodies = [];
  const typeDecl = /(?:export\s+)?type\s+(NativeBridge|[A-Za-z][A-Za-z0-9]*Provider)\s*=\s*\{([\s\S]*?)\n\s*\}/g;
  const ifaceDecl = /(?:export\s+)?interface\s+(NativeBridge|[A-Za-z][A-Za-z0-9]*Provider)\s*\{([\s\S]*?)\n\s*\}/g;
  for (const expression of [typeDecl, ifaceDecl]) {
    for (const match of source.matchAll(expression)) {
      if (match[1] && match[2] && isProviderTypeName(match[1])) bodies.push(match[2]);
    }
  }

  const names = new Set();
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

export function collectExportedTypeNames(source) {
  const names = new Set();
  const typeExportBlock = /export\s+type\s*\{([^}]+)\}/g;
  const namedExportBlock = /export\s*\{([^}]+)\}/g;
  for (const expression of [typeExportBlock, namedExportBlock]) {
    for (const match of source.matchAll(expression)) {
      const body = match[1];
      if (!body) continue;
      for (const part of body.split(",")) {
        const identifier = part.replace(/\btype\b/g, "").replace(/\bas\b[\s\S]*/g, "").trim();
        if (identifier && /^[A-Za-z][A-Za-z0-9]*$/.test(identifier)) {
          names.add(identifier);
        }
      }
    }
  }
  return [...names];
}
