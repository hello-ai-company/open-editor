export const PUBLIC_PACKAGES = Object.freeze({
  ai: Object.freeze({
    directory: "packages/ai",
    name: "@hello-ai-company/editor-ai",
    version: "0.1.0",
    copyright: "Copyright (c) 2026 Hello AI Company",
    dependencies: Object.freeze({}),
    peerDependencies: Object.freeze({
      "@hello-ai-company/editor-core": "^0.1.1"
    }),
    scripts: Object.freeze({
      build: "npm run build -w @hello-ai-company/editor-core && tsc -p tsconfig.build.json",
      typecheck: "npm run build -w @hello-ai-company/editor-core && tsc -p tsconfig.json --noEmit",
      test: "vitest run",
      prepack: "npm run build"
    })
  }),
  canvas: Object.freeze({
    directory: "packages/canvas",
    name: "@hello-ai-company/editor-canvas",
    version: "0.1.0",
    copyright: "Copyright (c) 2026 Yuki Shibata",
    dependencies: Object.freeze({
      "@hello-ai-company/editor-core": "^0.1.1"
    }),
    peerDependencies: Object.freeze({
      react: "^18.0.0 || ^19.0.0"
    }),
    scripts: Object.freeze({
      build: "npm run build -w @hello-ai-company/editor-core && tsc -p tsconfig.build.json",
      prepack: "npm run build",
      typecheck: "npm run build -w @hello-ai-company/editor-core && tsc -p tsconfig.json --noEmit",
      test: "vitest run"
    })
  }),
  publish: Object.freeze({
    directory: "packages/publish",
    name: "@hello-ai-company/editor-publish",
    version: "0.1.0",
    copyright: "Copyright (c) 2026 Yuki Shibata",
    dependencies: Object.freeze({
      "@hello-ai-company/editor-canvas": "^0.1.0",
      "@hello-ai-company/editor-core": "^0.1.1",
      docx: "^9.7.2"
    }),
    exactRegistryDependencies: Object.freeze({
      "@hello-ai-company/editor-canvas": "0.1.0"
    }),
    peerDependencies: Object.freeze({}),
    scripts: Object.freeze({
      build: "npm run build -w @hello-ai-company/editor-core && npm run build -w @hello-ai-company/editor-canvas && tsc -p tsconfig.build.json",
      typecheck: "npm run build -w @hello-ai-company/editor-core && npm run build -w @hello-ai-company/editor-canvas && tsc -p tsconfig.json --noEmit",
      prepack: "npm run build",
      test: "vitest run"
    })
  })
});

export const RELEASE_REPO = "hello-ai-company/open-editor";
export const RELEASE_REF = "refs/heads/main";
export const RELEASE_REGISTRY = "https://registry.npmjs.org";

export function packageConfig(key) {
  const config = PUBLIC_PACKAGES[key];
  if (!config) throw new Error(`Unknown public package key: ${key}`);
  return config;
}

export function tarballFilename(config) {
  return `${config.name.replace(/^@/, "").replaceAll("/", "-")}-${config.version}.tgz`;
}

function sameEntries(actual, expected) {
  const keys = Object.keys(actual ?? {}).sort();
  const expectedKeys = Object.keys(expected).sort();
  return keys.length === expectedKeys.length
    && keys.every((key, index) => key === expectedKeys[index] && actual[key] === expected[key]);
}

export function validatePackageManifest(pkg, config) {
  if (!pkg || typeof pkg !== "object") throw new Error("package.json is missing or invalid");
  if (pkg.name !== config.name) throw new Error(`package name must be ${config.name}`);
  if (pkg.version !== config.version) throw new Error(`package version must be ${config.version}`);
  if (pkg.license !== "MIT") throw new Error("package license must be MIT");
  if (pkg.private === true) throw new Error("package must not set private:true");
  if (pkg.publishConfig?.registry !== RELEASE_REGISTRY) throw new Error("publishConfig.registry must be npmjs");
  if (pkg.publishConfig?.access !== "public") throw new Error("publishConfig.access must be public");
  if (!sameEntries(pkg.dependencies, config.dependencies)) {
    throw new Error(`dependencies must exactly match ${JSON.stringify(config.dependencies)}`);
  }
  if (!sameEntries(pkg.peerDependencies, config.peerDependencies)) {
    throw new Error(`peerDependencies must exactly match ${JSON.stringify(config.peerDependencies)}`);
  }
  if (Object.keys(pkg.optionalDependencies ?? {}).length !== 0
    || Object.keys(pkg.peerDependenciesMeta ?? {}).length !== 0
    || (pkg.bundledDependencies ?? pkg.bundleDependencies ?? []).length !== 0) {
    throw new Error("optional, bundled, or modified peer dependencies are not allowed");
  }
  for (const script of ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly", "prepack", "postpack", "publish", "postpublish", "preprepare", "postprepare", "dependencies"]) {
    if (Object.hasOwn(pkg.scripts ?? {}, script) && (script !== "prepack" || pkg.scripts.prepack !== "npm run build")) {
      throw new Error(`lifecycle script ${script} is not allowed in a public tarball`);
    }
  }
  if (!sameEntries(pkg.scripts, config.scripts)) {
    throw new Error(`scripts must exactly match the reviewed commands for ${config.name}`);
  }
  return true;
}
