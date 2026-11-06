#!/usr/bin/env python3
"""Capture exact default edit steps from the original pinned SpanUpdater."""
import argparse
import hashlib
import importlib.metadata
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys


def native(text):
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
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
    from eyecite.annotate import SpanUpdater
    import fast_diff_match_patch
    assert importlib.metadata.version('fast-diff-match-patch') == '2.0.1'
    assert fast_diff_match_patch.CHAR_WIDTH == 4
    pairs = []
    words = [''.join(word) for size in range(4) for word in itertools.product('ab', repeat=size)]
    pairs.extend(('binary-exhaustive-through-three', before, after) for before in words for after in words)
    rng = random.Random(367)
    alphabets = ['ab', 'a b\n\t', '<i>Foo</i>&;', '\x00a\x00b', 'éＡ\u0301',
                 '😀𝄞A', '\ud800\udfffA', '\ud83d\ude00😀A']
    for alphabet in alphabets:
        for _ in range(48):
            before = ''.join(rng.choice(alphabet) for _ in range(rng.randrange(65)))
            after = ''.join(rng.choice(alphabet) for _ in range(rng.randrange(65)))
            pairs.append(('seeded-independent', before, after))
            pivot = rng.randrange(len(before) + 1)
            pairs.append(('seeded-edit', before, before[:pivot] + after[:8] + before[pivot + 3:]))
    for size in [64, 256, 1024]:
        for before, after in [('ab' * size, 'ba' * size), ('a' * size, 'b' * size),
                              ('abc\n' * size, 'bc\na' * size), ('a\x00😀' * size, '😀a\x00' * size)]:
            pairs.append(('long-ambiguous', before, after))
    maps = []
    for family, before, after in pairs:
        steps = list(SpanUpdater.get_diff_steps(before, after))
        maps.append({'id': len(maps), 'family': family, 'engine': 'dmp',
                     'before': native(before), 'after': native(after),
                     'steps': [{'operation': op, 'amount': amount} for op, amount in steps]})
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    output = {'schemaVersion': 'citation-diff-kernel/v1', 'oracleCommit': pin, 'oracleTree': tree,
              'python': '3.11.15', 'dmp': '2.0.1', 'charWidth': 4,
              'producerSha256': sha(Path(__file__).read_bytes()),
              'annotateSha256': sha((root / 'eyecite/annotate.py').read_bytes()),
              'dmpModuleSha256': sha(Path(fast_diff_match_patch.__file__).read_bytes()), 'maps': maps}
    args.output.write_text(json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'maps': len(maps), 'steps': sum(len(row['steps']) for row in maps)}))


if __name__ == '__main__':
    main()
