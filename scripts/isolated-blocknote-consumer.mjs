import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

run("npm", ["run", "build", "-w", "@hello-ai-company/editor-core"], root);
run("npm", ["run", "build", "-w", "@hello-ai-company/editor-blocknote"], root);
run("npm", ["pack", "-w", "@hello-ai-company/editor-core", "--pack-destination", root], root);
run("npm", ["pack", "-w", "@hello-ai-company/editor-blocknote", "--pack-destination", root], root);

const coreTgz = join(root, "hello-ai-company-editor-core-0.1.0.tgz");
const bnTgz = join(root, "hello-ai-company-editor-blocknote-0.1.0.tgz");

function smokeBase(dir) {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "isolated-blocknote-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@hello-ai-company/editor-core": `file:${coreTgz}`,
          "@hello-ai-company/editor-blocknote": `file:${bnTgz}`,
          "@blocknote/core": "0.54.2",
          "@blocknote/react": "0.54.2",
          react: "^19.1.0",
          "react-dom": "^19.1.0"
        }
      },
      null,
      2
    )
  );

  writeFileSync(
    join(dir, "smoke.mjs"),
    `
import {
  createEditorDocument,
  relationEdgeId
} from "@hello-ai-company/editor-core";
import {
  fromBlockNote,
  toBlockNote,
  UNKNOWN_ENVELOPE_TYPE,
  createDefaultPowerCommands,
  createCommandRegistry,
  createDocumentIndex,
  createOpenEditorPowerPreset,
  createDocumentOutline,
  toPartialBlockCopy,
  createRelationIndex,
  extractRelationEdges,
  PAGE_MENTION_TYPE,
  DATABASE_RELATION_TYPE
} from "@hello-ai-company/editor-blocknote";

const doc = createEditorDocument([
  { id: "p1", type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] },
  { id: "u1", type: "mystery", props: { nested: { ok: true } } }
]);
const bn = toBlockNote(doc, { knownBlockTypes: ["paragraph", UNKNOWN_ENVELOPE_TYPE] });
if (bn[1]?.type !== UNKNOWN_ENVELOPE_TYPE) throw new Error("envelope missing");
const back = fromBlockNote(bn);
if (back.blocks[1]?.type !== "mystery") throw new Error("unwrap failed");
const registry = createCommandRegistry(createDefaultPowerCommands());
if (!registry.get("block.insert.callout")) throw new Error("commands missing");
const index = createDocumentIndex();
index.replaceFromBlocks([{ id: "h1", type: "heading", props: { level: 1 }, content: "Hi" }]);
if (createDocumentOutline(index).length !== 1) throw new Error("outline failed");
const preset = createOpenEditorPowerPreset();
if (!preset.schema) throw new Error("preset missing");
if (!preset.schema.inlineContentSchema?.pageMention) throw new Error("pageMention missing");
if (!preset.schema.inlineContentSchema?.databaseRelation) throw new Error("databaseRelation missing");
if (!preset.schema.blockSchema?.databaseView) throw new Error("databaseView missing");
if (!preset.registry.get("page.insert-mention")) throw new Error("workspace commands missing");
const withoutWs = createOpenEditorPowerPreset({ includeWorkspaceContent: false });
if (withoutWs.registry.get("page.insert-mention")) throw new Error("workspace commands should be absent");
if (withoutWs.schema.inlineContentSchema?.databaseRelation) throw new Error("databaseRelation should be absent");

const edges = extractRelationEdges("doc", [
  {
    id: "p1",
    type: "paragraph",
    content: [
      { type: PAGE_MENTION_TYPE, props: { pageId: "a" } },
      { type: DATABASE_RELATION_TYPE, props: { databaseId: "db-a", rowId: "row-1" } }
    ]
  }
]);
if (edges.length !== 2) throw new Error("relation extract failed");
const rowA = relationEdgeId({
  sourceDocumentId: "doc",
  targetType: "database-row",
  targetId: "row-1",
  targetDatabaseId: "db-a",
  kind: "database-row-relation"
});
const rowB = relationEdgeId({
  sourceDocumentId: "doc",
  targetType: "database-row",
  targetId: "row-1",
  targetDatabaseId: "db-b",
  kind: "database-row-relation"
});
if (rowA === rowB) throw new Error("row identity must be database-scoped");
const relIndex = createRelationIndex();
relIndex.replaceFromBlocks("doc", [
  {
    id: "p1",
    type: "paragraph",
    content: [{ type: DATABASE_RELATION_TYPE, props: { databaseId: "db-a", rowId: "row-1" } }]
  }
]);
if (relIndex.listByKind("database-row-relation").length !== 1) {
  throw new Error("relation index missing row relation");
}
const copy = toPartialBlockCopy({
  id: "x",
  type: "callout",
  props: { variant: "info" },
  content: [{ type: "text", text: "a", styles: {} }]
});
if (copy.id) throw new Error("duplicate copy must drop id");
if (copy.type !== "callout") throw new Error("duplicate copy lost type");
console.log("isolated-blocknote-consumer base: ok");
`
  );

  writeFileSync(
    join(dir, "smoke-react.mjs"),
    `
import { DocumentOutline, QuickNav, PageMentionPicker, BacklinksPanel } from "@hello-ai-company/editor-blocknote/react";
if (typeof DocumentOutline !== "function") throw new Error("DocumentOutline missing");
if (typeof QuickNav !== "function") throw new Error("QuickNav missing");
if (typeof PageMentionPicker !== "function") throw new Error("PageMentionPicker missing");
if (typeof BacklinksPanel !== "function") throw new Error("BacklinksPanel missing");
console.log("isolated-blocknote-consumer react: ok");
`
  );

  run("npm", ["install", "--omit=dev", "--legacy-peer-deps"], dir);
  run("node", ["smoke.mjs"], dir);
  run("node", ["smoke-react.mjs"], dir);

  // 4F-4E: prove Gallery/Feed media APIs + additive resolveMapLocation typecheck under strict.
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          jsx: "react-jsx"
        },
        include: ["media-api-compat.ts"]
      },
      null,
      2
    )
  );

  writeFileSync(
    join(dir, "media-api-compat.ts"),
    `
import type { JsonValue } from "@hello-ai-company/editor-core";
import type {
  DatabaseFeedRowMediaRequest,
  DatabaseMapLocation,
  DatabaseMapLocationRequest,
  DatabaseRowMedia,
  DatabaseRowMediaRequest,
  DatabaseViewRuntime
} from "@hello-ai-company/editor-blocknote";

/** Exact 4F-4B Gallery-only host callback shape. */
type LegacyGalleryRequest = {
  databaseId: string;
  rowKey: string;
  row: Readonly<Record<string, JsonValue>>;
  viewId: string;
  viewType: "gallery";
};

const legacyGalleryResolver = (
  request: LegacyGalleryRequest
): DatabaseRowMedia | null => {
  void request.viewType;
  return null;
};

const galleryTypedResolver = (
  request: DatabaseRowMediaRequest
): DatabaseRowMedia | null => {
  const _vt: "gallery" = request.viewType;
  void _vt;
  return { src: "https://example.test/g.png" };
};

const feedResolver = (
  request: DatabaseFeedRowMediaRequest
): DatabaseRowMedia | null => {
  const _vt: "feed" = request.viewType;
  void _vt;
  return { src: "https://example.test/f.png" };
};

const mapResolver = (
  request: DatabaseMapLocationRequest
): DatabaseMapLocation | null => {
  const _vt: "map" = request.viewType;
  void _vt;
  return { latitude: 0, longitude: 0, label: "Null Island" };
};

const runtime: DatabaseViewRuntime = {
  resolveRowMedia: legacyGalleryResolver
};

const runtimeGalleryTyped: DatabaseViewRuntime = {
  resolveRowMedia: galleryTypedResolver
};

const runtimeFeed: DatabaseViewRuntime = {
  resolveFeedRowMedia: feedResolver
};

const runtimeMap: DatabaseViewRuntime = {
  resolveMapLocation: mapResolver
};

const runtimeAll: DatabaseViewRuntime = {
  resolveRowMedia: legacyGalleryResolver,
  resolveFeedRowMedia: feedResolver,
  resolveMapLocation: mapResolver
};

void runtime;
void runtimeGalleryTyped;
void runtimeFeed;
void runtimeMap;
void runtimeAll;
`
  );

  run(
    "npm",
    [
      "install",
      "--no-save",
      "--legacy-peer-deps",
      "typescript@5.8.3",
      "@types/react@19"
    ],
    dir
  );
  run("npx", ["tsc", "-p", "tsconfig.json"], dir);
  console.log("isolated-blocknote-consumer media-api-compat (tsc --strict): ok");
}

function smokeOptional(dir, feature, peerPkg) {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `isolated-blocknote-${feature}`,
        private: true,
        type: "module",
        dependencies: {
          "@hello-ai-company/editor-core": `file:${coreTgz}`,
          "@hello-ai-company/editor-blocknote": `file:${bnTgz}`,
          "@blocknote/core": "0.54.2",
          "@blocknote/react": "0.54.2",
          [peerPkg]: "0.54.2",
          react: "^19.1.0",
          "react-dom": "^19.1.0"
        }
      },
      null,
      2
    )
  );

  const checks = {
    math: `
const types = Object.keys(preset.schema.blockSchema || {});
if (!types.includes("mathBlock")) throw new Error("mathBlock missing: " + types.join(","));
`,
    diagram: `
const types = Object.keys(preset.schema.blockSchema || {});
if (!types.includes("diagram")) throw new Error("diagram missing: " + types.join(","));
`,
    code: `
const options = preset.editorOptions();
if (!options.extensions || options.extensions.length === 0) {
  throw new Error("code feature extensions missing from editorOptions");
}
`
  };

  const exportName = `create${feature[0].toUpperCase()}${feature.slice(1)}PowerFeature`;

  writeFileSync(
    join(dir, "smoke.mjs"),
    `
import { createOpenEditorPowerPreset } from "@hello-ai-company/editor-blocknote";
import { ${exportName} } from "@hello-ai-company/editor-blocknote/${feature}";

const feature = ${exportName}();
if (!feature || feature.id !== "${feature}") {
  throw new Error("feature factory failed: ${feature}");
}
const preset = createOpenEditorPowerPreset({ features: [feature] });
if (!preset.featureIds.includes("${feature}")) {
  throw new Error("feature not registered on preset");
}
${checks[feature]}
console.log("isolated-blocknote-consumer ${feature}: ok");
`
  );

  run("npm", ["install", "--omit=dev", "--legacy-peer-deps"], dir);
  // Math/diagram pull katex/mermaid CSS side-effects — ignore .css in Node ESM.
  run(
    "node",
    ["--import", join(root, "scripts/register-ignore-css.mjs"), "smoke.mjs"],
    dir
  );
}

const dir = mkdtempSync(join(tmpdir(), "oe-bn-consumer-"));
try {
  smokeBase(dir);
  for (const [feature, peer] of [
    ["math", "@blocknote/math-block"],
    ["diagram", "@blocknote/diagram-block"],
    ["code", "@blocknote/code-block"]
  ]) {
    const featureDir = mkdtempSync(join(tmpdir(), `oe-bn-${feature}-`));
    try {
      smokeOptional(featureDir, feature, peer);
    } finally {
      rmSync(featureDir, { recursive: true, force: true });
    }
  }
  console.log("verify:isolated-blocknote PASS");
} finally {
  rmSync(dir, { recursive: true, force: true });
  for (const name of [
    "hello-ai-company-editor-core-0.1.0.tgz",
    "hello-ai-company-editor-blocknote-0.1.0.tgz"
  ]) {
    try {
      rmSync(join(root, name), { force: true });
    } catch {
      // ignore
    }
  }
}
