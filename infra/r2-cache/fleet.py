#!/usr/bin/env python3
"""Enroll existing Beep clones and registered worktrees without changing source."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('roots', nargs='+', type=Path, help='Parent directory containing clones, or one clone')
parser.add_argument('--apply', action='store_true', help='Apply reference-only enrollment; default is a read-only plan')
parser.add_argument('--output', type=Path, help='Private sanitized receipt; never contains credentials or refs')
args = parser.parse_args()

def git(root, *words):
    result = subprocess.run(['git', '-C', str(root), *words], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else ''

clones = set()
for root in args.roots:
    if (root / '.git').exists():
        clones.add(root.resolve())
    elif root.is_dir():
        clones.update(p.resolve() for p in root.glob('beep-effect*') if (p / '.git').exists())

checkouts = set()
for clone in clones:
    origin = git(clone, 'remote', 'get-url', 'origin')
    if not re.search(r'github\.com[:/]beep-effect/beep-effect(?:\.git)?$', origin):
        continue
    for line in git(clone, 'worktree', 'list', '--porcelain').splitlines():
        if line.startswith('worktree '):
            checkout = Path(line[9:])
            if checkout.is_dir():
                checkouts.add(checkout.resolve())

rows = []
for checkout in sorted(checkouts):
    policy = checkout / 'packages/tooling/tool/cli/src/internal/cli/TurboCache.ts'
    text = policy.read_text() if policy.is_file() else ''
    mode = 'local:rw,remote:rw' if 'BEEP_TURBO_TRUSTED_WRITER' in text else 'local:rw,remote:r'
    supported = 'local:rw,remote:r' in text
    row = {'checkout': str(checkout), 'head': git(checkout, 'rev-parse', 'HEAD'), 'mode': mode,
           'status': 'planned' if supported else 'legacy-use-beep-turbo'}
    if args.apply and supported:
        result = subprocess.run([str(Path(__file__).with_name('workstation.sh')), 'enable', str(checkout), mode],
                                capture_output=True, text=True)
        row['status'] = 'enrolled' if result.returncode == 0 else 'blocked'
        # Enrollment errors describe field names only. Do not retain arbitrary command output.
        row['exit_code'] = result.returncode
    rows.append(row)

receipt = {'recorded_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'applied': args.apply, 'checkouts': rows}
if args.output:
    args.output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as target:
        json.dump(receipt, target, indent=2)
for status in sorted({row['status'] for row in rows}):
    print(status + ': ' + str(sum(row['status'] == status for row in rows)))
print('Read-write capable: ' + str(sum(row['mode'].endswith(':rw') for row in rows)))
raise SystemExit(1 if any(row['status'] == 'blocked' for row in rows) else 0)
