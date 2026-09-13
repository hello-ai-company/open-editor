#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcRoot = join(root, "packages/core/src");

const forbidden = [
  { name: "personal-ai", pattern: /personal-ai/i },
  { name: "openEmployees", pattern: /openEmployees/ },
  { name: "NoteRichEditor", pattern: /NoteRichEditor/ },
  { name: "noteBlockSync", pattern: /noteBlockSync/ },
  { name: "editorAdapters", pattern: /editorAdapters/ },
  { name: "__PAI_", pattern: /__PAI_/ },
  { name: "@blocknote", pattern: /@blocknote/ },
  { name: "supabase", pattern: /supabase/i },
  { name: "Secretary", pattern: /\bSecretary\b/ },
  { name: "AgentTask", pattern: /\bAgentTask\b/ },
  { name: "react", pattern: /from ["']react["']/ }
];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const violations = [];
for (const file of walk(srcRoot)) {
  const source = readFileSync(file, "utf8");
  for (const { name, pattern } of forbidden) {
    if (pattern.test(source)) {
      violations.push(`${relative(root, file)}: ${name}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Security scan failed:\n", violations.join("\n"));
  process.exit(1);
}

const audit = execFileSync("npm", ["audit", "--omit=dev", "--audit-level=high"], {
  cwd: root,
  encoding: "utf8"
});
console.log(audit);
console.log("Security scan passed for packages/core/src (no host leakage).");
