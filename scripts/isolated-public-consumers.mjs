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
const version = "0.1.1";

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function packageFile(name) {
  const key = name.endsWith("editor-ai") ? "ai" : name.endsWith("editor-canvas") ? "canvas" : "publish";
  const packageVersion = name.endsWith("editor-core") ? version : packageConfig(key).version;
  const filename = `${name.replace(/^@/, "").replaceAll("/", "-")}-${packageVersion}.tgz`;
  return `file:${join(tarballDir, filename)}`;
}

function smokeSource(key) {
  if (key === "ai") return `
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { parseAgentRequest } from "@hello-ai-company/editor-ai";
const request = parseAgentRequest({ runId: "run-1", instruction: "Summarize this note", context: [{ id: "doc-1", kind: "document", text: "quoted source", trust: "untrusted" }] });
if (request.context[0]?.trust !== "untrusted") throw new Error("AI request trust marker lost");
if (createEditorDocument([]).schemaVersion !== 1) throw new Error("core package failed");
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
  if (key === "ai") return `import { parseAgentRequest } from "@hello-ai-company/editor-ai";\nvoid parseAgentRequest;\n`;
  if (key === "canvas") return `import { createMagicLayoutSpec, type CanvasLayoutSpec } from "@hello-ai-company/editor-canvas";\nimport { CanvasEditor } from "@hello-ai-company/editor-canvas/react";\nconst spec: CanvasLayoutSpec | undefined = undefined;\nvoid [createMagicLayoutSpec, CanvasEditor, spec];\n`;
  return `import { getPublicKnowledgeContext, renderOpenEditorDocx, renderOpenEditorMarkdown, renderOpenEditorSite } from "@hello-ai-company/editor-publish";\nvoid [getPublicKnowledgeContext, renderOpenEditorDocx, renderOpenEditorMarkdown, renderOpenEditorSite];\n`;
}

try {
  const tarballs = [
    { key: "core", name: "@hello-ai-company/editor-core", version },
    ...["ai", "canvas", "publish"].map((key) => ({ key, ...packageConfig(key) }))
  ];
  for (const item of tarballs) {
    const filename = `${item.name.replace(/^@/, "").replaceAll("/", "-")}-${item.version}.tgz`;
    run("npm", ["pack", "-w", item.name, "--pack-destination", tarballDir, "--ignore-scripts"]);
    const path = join(tarballDir, filename);
    if (!existsSync(path)) throw new Error(`npm pack did not create ${filename}`);
    if (item.key !== "core") run(process.execPath, [join(root, "scripts/inspect-public-tarballs.mjs"), item.key, path]);
  }

  for (const key of ["ai", "canvas", "publish"]) {
    const dir = join(work, `consumer-${key}`);
    const common = {
      "@hello-ai-company/editor-core": packageFile("@hello-ai-company/editor-core")
    };
    const dependencies = key === "ai"
      ? { ...common, "@hello-ai-company/editor-ai": packageFile("@hello-ai-company/editor-ai") }
      : key === "canvas"
        ? { ...common, "@hello-ai-company/editor-canvas": packageFile("@hello-ai-company/editor-canvas"), react: "19.1.0", "react-dom": "19.1.0" }
        : { ...common, "@hello-ai-company/editor-canvas": packageFile("@hello-ai-company/editor-canvas"), "@hello-ai-company/editor-publish": packageFile("@hello-ai-company/editor-publish"), react: "19.1.0", "react-dom": "19.1.0" };
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
      const expected = name.endsWith("editor-core") ? "0.1.1" : packageConfig(name.endsWith("editor-ai") ? "ai" : name.endsWith("editor-canvas") ? "canvas" : "publish").version;
      if (installed.version !== expected) throw new Error(`${key}: installed ${name}@${installed.version}, expected ${expected}`);
    }
    const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
    for (const name of Object.keys(dependencies).filter((entry) => entry.startsWith("@hello-ai-company/"))) {
      const resolved = lock.packages?.[`node_modules/${name}`]?.resolved ?? "";
      if (!resolved.includes(".tgz") || resolved.includes("workspace:")) throw new Error(`${key}: ${name} did not resolve from a tarball (${resolved || "missing"})`);
    }
    run("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], dir);
    run(process.execPath, ["smoke.mjs"], dir);
  }
  console.log("All isolated public-package consumers passed.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
