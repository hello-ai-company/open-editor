#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageConfig, tarballFilename } from "./release/public-package-config.mjs";

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), "open-editor-public-consumers-"));
const tarballDir = join(work, "tarballs");
mkdirSync(tarballDir, { recursive: true });
const version = JSON.parse(readFileSync(join(root, "packages/core/package.json"), "utf8")).version;
const coreTarball = join(tarballDir, `hello-ai-company-editor-core-${version}.tgz`);

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function candidateFile(name) {
  const key = name.endsWith("editor-ai") ? "ai" : name.endsWith("editor-canvas") ? "canvas" : "publish";
  const packageVersion = packageConfig(key).version;
  const filename = `${name.replace(/^@/, "").replaceAll("/", "-")}-${packageVersion}.tgz`;
  return `file:${join(tarballDir, filename)}`;
}

function smokeSource(key) {
  if (key === "ai") return `
import { createEditorDocument } from "@hello-ai-company/editor-core";
import assert from "node:assert/strict";
import { createAheadSession, parseAgentRequest } from "@hello-ai-company/editor-ai";
const request = parseAgentRequest({ runId: "run-1", instruction: "Summarize this note", context: [{ id: "doc-1", kind: "document", text: "quoted source", trust: "untrusted" }] });
if (request.context[0]?.trust !== "untrusted") throw new Error("AI request trust marker lost");
if (createEditorDocument([]).schemaVersion !== 1) throw new Error("core package failed");
let current = createEditorDocument([{ id: "human", type: "paragraph", content: "Human text" }]);
const original = structuredClone(current);
let calls = 0, writes = 0;
const adapter = {
  descriptor: { id: "synthetic-consumer", name: "Synthetic consumer", capabilities: ["proposals"] },
  async cancel() {},
  async *start(request) {
    calls++;
    assert.equal(request.context[0].trust, "untrusted");
    assert.equal(request.metadata.toolsAllowed, false);
    const baseDocument = JSON.parse(request.context[0].text);
    yield { runId: request.runId, sequence: 0, occurredAt: new Date().toISOString(), type: "suggestion", payload: {
      schemaVersion: 1, id: "synthetic-proposal", title: "Synthetic proposal", baseDocument,
      changes: [0, 1].map(index => ({ op: "insert", block: { id: "addition-" + index, type: "paragraph", content: "Prepared " + index } }))
    } };
    yield { runId: request.runId, sequence: 1, occurredAt: new Date().toISOString(), type: "status", status: "completed" };
  }
};
const session = createAheadSession({ adapter, document: current, maxRuns: 1, debounceMs: 0 });
try {
  assert.equal(calls, 0);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error("Synthetic candidate session timed out")); }, 5000);
    const unsubscribe = session.subscribe(() => {
      const snapshot = session.getSnapshot();
      if (snapshot.status === "failed" || snapshot.status === "blocked") {
        clearTimeout(timer); unsubscribe(); reject(new Error("Synthetic candidate session failed"));
      } else if (snapshot.status === "limit") {
        clearTimeout(timer); unsubscribe(); resolve();
      }
    });
    session.start("Prepare a synthetic addition");
  });
  assert.equal(calls, 1);
  assert.deepEqual(current, original);
  const id = session.getSnapshot().proposals[0].group.id;
  const writer = (expected, next) => { assert.deepEqual(current, expected); current = structuredClone(next); writes++; return true; };
  session.adopt(id, [1], current, writer, "human");
  assert.equal(current.blocks.length, 2);
  assert.equal(current.blocks[1].content, "Prepared 1");
  assert.throws(() => session.adopt(id, [1], current, writer, "human"));
  assert.equal(writes, 1);
  session.undo(current, writer);
  assert.deepEqual(current, original);
  assert.equal(writes, 2);
} finally { session.dispose(); }
console.log("editor-ai isolated runtime passed");
`;
  if (key === "canvas") return `
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createMagicLayoutSpec } from "@hello-ai-company/editor-canvas";
import { CanvasEditor } from "@hello-ai-company/editor-canvas/react";
const document = createEditorDocument([{ id: "p1", type: "paragraph", props: { text: "Consumer smoke" } }]);
const spec = createMagicLayoutSpec(document, "report");
const html = renderToStaticMarkup(React.createElement(CanvasEditor, { document, spec }));
if (!html.includes("Consumer smoke")) throw new Error("Canvas React subpath did not render document content");
console.log("editor-canvas root and React subpath isolated runtime passed");
`;
  return `
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { createMagicLayoutSpec } from "@hello-ai-company/editor-canvas";
import { getPublicKnowledgeContext, renderOpenEditorDocx, renderOpenEditorMarkdown, renderOpenEditorPresentation, renderOpenEditorSite } from "@hello-ai-company/editor-publish";
const document = createEditorDocument([{ id: "p1", type: "paragraph", props: { text: "Consumer smoke" } }]);
const canvasSpec = createMagicLayoutSpec(document, "report");
if (!renderOpenEditorSite(document, { canvasSpec }).includes("Consumer smoke")) throw new Error("Canvas-backed site render failed");
if (!renderOpenEditorMarkdown(document).includes("Consumer smoke")) throw new Error("Markdown export failed");
if (!renderOpenEditorPresentation(document, { canvasSpec }).includes("Consumer smoke")) throw new Error("Presentation export failed");
if (getPublicKnowledgeContext(document).trust !== "untrusted") throw new Error("public context trust marker lost");
const docx = await renderOpenEditorDocx(document);
if (!docx || docx.size <= 0) throw new Error("DOCX export returned no bytes");
console.log("editor-publish isolated ESM/runtime passed");
`;
}

function typeSource(key) {
  if (key === "ai") return `import { createAheadSession, parseAgentRequest, type AheadSession, type AheadDocumentWriter } from "@hello-ai-company/editor-ai";\nconst session: AheadSession | undefined = undefined;\nconst writer: AheadDocumentWriter = (_expected, _next) => true;\nvoid [createAheadSession, parseAgentRequest, session, writer];\n`;
  if (key === "canvas") return `import { createMagicLayoutSpec, type CanvasLayoutSpec } from "@hello-ai-company/editor-canvas";\nimport { CanvasEditor } from "@hello-ai-company/editor-canvas/react";\nconst spec: CanvasLayoutSpec | undefined = undefined;\nvoid [createMagicLayoutSpec, CanvasEditor, spec];\n`;
  return `import { getPublicKnowledgeContext, renderOpenEditorDocx, renderOpenEditorMarkdown, renderOpenEditorSite } from "@hello-ai-company/editor-publish";\nvoid [getPublicKnowledgeContext, renderOpenEditorDocx, renderOpenEditorMarkdown, renderOpenEditorSite];\n`;
}

try {
  run("npm", ["pack", "-w", "@hello-ai-company/editor-core", "--pack-destination", tarballDir, "--ignore-scripts"]);
  run(process.execPath, [join(root, "scripts/inspect-tarball.mjs"), coreTarball]);
  const tarballs = ["ai", "canvas", "publish"].map((key) => ({ key, ...packageConfig(key) }));
  for (const item of tarballs) {
    const filename = `${item.name.replace(/^@/, "").replaceAll("/", "-")}-${item.version}.tgz`;
    run("npm", ["pack", "-w", item.name, "--pack-destination", tarballDir, "--ignore-scripts"]);
    const path = join(tarballDir, filename);
    if (!existsSync(path)) throw new Error(`npm pack did not create ${filename}`);
    run(process.execPath, [join(root, "scripts/inspect-public-tarballs.mjs"), item.key, path]);
  }

  for (const key of ["ai", "canvas", "publish"]) {
    const dir = join(work, `consumer-${key}`);
    const common = {
      "@hello-ai-company/editor-core": `file:${coreTarball}`
    };
    const dependencies = key === "ai"
      ? { ...common, "@hello-ai-company/editor-ai": candidateFile("@hello-ai-company/editor-ai") }
      : key === "canvas"
        ? { ...common, "@hello-ai-company/editor-canvas": candidateFile("@hello-ai-company/editor-canvas"), react: "19.1.0", "react-dom": "19.1.0" }
        : { ...common, "@hello-ai-company/editor-canvas": candidateFile("@hello-ai-company/editor-canvas"), "@hello-ai-company/editor-publish": candidateFile("@hello-ai-company/editor-publish"), react: "19.1.0", "react-dom": "19.1.0" };
    // Each consumer lives outside the monorepo and installs the actual tarballs.
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `isolated-${key}-consumer`, private: true, type: "module", dependencies }, null, 2));
    writeFileSync(join(dir, "consume.ts"), typeSource(key));
    writeFileSync(join(dir, "smoke.mjs"), smokeSource(key));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true, skipLibCheck: true, jsx: "react-jsx" }, include: ["consume.ts"] }, null, 2));
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], dir);
    run("npm", ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "typescript@5.9.2"], dir);
    for (const name of Object.keys(dependencies).filter((entry) => entry.startsWith("@hello-ai-company/"))) {
      const installPath = join(dir, "node_modules", name);
      if (!existsSync(installPath) || lstatSync(installPath).isSymbolicLink()) throw new Error(`${key}: ${name} was not extracted from a tarball`);
      const installed = JSON.parse(readFileSync(join(installPath, "package.json"), "utf8"));
      const expected = name.endsWith("editor-core") ? version : packageConfig(name.endsWith("editor-ai") ? "ai" : name.endsWith("editor-canvas") ? "canvas" : "publish").version;
      if (installed.version !== expected) throw new Error(`${key}: installed ${name}@${installed.version}, expected ${expected}`);
    }
    const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
    for (const name of Object.keys(dependencies).filter((entry) => entry.startsWith("@hello-ai-company/"))) {
      const resolved = lock.packages?.[`node_modules/${name}`]?.resolved ?? "";
      if (!resolved.startsWith("file:") || !resolved.endsWith(".tgz")) {
        throw new Error(`${key}: ${name} did not resolve from its candidate tarball (${resolved || "missing"})`);
      }
    }
    run("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], dir);
    run(process.execPath, ["smoke.mjs"], dir);
  }
  console.log("All isolated public-package consumers passed.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
