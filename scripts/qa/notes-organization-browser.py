#!/usr/bin/env python3
"""Local-only CLI browser verification, using an already cached Playwright CLI (no installs)."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import uuid
from urllib.parse import urlparse

parser = argparse.ArgumentParser()
parser.add_argument('--cli', type=Path, required=True, help='Existing @playwright/cli/playwright-cli.js')
parser.add_argument('--url', default='http://127.0.0.1:5199/')
args = parser.parse_args()
if urlparse(args.url).hostname not in ('127.0.0.1', 'localhost') or urlparse(args.url).scheme != 'http':
    raise SystemExit('Only a local HTTP preview is allowed')
if not args.cli.is_file():
    raise SystemExit('Provide an existing CLI; this runner does not install dependencies')
root = Path(__file__).resolve().parents[2]
output = root / 'output/playwright/notes3' / ('run-' + uuid.uuid4().hex[:12])
output.mkdir(parents=True)
results = {}
for name in ('basic', 'flows', 'advanced', 'conflict'):
    cmd = ['node', str(args.cli.resolve()), '--session=oe-notes3-' + uuid.uuid4().hex[:12]]
    opened = False
    def run(arguments, label):
        result = subprocess.run(cmd + arguments, cwd=root, capture_output=True, text=True, timeout=90)
        (output / (label + '.log')).write_text(result.stdout + result.stderr)
        if result.returncode or '### Error' in result.stdout:
            raise RuntimeError(label + ' failed; see ' + str(output))
        return result.stdout
    try:
        run(['open', args.url.rstrip('/') + '/?organize=synthetic', '--browser=chrome'], name + '-open')
        opened = True
        run(['snapshot'], name + '-snapshot')
        source = (root / 'scripts/qa' / ('notes-organization-' + name + '.mjs')).read_text().replace('export default ', '', 1).replace('http://127.0.0.1:5199/', args.url).replace('output/playwright/notes3/', output.relative_to(root).as_posix() + '/')
        log = run(['run-code', source], name)
        match = re.search(r'### Result\n(.*?)\n###', log, re.S)
        if not match:
            raise RuntimeError('Incomplete check or modal: ' + name)
        results[name] = json.loads(match.group(1))
        if name == 'conflict':
            log = run(['run-code', "async page => { void page.goto('" + args.url + "').catch(() => {}); await page.waitForTimeout(200); }"], 'beforeunload-prompt')
            if 'beforeunload' not in log:
                raise RuntimeError('Expected unsaved draft navigation prompt')
            run(['dialog-dismiss'], 'beforeunload-dismiss')
            log = run(['run-code', "async page => { const body=await page.locator('.bn-inline-content').allTextContents(); if(!body.some(s=>s.includes('この画面の追記。')))throw new Error('Draft lost on cancel'); return {navigationCancelled:true,localDraftRetained:true}; }"], 'beforeunload-cancel')
            if '### Result' not in log:
                raise RuntimeError('Cancellation not verified')
            results['navigationCancel'] = {'localDraftRetained': True}
        print(name + ' PASS', flush=True)
    finally:
        if opened:
            subprocess.run(cmd + ['close'], cwd=root, capture_output=True, text=True, timeout=30)
(output / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(output)
