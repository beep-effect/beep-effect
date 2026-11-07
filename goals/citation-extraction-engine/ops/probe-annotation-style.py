#!/usr/bin/env python3
"""Observe original annotation style-bound expansion without replacing source code."""
import argparse
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys


def native(text):
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    pin, tree = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (pin, tree, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite.utils import maybe_balance_style_tags
    texts = ['', 'plain', '<i>Foo</i>', '<em>Foo</em>', '<b>Foo</b>', '<I>Foo</I>',
             '<i class="x">Foo</i>', '<i>Foo----------x</i>', '<i><em>Foo</i></em>',
             '<i>Foo</em><b>Bar</b>', 'x<i>Foo</i>z<i>Bar</i>', '<i>😀\ud800\ud83d\ude00</i>',
             '<em>\nFoo\x00</em>', '</b>Foo<b>', '<i>Foo</i><em>Bar</em><b>Baz</b>']
    inputs = []
    for text in texts:
        n = len(text)
        for start, end in [(0, n), (1, n-1), (3, n-4), (-3, n), (0, -1), (n+1, n+4), (4, 2)]:
            for tolerance in [-5, 0, 2, 10, 25]:
                inputs.append((text, start, end, tolerance))
    rng = random.Random(7642)
    for _ in range(160):
        text = ''.join(rng.choice(['<i>', '</i>', '<em>', '</em>', '<b>', '</b>', 'A', '😀', '\ud800', '\n']) for _ in range(rng.randrange(12)))
        inputs.append((text, rng.randrange(-6, len(text)+8), rng.randrange(-6, len(text)+8), rng.choice([-5, 0, 2, 10, 25])))
    rows = []
    for text, start, end, tolerance in inputs:
        new_start, new_end, span = maybe_balance_style_tags(start, end, text, tolerance)
        rows.append({'id': len(rows), 'source': native(text), 'start': start, 'end': end, 'tolerance': tolerance,
                     'result': {'start': new_start, 'end': new_end, 'text': native(span)}})
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    out = {'schemaVersion': 'citation-annotation-style/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()),
           'utilsSha256': sha((root / 'eyecite/utils.py').read_bytes()), 'cases': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows)}))


if __name__ == '__main__':
    main()
