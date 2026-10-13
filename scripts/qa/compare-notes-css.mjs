import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// Offline comparison of captured, mapped selectors. Never treat absent selectors or
// different content/host geometry as equality, and never accept full replacement here.
const [baselineArg, evidenceArg, outArg, candidateArg] = process.argv.slice(2);
if (!baselineArg || !evidenceArg || !outArg) throw new Error("Usage: compare-notes-css BASELINE_DIR RESULTS_JSON OUTPUT_DIR");
const baseline = resolve(baselineArg), evidence = resolve(evidenceArg), out = resolve(outArg);
const current = JSON.parse(readFileSync(evidence, "utf8")).reference;
if (!current?.states || Object.keys(current.states).length !== 35) throw new Error("Expected 35 reference captures");
const oldNames = readdirSync(baseline).filter(name => name.endsWith(".computed.json")).map(name => name.replace(/\.computed\.json$/, ""));
if (oldNames.length !== 35) throw new Error("Expected 35 original computed states");
const mapping = { navigation: ".noteSidebar", tabs: ".noteTabs", meta: ".notePaneMeta", title: ".noteTitleInput", surface: ".editorSurface", body: ".bn-editor", blockContent: ".bn-block-content", rail: ".editorToolRail", railPanel: ".editorToolPanel", documentSidebar: ".documentSidebar", documentTabs: ".documentToolTabs", library: ".noteLibrary" };
const rows = oldNames.sort().map(name => {
  const original = JSON.parse(readFileSync(join(baseline, name + ".computed.json"), "utf8")), next = current.states[name];
  if (!next) throw new Error("Missing state " + name);
  const viewportMatches = original.viewport.width === next.viewport.width && original.viewport.height === next.viewport.height;
  const selectors = Object.entries(mapping).map(([key, oldSelector]) => {
    const before = original.selectors[oldSelector] ?? [], after = next.capture[key] ?? [], differences = [], geometry = [];
    let checked = 0, equal = 0;
    for (let index = 0; index < Math.min(before.length, after.length); index++) {
      for (const [property, value] of Object.entries(after[index].computed)) {
        if (!Object.hasOwn(before[index].computed, property)) continue;
        checked++; if (before[index].computed[property] === value) equal++; else differences.push({ index, property, original: before[index].computed[property], candidate: value });
      }
      for (const property of ["x", "y", "width", "height"]) {
        const originalValue = before[index].rect[property], candidateValue = after[index].rect[property];
        if (Math.abs(originalValue - candidateValue) > 1) geometry.push({ index, property, original: originalValue, candidate: candidateValue });
      }
    }
    return { key, originalSelector: oldSelector, originalCount: before.length, candidateCount: after.length, comparable: viewportMatches && before.length > 0 && before.length === after.length, checked, equal, differences, geometry, status: !before.length ? "BASELINE_SELECTOR_ABSENT" : !after.length ? "CANDIDATE_SELECTOR_ABSENT" : before.length !== after.length ? "COUNT_MISMATCH" : differences.length || geometry.length ? "DIFFERENT" : "MAPPED_SUBSET_EQUAL" };
  });
  return { state: name, viewportMatches, originalViewport: original.viewport, candidateViewport: next.viewport, selectors, candidateUnavailable: next.unavailable, checked: selectors.reduce((n, row) => n + row.checked, 0), equal: selectors.reduce((n, row) => n + row.equal, 0), differentProperties: selectors.reduce((n, row) => n + row.differences.length, 0), geometryDifferences: selectors.reduce((n, row) => n + row.geometry.length, 0), acceptance: false, reason: "Mapped selectors only; original app shell/content/host providers and baseline missing selectors prevent full CSS/image acceptance." };
});
const report = { candidate: candidateArg ?? "0.3.0-notes.14", baseline, evidence, conditions: current.conditions, rows, all35Captured: true, all35CSSEquality: false, pixelEqualityEstablished: false, fullReplacement: false };
mkdirSync(out, { recursive: true }); writeFileSync(join(out, "css35-comparison.json"), JSON.stringify(report, null, 2));
writeFileSync(join(out, "css35-comparison.md"), `# 35画面のCSS比較 — ${candidateArg ?? "0.3.0-notes.14"}\n\n35画面を再撮影し、対応する12種類のセレクターの記録値を比較した。欠落セレクターを一致と数えず、本文・ホスト枠・実プロバイダーの違いを残す。画素一致・完全置換は未承認。\n\n| 画面 | viewport | 比較値 | 一致値 | 相違値 | 座標相違 | 完全一致 |\n| --- | --- | ---: | ---: | ---: | ---: | --- |\n` + rows.map(row => `| ${row.state} | ${row.viewportMatches ? "同条件" : "異なる"} | ${row.checked} | ${row.equal} | ${row.differentProperties} | ${row.geometryDifferences} | 未承認 |`).join("\n") + "\n\nJSONにはセレクターの有無、個数、各相違の元値と候補値を記録。新ギャラリー・選択編集は元35画面に含まれず、追加操作画像として別検証する。\n");
console.log(JSON.stringify({ states: rows.length, checked: rows.reduce((n,r) => n+r.checked,0), equal: rows.reduce((n,r) => n+r.equal,0), different: rows.reduce((n,r) => n+r.differentProperties,0), all35CSSEquality: false, out }));
