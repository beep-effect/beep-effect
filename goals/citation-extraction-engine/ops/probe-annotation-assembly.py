#!/usr/bin/env python3
"""Capture original unchecked annotation assembly, including Python slice edges."""
import argparse
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


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
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite.annotate import annotate_citations
    rng = random.Random(7361)
    inputs = []
    for text in ['', 'ABCDE', 'a\x00b', '😀Ａé', '\ud800A\udfff', '\ud83d\ude00😀A']:
        n = len(text)
        for annotations in [[], [((0, n), '<a>', '</a>')], [((-3, n), '[', ']')],
                            [((1, -1), '<', '>')], [((3, 1), 'x', 'y')],
                            [((n + 2, n + 5), '(', ')')],
                            [((0, n), 'B', 'b'), ((0, n), 'A', 'a')],
                            [((0, 2), '<a>', '</a>'), ((1, n), '[', ']')],
                            [((0, 0), '\U00010000', ''), ((0, 0), '\ue000', '')]]:
            inputs.append(('edge', text, annotations))
    for _ in range(160):
        text = ''.join(rng.choice('ab<>\n😀\ud800\udfff') for _ in range(rng.randrange(25)))
        annotations = [((rng.randrange(-8, 32), rng.randrange(-8, 32)),
                        rng.choice(['<a>', '[', '😀', '\ud800', '']), rng.choice(['</a>', ']', '', '\udfff']))
                       for _ in range(rng.randrange(9))]
        inputs.append(('seeded', text, annotations))
    rows = []
    for family, text, annotations in inputs:
        packed = lambda values: [{'start': span[0], 'end': span[1], 'before': native(before), 'after': native(after)}
                                 for span, before, after in values]
        result = annotate_citations(text, annotations)
        rows.append({'id': len(rows), 'family': family, 'source': native(text), 'input': packed(annotations),
                     'ordered': packed(sorted(annotations)), 'result': native(result)})
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    output = {'schemaVersion': 'citation-annotation-assembly/v1', 'oracleCommit': PIN, 'oracleTree': TREE,
              'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()),
              'annotateSha256': sha((root / 'eyecite/annotate.py').read_bytes()), 'cases': rows}
    args.output.write_text(json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows), 'annotations': sum(len(row['ordered']) for row in rows)}))


if __name__ == '__main__':
    main()
