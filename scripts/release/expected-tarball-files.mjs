import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

function sourceFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

export function expectedTarballFiles(packageDirectory, { css = false } = {}) {
  const expected = new Set(["package/package.json", "package/LICENSE", "package/README.md"]);
  for (const path of sourceFiles(join(packageDirectory, "src"))) {
    const stem = relative(join(packageDirectory, "src"), path).split(sep).join("/").replace(/\.tsx?$/, "");
    for (const suffix of [".js", ".js.map", ".d.ts", ".d.ts.map"]) {
      expected.add(`package/dist/${stem}${suffix}`);
    }
  }
  if (css) expected.add("package/dist/power.css");
  return expected;
}

export function assertExactTarballFiles(files, expected) {
  const actualFiles = files.filter((path) => !path.endsWith("/"));
  const actual = new Set(actualFiles);
  const extra = actualFiles.filter((path) => !expected.has(path));
  const missing = [...expected].filter((path) => !actual.has(path));
  if (extra.length || missing.length) {
    throw new Error([
      ...(extra.length ? [`Unexpected tarball files:\n${extra.sort().join("\n")}`] : []),
      ...(missing.length ? [`Missing tarball files:\n${missing.sort().join("\n")}`] : [])
    ].join("\n"));
  }
}
