#!/usr/bin/env python3
"""Compare recorded synthetic captures, retaining differences and unavailable states.

This compares sampled DOM/CSS, not whole-image equality. The original harness did
not record scroll offsets; document-coordinate inference is explicitly limited.
"""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--reference', type=Path, required=True)
parser.add_argument('--results', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
results = json.loads(args.results.read_text())
reference = results['reference']
mapping = {
    'navigation': '.mainColumn', 'tabs': '.noteTabs', 'meta': '.notePaneMeta',
    'title': '.noteTitleInput', 'surface': '.editorSurface', 'body': '.bn-editor',
    'blockContent': '.bn-block-content', 'rail': '.editorToolRail',
    'railPanel': '.editorToolPanel', 'documentSidebar': '.documentSidebar',
    'documentTabs': '.documentToolTabs', 'library': '.noteLibrary',
}
def expected_samples(recorded, key, selector):
    if key == 'title':
        return [item for item in recorded['controls'] if 'titleInput' in item['class'].split()]
    return recorded['selectors'].get(selector, [])

states = {}
for name, actual in reference['states'].items():
    recorded = json.loads((args.reference / (name + '.computed.json')).read_text())
    shell = recorded['selectors']['.shell'][0]['rect']
    offset = {'x': -shell['x'], 'y': -shell['y']}
    samples = {}
    for key, selector in mapping.items():
        expected = expected_samples(recorded, key, selector)
        observed = actual['capture'].get(key, [])
        pairs = []
        for before, after in zip(expected, observed):
            normalized = {k: v + offset.get(k, 0) for k, v in before['rect'].items()}
            pairs.append({
                'referenceRawRect': before['rect'],
                'referenceInferredDocumentRect': normalized,
                'actualDocumentRect': after['documentRect'],
                'rectDifferences': {k: {'reference': normalized[k], 'actual': v, 'delta': v - normalized[k]}
                                    for k, v in after['documentRect'].items() if abs(v - normalized[k]) > 0.02},
                'computedDifferences': {k: {'reference': before['computed'].get(k), 'actual': v}
                                       for k, v in after['computed'].items() if before['computed'].get(k) != v},
            })
        samples[key] = {'referenceCount': len(expected), 'actualCount': len(observed), 'pairs': pairs}
    states[name] = {'unavailable': actual['unavailable'], 'overflow': actual['overflow'], 'samples': samples}

theme_values = {'equal': 0, 'total': 0, 'differences': []}
for name, actual in results['classic']['themes'].items():
    recorded = json.loads((args.reference / ('theme-' + name + '.computed.json')).read_text())
    for key in ('title', 'body', 'blockContent', 'rail'):
        expected = expected_samples(recorded, key, mapping[key])[0]['computed']
        for prop, value in actual[key]['computed'].items():
            theme_values['total'] += 1
            if value == expected[prop]:
                theme_values['equal'] += 1
            else:
                theme_values['differences'].append({'theme': name, 'sample': key, 'property': prop,
                                                  'reference': expected[prop], 'actual': value})

report = {
    'reference': str(args.reference), 'candidateResults': str(args.results),
    'conditions': reference['conditions'], 'stateCount': len(states),
    'wholeImageEqualityEstablished': False,
    'coordinatePolicy': 'Reference raw coordinates retained. Document coordinates inferred from negative shell offset; sticky/fixed/internal-scroll geometry requires separate review. This is not screenshot-position proof.',
    'themeComputedSubset': theme_values, 'states': states,
    'missingAcceptedStates': ['No 36th state, open emoji/cover/gallery dialog, native table picker, focus appearance, or non-Document mode reference capture supplied.'],
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
rows = []
for name, state in states.items():
    mismatches = sum(len(pair['rectDifferences']) for sample in state['samples'].values() for pair in sample['pairs'])
    styles = sum(len(pair['computedDifferences']) for sample in state['samples'].values() for pair in sample['pairs'])
    counts = sum(sample['referenceCount'] != sample['actualCount'] for sample in state['samples'].values())
    rows.append(f"| {name} | {mismatches} | {styles} | {counts} | {' / '.join(state['unavailable']) or '—'} |")
args.output.with_suffix('.md').write_text(
    '# Notes .9 sampled comparison\n\n'
    '35 recorded states; whole-image equality is **not established**. Raw reference rectangles and inferred document coordinates are retained in the JSON. Sticky/fixed/internal scrolling and different authorized records can make numerical differences inconclusive. Unavailable states never count as matches.\n\n'
    f"Twelve-theme computed subset: {theme_values['equal']}/{theme_values['total']} equal values.\n\n"
    '| State | Rect field differences | CSS field differences | Element count differences | Unavailable |\n'
    '|---|---:|---:|---:|---|\n' + '\n'.join(rows) + '\n')
print(json.dumps({'states': len(states), 'themeValues': theme_values['equal'], 'themeTotal': theme_values['total'], 'output': str(args.output)}))
