#!/usr/bin/env node
/**
 * BlockNote compatibility matrix — real install + compile + smoke (not semver guess).
 *
 * Never uses --force or --legacy-peer-deps. Never publishes.
 *
 * Layers per candidate version:
 *  A) Published peer resolution — install packed editor-blocknote as-is
 *  B) API probe — re-pack with temporarily widened peers (matrix-only) to test
 *     whether the built JS/types actually work against that BlockNote line
 *  C) Source typecheck — isolated copy of packages/blocknote against pinned peers
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
  copyFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CANDIDATES = (process.env.BN_COMPAT_VERSIONS ?? "0.52.1,0.54.2")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function run(command, args, cwd, opts = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...(opts.env ?? {}) },
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ok: (result.status ?? 1) === 0
  };
}

function ensurePacks() {
  const coreBuild = run("npm", ["run", "build", "-w", "@hello-ai-company/editor-core"], root);
  if (!coreBuild.ok) {
    console.error(coreBuild.stdout, coreBuild.stderr);
    process.exit(1);
  }
  const bnBuild = run("npm", ["run", "build", "-w", "@hello-ai-company/editor-blocknote"], root);
  if (!bnBuild.ok) {
    console.error(bnBuild.stdout, bnBuild.stderr);
    process.exit(1);
  }
  for (const script of ["pack:core", "pack:blocknote"]) {
    const packed = run("npm", ["run", script], root);
    if (!packed.ok) {
      console.error(packed.stdout, packed.stderr);
      process.exit(1);
    }
  }
  const coreTgz = join(root, "hello-ai-company-editor-core-0.1.0.tgz");
  const bnTgz = join(root, "hello-ai-company-editor-blocknote-0.1.0.tgz");
  if (!existsSync(coreTgz) || !existsSync(bnTgz)) {
    console.error("Missing packed tarballs");
    process.exit(1);
  }
  return { coreTgz, bnTgz };
}

function optionalPeersFor(version) {
  if (version.startsWith("0.54.")) {
    return {
      "@blocknote/math-block": version,
      "@blocknote/diagram-block": version,
      "@blocknote/code-block": version
    };
  }
  return { "@blocknote/code-block": version };
}

/**
 * Matrix-only: rewrite peerDependencies inside a packed tarball so npm can
 * install an older BlockNote line without --legacy-peer-deps. Production
 * package.json is unchanged.
 */
function repackWithPeers(bnTgz, peerCoreRange, outName) {
  const work = mkdtempSync(join(tmpdir(), "oe-bn-repack-"));
  try {
    run("tar", ["-xzf", bnTgz, "-C", work]);
    const pkgPath = join(work, "package", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.peerDependencies = {
      ...pkg.peerDependencies,
      "@blocknote/core": peerCoreRange,
      "@blocknote/react": peerCoreRange
    };
    // Drop optional peers that do not exist / mismatch on older lines so npm does not try them
    if (!String(peerCoreRange).includes("0.54") || String(peerCoreRange).includes("0.52")) {
      // For matrix widened tarball used against both lines: loosen optional code-block too
      if (pkg.peerDependencies["@blocknote/code-block"]) {
        pkg.peerDependencies["@blocknote/code-block"] = peerCoreRange;
      }
      // math/diagram do not exist on 0.52.x — remove so install against 0.52.1 can omit them
      delete pkg.peerDependencies["@blocknote/math-block"];
      delete pkg.peerDependencies["@blocknote/diagram-block"];
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    const outDir = mkdtempSync(join(tmpdir(), "oe-bn-repack-out-"));
    const packed = run("npm", ["pack", "--pack-destination", outDir], join(work, "package"));
    if (!packed.ok) {
      throw new Error(`repack failed: ${packed.stderr}`);
    }
    const outPath = join(root, outName);
    const produced = join(outDir, "hello-ai-company-editor-blocknote-0.1.0.tgz");
    copyFileSync(produced, outPath);
    rmSync(outDir, { recursive: true, force: true });
    return outPath;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function writeConsumerFiles(dir) {
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM"],
          module: "Node16",
          moduleResolution: "Node16",
          strict: true,
          jsx: "react-jsx",
          skipLibCheck: true,
          noEmit: true,
          verbatimModuleSyntax: true,
          isolatedModules: true
        },
        include: ["smoke.ts"]
      },
      null,
      2
    )
  );
  writeFileSync(
    join(dir, "smoke.ts"),
    `import { createEditorDocument } from "@hello-ai-company/editor-core";
import {
  fromBlockNote,
  toBlockNote,
  UNKNOWN_ENVELOPE_TYPE,
  createOpenEditorPowerPreset,
  createDefaultPowerCommands,
  createCommandRegistry,
  createDocumentIndex
} from "@hello-ai-company/editor-blocknote";
import { filterSuggestionItems } from "@blocknote/core/extensions";

const doc = createEditorDocument([
  { id: "p1", type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] },
  { id: "u1", type: "mystery", props: { nested: { ok: true } } }
]);
const bn = toBlockNote(doc, { knownBlockTypes: ["paragraph", UNKNOWN_ENVELOPE_TYPE] });
const round = fromBlockNote(bn);
if (!round.blocks.some((b) => b.id === "p1")) {
  throw new Error("roundtrip lost paragraph");
}
const power = createOpenEditorPowerPreset();
if (!power.schema) throw new Error("missing schema");
const commands = createDefaultPowerCommands();
if (commands.length < 1) throw new Error("empty commands");
const registry = createCommandRegistry(commands);
const fakeCtx = {
  editor: {
    insertBlocks: () => undefined,
    updateBlock: () => undefined,
    getTextCursorPosition: () => ({ block: { id: "p1" } }),
    transact: <T,>(fn: () => T) => fn()
  }
};
const listed = registry.list("slash", fakeCtx);
if (listed.length < 1) throw new Error("slash list empty");
const index = createDocumentIndex();
index.replaceFromBlocks(round.blocks);
if (index.size() < 1) throw new Error("empty index");
const filtered = filterSuggestionItems(
  [{ title: "Callout", aliases: ["info"], key: "callout" }],
  "cal"
);
if (!Array.isArray(filtered)) throw new Error("filterSuggestionItems shape");
console.log("SMOKE_OK");
`
  );
}

function installConsumer(dir, { coreTgz, bnTgz, version, withOptional }) {
  const deps = {
    "@hello-ai-company/editor-core": `file:${coreTgz}`,
    "@hello-ai-company/editor-blocknote": `file:${bnTgz}`,
    "@blocknote/core": version,
    "@blocknote/react": version,
    react: "^19.1.0",
    "react-dom": "^19.1.0",
    typescript: "^5.9.2",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6"
  };
  if (withOptional) {
    Object.assign(deps, optionalPeersFor(version));
  }
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `oe-bn-compat-${version.replace(/\./g, "-")}`,
        private: true,
        type: "module",
        dependencies: deps
      },
      null,
      2
    )
  );
  writeConsumerFiles(dir);
  return run("npm", ["install", "--no-fund", "--no-audit"], dir);
}

function probeConsumer(version, bnTgz, coreTgz, label) {
  const dir = mkdtempSync(join(tmpdir(), `oe-bn-${label}-${version}-`));
  const row = {
    label,
    version,
    install: null,
    typecheck: null,
    runtime: null,
    notes: []
  };
  try {
    let install = installConsumer(dir, {
      coreTgz,
      bnTgz,
      version,
      withOptional: true
    });
    if (!install.ok) {
      const err = (install.stderr + install.stdout).slice(0, 1200);
      row.notes.push(`optional-peers install failed: ${err.split("\n").slice(0, 12).join(" | ")}`);
      rmSync(join(dir, "node_modules"), { recursive: true, force: true });
      install = installConsumer(dir, {
        coreTgz,
        bnTgz,
        version,
        withOptional: false
      });
      if (install.ok) {
        row.notes.push("installed without math/diagram optional peers");
      }
    } else {
      row.notes.push("installed with optional peers for this line");
    }
    row.install = {
      ok: install.ok,
      status: install.status,
      stderr: install.ok
        ? undefined
        : (install.stderr + install.stdout).trim().slice(0, 1500)
    };
    if (!install.ok) return row;

    const tsc = run("npx", ["tsc", "-p", "tsconfig.json"], dir);
    row.typecheck = {
      ok: tsc.ok,
      status: tsc.status,
      stderr: tsc.ok
        ? undefined
        : (tsc.stderr + "\n" + tsc.stdout).trim().slice(0, 2000)
    };

    const rt = run("node", ["--experimental-strip-types", "smoke.ts"], dir);
    row.runtime = {
      ok: rt.ok && `${rt.stdout}${rt.stderr}`.includes("SMOKE_OK"),
      status: rt.status,
      stderr: rt.ok
        ? undefined
        : (rt.stderr + "\n" + rt.stdout).trim().slice(0, 2000)
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return row;
}

function runSourceTypecheck(version) {
  const dir = mkdtempSync(join(tmpdir(), `oe-bn-src-${version}-`));
  const result = { version, ok: false, status: 1, stderr: "", notes: [] };
  try {
    cpSync(join(root, "tsconfig.json"), join(dir, "tsconfig.json"));
    mkdirSync(join(dir, "packages"), { recursive: true });
    cpSync(join(root, "packages/core"), join(dir, "packages/core"), { recursive: true });
    cpSync(join(root, "packages/blocknote"), join(dir, "packages/blocknote"), {
      recursive: true
    });

    const bnPkgPath = join(dir, "packages/blocknote/package.json");
    const bnPkg = JSON.parse(readFileSync(bnPkgPath, "utf8"));
    const optional = optionalPeersFor(version);
    bnPkg.peerDependencies = {
      "@blocknote/core": version,
      "@blocknote/react": version,
      react: "^18.0.0 || ^19.0.0",
      "react-dom": "^18.0.0 || ^19.0.0",
      ...optional
    };
    bnPkg.peerDependenciesMeta = {
      "@blocknote/math-block": { optional: true },
      "@blocknote/diagram-block": { optional: true },
      "@blocknote/code-block": { optional: true }
    };
    bnPkg.devDependencies = {
      ...bnPkg.devDependencies,
      "@blocknote/core": version,
      "@blocknote/react": version,
      ...optional
    };
    if (!optional["@blocknote/math-block"]) {
      delete bnPkg.exports["./math"];
      delete bnPkg.exports["./diagram"];
      delete bnPkg.devDependencies["@blocknote/math-block"];
      delete bnPkg.devDependencies["@blocknote/diagram-block"];
      delete bnPkg.peerDependencies["@blocknote/math-block"];
      delete bnPkg.peerDependencies["@blocknote/diagram-block"];
      rmSync(join(dir, "packages/blocknote/src/math"), { recursive: true, force: true });
      rmSync(join(dir, "packages/blocknote/src/diagram"), { recursive: true, force: true });
      // Drop feature index re-exports if any
      result.notes.push(
        "excluded math/diagram sources — npm packages absent on this BlockNote line"
      );
    }
    writeFileSync(bnPkgPath, JSON.stringify(bnPkg, null, 2) + "\n");

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        {
          name: "oe-bn-src-check",
          private: true,
          workspaces: ["packages/*"],
          engines: { node: ">=20" }
        },
        null,
        2
      )
    );

    const install = run("npm", ["install", "--no-fund", "--no-audit"], dir);
    if (!install.ok) {
      result.stderr = (install.stderr + install.stdout).slice(0, 2500);
      result.notes.push("source workspace npm install failed");
      return result;
    }

    const coreBuild = run(
      "npm",
      ["run", "build", "-w", "@hello-ai-company/editor-core"],
      dir
    );
    if (!coreBuild.ok) {
      result.stderr = (coreBuild.stderr + coreBuild.stdout).slice(0, 2500);
      return result;
    }

    const tsc = run(
      "npx",
      ["tsc", "-p", "packages/blocknote/tsconfig.build.json", "--noEmit"],
      dir
    );
    result.ok = tsc.ok;
    result.status = tsc.status;
    result.stderr = tsc.ok
      ? ""
      : (tsc.stderr + "\n" + tsc.stdout).trim().slice(0, 3500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return result;
}

function main() {
  console.log("BlockNote compatibility matrix");
  console.log("candidates:", CANDIDATES.join(", "));
  const packs = ensurePacks();

  // Matrix-only widened peer tarball for API probe against older lines
  const widenedTgz = repackWithPeers(
    packs.bnTgz,
    "0.52.1 || 0.54.2",
    "hello-ai-company-editor-blocknote-0.1.0-matrix-widened.tgz"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    baselineCommit: run("git", ["rev-parse", "HEAD"], root).stdout.trim(),
    candidates: CANDIDATES,
    peerResolutionAsPublished: [],
    apiProbeWidenedPeers: [],
    sourceTypecheck: [],
    decisionHints: []
  };

  for (const version of CANDIDATES) {
    console.log(`\n=== A peer-resolution (as published) @ ${version} ===`);
    const row = probeConsumer(version, packs.bnTgz, packs.coreTgz, "peer-as-published");
    report.peerResolutionAsPublished.push(row);
    console.log(JSON.stringify(row, null, 2));
  }

  for (const version of CANDIDATES) {
    console.log(`\n=== B API probe (widened peers, matrix-only) @ ${version} ===`);
    const row = probeConsumer(version, widenedTgz, packs.coreTgz, "api-probe-widened");
    report.apiProbeWidenedPeers.push(row);
    console.log(JSON.stringify(row, null, 2));
  }

  if (process.env.SOURCE_CHECK !== "0") {
    for (const version of CANDIDATES) {
      console.log(`\n=== C source typecheck @ ${version} ===`);
      const row = runSourceTypecheck(version);
      report.sourceTypecheck.push(row);
      console.log(JSON.stringify(row, null, 2));
    }
  }

  const pub54 = report.peerResolutionAsPublished.find((r) => r.version === "0.54.2");
  const pub52 = report.peerResolutionAsPublished.find((r) => r.version === "0.52.1");
  const api52 = report.apiProbeWidenedPeers.find((r) => r.version === "0.52.1");
  const src52 = report.sourceTypecheck.find((r) => r.version === "0.52.1");

  if (pub52 && !pub52.install?.ok) {
    report.decisionHints.push(
      "As-published peers (^0.54.2) correctly reject BlockNote 0.52.1 via npm ERESOLVE (no --legacy-peer-deps)."
    );
  }
  if (api52) {
    const apiOk = api52.install?.ok && api52.typecheck?.ok && api52.runtime?.ok;
    report.decisionHints.push(
      apiOk
        ? "API probe: built package can consumer-compile/run against 0.52.1 when peers are artificially widened (matrix-only)."
        : `API probe against 0.52.1 (widened peers): install=${api52.install?.ok} typecheck=${api52.typecheck?.ok} runtime=${api52.runtime?.ok}.`
    );
  }
  if (src52) {
    report.decisionHints.push(
      src52.ok
        ? "Source typechecks against BlockNote 0.52.1 (math/diagram excluded)."
        : "Source does NOT typecheck against BlockNote 0.52.1 — keep peer floor at 0.54.2."
    );
  }
  if (pub54?.install?.ok && pub54?.typecheck?.ok && pub54?.runtime?.ok) {
    report.decisionHints.push(
      "Supported line 0.54.2: peer install + consumer typecheck + runtime smoke PASS."
    );
  }

  const outPath = join(root, "docs", "blocknote-compat-matrix.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log("\nWrote", outPath);
  console.log("Decision hints:\n-", report.decisionHints.join("\n- "));

  if (!pub54?.install?.ok || !pub54?.typecheck?.ok || !pub54?.runtime?.ok) {
    console.error("STOP — supported BlockNote 0.54.2 matrix failed");
    process.exit(1);
  }
}

main();
