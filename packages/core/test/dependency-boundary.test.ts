import { describe, expect, it } from "vitest";
import indexSource from "../src/index.ts?raw";
import modelSource from "../src/model.ts?raw";
import pageLinkSource from "../src/pageLink.ts?raw";
import providersSource from "../src/providers.ts?raw";
import relationsSource from "../src/relations.ts?raw";
import serializationSource from "../src/serialization.ts?raw";
import {
  collectProviderMethods,
  collectProviderMethodsByPattern,
  collectProviderMethodsFromAst
} from "./providerAllowlist.js";
import { loadProviderContract } from "./loadContracts.js";

const providerContract = loadProviderContract();

const productionSources: Record<string, string> = {
  "index.ts": indexSource,
  "model.ts": modelSource,
  "pageLink.ts": pageLinkSource,
  "providers.ts": providersSource,
  "relations.ts": relationsSource,
  "serialization.ts": serializationSource
};

const forbiddenImportExact = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "supabase"
]);

const forbiddenImportPrefixes = [
  "react/",
  "@blocknote/",
  "@supabase/",
  "personal-ai",
  "@personal-ai/"
];

const forbiddenSourcePatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: "@blocknote/xl-", pattern: /@blocknote\/xl-/ },
  { name: "xl- package", pattern: /@blocknote\/xl-[A-Za-z0-9-]+/ },
  { name: "personal-ai package or event", pattern: /personal-ai/ },
  { name: "host native bootstrap token", pattern: /__PAI_/ },
  { name: "REST collection path", pattern: /\/api\/v1\b/ },
  { name: "supabase", pattern: /\bsupabase\b/i },
  { name: "Secretary identifier", pattern: /\bSecretary\b/ },
  { name: "AgentTask identifier", pattern: /\bAgentTask\b/ }
];

const allowedProviderMethods = new Set(providerContract.allowedMethods);
const forbiddenProviderMethods = providerContract.forbiddenMethods;

describe("editorCore dependency boundary", () => {
  it("keeps production files inside the src directory", () => {
    expect(Object.keys(productionSources).sort()).toEqual([
      "index.ts",
      "model.ts",
      "pageLink.ts",
      "providers.ts",
      "relations.ts",
      "serialization.ts"
    ]);
  });

  it("forbids host, UI, and BlockNote imports with path-aware checks", () => {
    const violations: string[] = [];

    for (const [relative, source] of Object.entries(productionSources)) {
      for (const specifier of collectImportSpecifiers(source)) {
        if (isForbiddenImportSpecifier(specifier)) {
          violations.push(`${relative}: import ${specifier}`);
          continue;
        }
        if (specifier.startsWith(".")) {
          const resolved = resolveRelative(`src/${relative}`, specifier);
          if (!resolved.startsWith("src/") || resolved.split("/").includes("..")) {
            violations.push(`${relative}: import leaves src via ${specifier}`);
          }
          if (/(^|\/)(lib\/api|lib\/domain|components|editorBundle|editorAdapters)(\/|$)/.test(resolved)) {
            violations.push(`${relative}: import resolves through a host path via ${specifier}`);
          }
        } else {
          violations.push(`${relative}: package import ${specifier}`);
        }
      }

      for (const { name, pattern } of forbiddenSourcePatterns) {
        if (pattern.test(source)) {
          violations.push(`${relative}: source mentions ${name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("allowlists provider method names so host-specific actions cannot re-enter", () => {
    const methods = collectProviderMethods(providersSource);
    const unexpected = methods.filter((name) => !allowedProviderMethods.has(name));
    const missingForbidden = forbiddenProviderMethods.filter((name) => methods.includes(name) || identifierPresent(providersSource, name));

    expect(methods.length).toBeGreaterThan(0);
    expect(unexpected).toEqual([]);
    expect(missingForbidden).toEqual([]);
    expect(new Set(methods)).toEqual(allowedProviderMethods);

    const fromProviders = new Set(Object.values(providerContract.providers).flat());
    expect(fromProviders).toEqual(allowedProviderMethods);
  });

  it("parses method? / method?: / method() shapes via AST and pattern fallback", () => {
    const synthetic = `
      export type HostileProvider = {
        edit?: (request: { prompt: string }) => Promise<string>;
        openEmployees(): void;
        openStyleGallery?: () => void;
        listRows?(id: string): Promise<void>;
      };
    `;
    const fromAst = collectProviderMethodsFromAst(synthetic);
    const fromPattern = collectProviderMethodsByPattern(synthetic);
    const combined = collectProviderMethods(synthetic);

    expect(fromAst.sort()).toEqual(["edit", "listRows", "openEmployees", "openStyleGallery"]);
    expect(fromPattern).toEqual(expect.arrayContaining(["edit", "listRows", "openEmployees", "openStyleGallery"]));
    expect(combined).toEqual(expect.arrayContaining(["edit", "listRows", "openEmployees", "openStyleGallery"]));
    expect(combined).toEqual(expect.arrayContaining(forbiddenProviderMethods.filter((name) => synthetic.includes(name))));
  });
});

function collectImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importFrom = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  const sideEffect = /import\s+["']([^"']+)["']/g;
  const dynamicImport = /import\(\s*["']([^"']+)["']\s*\)/g;
  for (const expression of [importFrom, sideEffect, dynamicImport]) {
    for (const match of source.matchAll(expression)) {
      if (match[1]) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function identifierPresent(source: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(source);
}

function isForbiddenImportSpecifier(specifier: string): boolean {
  if (forbiddenImportExact.has(specifier)) return true;
  if (forbiddenImportPrefixes.some((prefix) => specifier === prefix || specifier.startsWith(prefix))) return true;
  if (specifier.includes("personal-ai")) return true;
  if (specifier.includes("@blocknote/xl-")) return true;
  if (/(^|\/)lib\/(api|domain)(\/|$)/.test(specifier)) return true;
  if (/(^|\/)(components|editorBundle)(\/|$)/.test(specifier)) return true;
  return false;
}

function resolveRelative(fromFile: string, specifier: string): string {
  const stripped = specifier.replace(/\.(?:js|ts|d\.ts)$/u, "");
  const fromDir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const parts = [...(fromDir ? fromDir.split("/") : []), ...stripped.split("/")];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}
