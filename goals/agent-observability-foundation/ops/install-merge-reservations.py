#!/usr/bin/env python3
"""Plan by default; --apply installs reviewed owner-fence source with backups.

Only known original or installed wrapper fingerprints are accepted. No services,
credentials, repository state or merge reservations are changed by this installer.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import stat
import tempfile

KNOWN = {'ghapp.sh': {'original': 'b396a2e321293d5291cb3816f5678975e9627a3171cc1a0973a4be58c2e13396', 'installed': 'bad7b08daa458bb1a1bee7f3552425b57b03018d1a356e26d59c23255294271a'}, 'merge-gate-loop5-app.sh': {'original': '21a0dc02ea438c9bb73a65072f11a84d5ea112ca3567697402898f8bede05f30', 'installed': '4473e2f85fa88a013f5470878713a205a5b504f33c8c94647e01e7508acadecd'}, 'merge-gate-loop5-strict-app.sh': {'original': '1f49547033976568a72d292c7c468cb578067092f4d56c20de3c64f0cc3f2423', 'installed': '1cfb9ce678d66826e93c27c739a307f8d246cdfa557244302be950eb7d9ceebb'}, 'merge-reservations.py': {'installed': '9c951c99199084ff1c9451c04f9129ec6fce89f30cc0dd9ecf9955a207f77c01'}}
NAMES = ("ghapp.sh", "merge-gate-loop5-app.sh", "merge-gate-loop5-strict-app.sh")

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def patch(name, raw):
    text = raw.decode()
    if name == "ghapp.sh":
        text = text.replace('set -u\n', 'set -u\npython3 "$HOME/.cache/beep/orchestrator/bin/merge-reservations.py" guard -- "$@" || exit $?\n', 1)
    else:
        marker = "  if grep -q 'GATE-MET' <<<\"$out\"; then"
        start = text.index(marker)
        end = text.index('\n  fi', start) + len('\n  fi')
        text = text[:start] + text[end:]
        text = text.replace('for i in $(seq 1 90); do\n', 'for i in $(seq 1 90); do\n  python3 "$HOME/.cache/beep/orchestrator/bin/merge-reservations.py" check --pr "$pr" --head "$sha" || exit $?\n', 1)
    result = text.encode()
    if digest(result) != KNOWN[name]['installed']:
        raise ValueError("known wrapper transform did not reproduce reviewed fingerprint: " + name)
    return result

def main():
    home = Path(pwd.getpwuid(os.getuid()).pw_dir)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--cache-dir', type=Path, default=home/'.cache/beep/orchestrator/bin', help='Override only for isolated installer qualification')
    parser.add_argument('--source-helper', type=Path, default=Path(__file__).with_name('merge-reservations.py'))
    opts = parser.parse_args()
    source = opts.source_helper.read_bytes()
    compile(source, str(opts.source_helper), 'exec')
    changes = []
    # Validate every target before making even the first backup or write.
    for name in (*NAMES, 'merge-reservations.py'):
        target = opts.cache_dir/name
        if target.exists():
            info = target.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid():
                raise ValueError('refusing non-owned or non-regular target: ' + name)
            old = target.read_bytes()
            old_hash = digest(old)
        else:
            if name != 'merge-reservations.py':
                raise ValueError('required managed wrapper missing: ' + name)
            old, old_hash = None, None
        if name == 'merge-reservations.py':
            new = source
            if old_hash not in (None, digest(source), KNOWN[name]['installed']):
                raise ValueError('unknown helper fingerprint; preserve and reconcile before installation')
        elif old_hash == KNOWN[name]['original']:
            new = patch(name, old)
        elif old_hash == KNOWN[name]['installed']:
            new = old
        else:
            raise ValueError('unknown wrapper fingerprint; preserve and reconcile: ' + name)
        if old != new:
            changes.append((target, old, new, old_hash))
        print(('UPDATE ' if old != new else 'UNCHANGED ') + name)
    if not opts.apply:
        print('PLAN ONLY: rerun with --apply to install the validated changes')
        return
    if not changes:
        print('Already installed; no files or backup receipts changed')
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    backup = home/'.local/state/beep/merge-coordination-installs'/stamp
    backup.mkdir(parents=True, mode=0o700)
    receipt = []
    for target, old, new, expected_hash in changes:
        # Recheck immediately before each write to preserve intervening edits.
        actual_hash = digest(target.read_bytes()) if target.exists() else None
        if actual_hash != expected_hash:
            raise ValueError('target changed during installation; retained earlier backups: ' + target.name)
        if old is not None:
            shutil.copy2(target, backup/target.name)
        fd, temporary = tempfile.mkstemp(prefix='.'+target.name+'-', dir=opts.cache_dir)
        try:
            with os.fdopen(fd, 'wb') as out:
                out.write(new)
                out.flush()
                os.fsync(out.fileno())
            os.chmod(temporary, target.stat().st_mode & 0o777 if target.exists() else 0o755)
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        receipt.append({'name': target.name, 'beforeSha256': expected_hash, 'afterSha256': digest(new)})
    (backup/'receipt.json').write_text(json.dumps({'schema':'beep-merge-fence-install/v1','files':receipt}, indent=2)+'\n')
    print('Installed with recovery copies: ' + str(backup))

if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        raise SystemExit('merge-fence installer held: ' + str(error))
