#!/usr/bin/env python3
"""Verify only a local synthetic preview using an existing cached CLI; no installs."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import uuid
from urllib.parse import urlparse

parser = argparse.ArgumentParser()
parser.add_argument('--cli', type=Path, required=True)
parser.add_argument('--url', default='http://127.0.0.1:5199/')
parser.add_argument('--probe', choices=('smoke', 'flows', 'widgets', 'performance', 'modes'), action='append')
args = parser.parse_args()
url = urlparse(args.url)
if url.hostname not in ('127.0.0.1', 'localhost') or url.scheme != 'http' or url.path not in ('', '/') or url.query or url.fragment or url.username or url.password:
    raise SystemExit('Only a local HTTP root preview is allowed')
base_url = 'http://' + url.hostname + ':' + str(url.port or 80) + '/'
if not args.cli.is_file():
    raise SystemExit('Provide an existing CLI; no dependencies will be installed')
root = Path(__file__).resolve().parents[2]
output = root / 'output/playwright/notes7' / ('run-' + uuid.uuid4().hex[:12])
output.mkdir(parents=True)
results = {}
for name in args.probe or ('smoke', 'flows', 'widgets', 'modes', 'performance'):
    cmd = ['node', str(args.cli.resolve()), '--session=oe-notes7-' + uuid.uuid4().hex[:12]]
    opened = False
    def run(arguments, label):
        result = subprocess.run(cmd + arguments, cwd=root, capture_output=True, text=True, timeout=90)
        (output / (label + '.log')).write_text(result.stdout + result.stderr)
        if result.returncode or '### Error' in result.stdout:
            raise RuntimeError(label + ' failed; see ' + str(output))
        return result.stdout
    try:
        run(['open', base_url + '?notes=synthetic', '--browser=chrome'], name + '-open')
        opened = True
        run(['snapshot'], name + '-snapshot')
        source = (root / 'scripts/qa' / ('notes-workspace-' + name + '.mjs')).read_text().replace('export default ', '', 1).replace('http://127.0.0.1:5199/', base_url).replace('OUTPUT/', output.relative_to(root).as_posix() + '/').rstrip().removesuffix(';')
        log = run(['run-code', source], name)
        match = re.search(r'### Result\n(.*?)\n###', log, re.S)
        if not match:
            raise RuntimeError('Incomplete result or modal: ' + name)
        results[name] = json.loads(match.group(1))
        print(name + ' PASS', flush=True)
    except Exception:
        if opened:
            try:
                run(['snapshot'], name + '-failure-snapshot')
            except Exception:
                pass
        raise
    finally:
        if opened:
            subprocess.run(cmd + ['close'], cwd=root, capture_output=True, text=True, timeout=30)
(output / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(output)
