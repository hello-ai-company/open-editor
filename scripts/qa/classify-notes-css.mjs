import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: classify-notes-css COMPARISON_JSON NEW_OUTPUT_DIR');
const comparison = JSON.parse(readFileSync(input, 'utf8')), rows = [];
for (const state of comparison.rows) for (const selector of state.selectors) for (const difference of selector.differences) {
  let category = 'ACTUAL_CSS_MISMATCH', reason = 'Recorded computed value differs. Keep the original source cascade/value as the target; not accepted as equivalent.';
  if (selector.key === 'blockContent' && selector.originalCount !== selector.candidateCount) {
    category = 'CONTENT_OR_ENVIRONMENT_DEPENDENT';
    reason = 'Positional selector pairing has unequal block counts and different synthetic text/block types. Capture the same block identity/content before attributing its font metrics to CSS.';
  } else if ((selector.key === 'rail' && ['position', 'display'].includes(difference.property)) || (selector.key === 'railPanel' && difference.property === 'display') || (selector.key === 'body' && difference.property.startsWith('padding') && (state.state.startsWith('responsive-') || state.state === '08-split'))) {
    category = 'INTENTIONAL_CONTAINER_ADAPTATION';
    reason = 'The common shell sizes compact panes/drawers by allocated container width, while the original uses viewport media rules. This preserves bounded 390px/split/embedded usability; original visual equivalence remains unaccepted and needs equal allocation plus closed/open rail pairing.';
  }
  rows.push({ state: state.state, selector: selector.key, ...difference, category, reason, acceptedAsEquivalent: false, source: comparison.evidence });
}
const counts = Object.fromEntries(['ACTUAL_CSS_MISMATCH', 'INTENTIONAL_CONTAINER_ADAPTATION', 'CONTENT_OR_ENVIRONMENT_DEPENDENT'].map(category => [category, rows.filter(row => row.category === category).length]));
const report = { candidate: comparison.candidate, input: resolve(input), classifiedProperties: rows.length, categoryCounts: counts, categoriesAreNotAcceptance: true, conditions: comparison.conditions, rows, geometryAttribution: 'Unattributed until identical host allocation/content is captured', missingSelectorsAreNotEqual: true, fullCSSAccepted: false };
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'css-difference-classification.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(output, 'css-difference-classification.md'), `# CSS差の分類 — ${comparison.candidate}\n\n実不一致${counts.ACTUAL_CSS_MISMATCH}、意図したcontainer適応${counts.INTENTIONAL_CONTAINER_ADAPTATION}、本文/環境条件に依存${counts.CONTENT_OR_ENVIRONMENT_DEPENDENT}。意図した差も元Notesの完全同等性を意味しない。フォント差を一律に環境差と扱わない。\n\n| 状態 | 対象 | 値 | 原値 | 候補値 | 分類 |\n| --- | --- | --- | --- | --- | --- |\n` + rows.map(row => `| ${row.state} | ${row.selector}[${row.index}] | ${row.property} | ${row.original} | ${row.candidate} | ${row.category} |`).join('\n') + '\n');
console.log(JSON.stringify({ classified: rows.length, counts }));
