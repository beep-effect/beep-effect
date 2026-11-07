#!/usr/bin/env python3
"""Observe pinned original builtin diff steps, including exhaustive short ties."""
import argparse
import difflib
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
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    pin = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert git('rev-parse', 'HEAD') == pin and git('status', '--porcelain') == ''
    assert sys.version_info[:3] == (3, 11, 15)
    sha = lambda data: hashlib.sha256(data).hexdigest()
    stdlib_sha = sha(Path(difflib.__file__).read_bytes())
    assert stdlib_sha == '0c6afc23568d55b3e9ac914f9c5361e3033e778aa5b58d3cc82835fc5c638679'
    sys.path.insert(0, str(root))
    from eyecite.annotate import SpanUpdater, annotate_citations
    assert importlib.metadata.version("fast-diff-match-patch") == "2.0.1"
    words = [''.join(chars) for length in range(6) for chars in itertools.product('ab', repeat=length)]
    inputs = [('short-binary', a, b) for a in words for b in words]
    controls = ['', '😀a', 'a😀', '\ud800a', 'a\ud800', '\ud83d\ude00', '\u00e9', 'e\u0301', 'a b', ' a b ', 'a\nb', 'a\rb', 'abaaba', 'baabaa']
    inputs.extend(('unicode-control', a, b) for a in controls for b in controls)
    inputs.extend(('long-no-autojunk', a, b) for a, b in [('a' * 210 + 'b', 'b' + 'a' * 210), ('ab' * 160, 'ba' * 160), ('x' * 220 + 'a' + 'y' * 220, 'x' * 220 + 'b' + 'y' * 220)])
    rng = random.Random(20261107)
    alphabet = ['a', 'b', ' ', '😀', '\ud800', '\u0301', '\n']
    for _ in range(64):
        inputs.append(('seeded-mixed', ''.join(rng.choice(alphabet) for _ in range(rng.randrange(33))), ''.join(rng.choice(alphabet) for _ in range(rng.randrange(33)))))
    cases, seen = [], set()
    for origin, before, after in inputs:
        if (before, after) in seen:
            continue
        seen.add((before, after))
        steps = [{'operation': op, 'amount': count} for op, count in SpanUpdater.get_diff_steps_builtin(before, after)]
        cases.append({'id': len(cases), 'origin': origin, 'before': native(before), 'after': native(after), 'steps': steps})
    annotations = []
    for before, after, start, end in [('ab', 'ba', 0, 1), ('abaaba', 'baabaa', 1, 4), ('foo 1 U.S. 1 bar', 'foo <i>1 U.S. 1</i> bar', 4, 12), ('😀ab', 'a😀b', 0, 1), ('a\ud800b', '\ud800ab', 0, 1)]:
        for use_dmp in [True, False]:
            row = {'id': len(annotations), 'plain': native(before), 'source': native(after), 'start': start, 'end': end, 'useDmp': use_dmp}
            try:
                row.update(output=native(annotate_citations(before, [((start, end), '[', ']')], source_text=after, use_dmp=use_dmp)), error=None)
            except (UnicodeError, ValueError) as exc:
                row.update(output=None, error=type(exc).__name__)
            annotations.append(row)
    report = {'schemaVersion': 'citation-builtin-diff/v1', 'oracleCommit': pin, 'oracleTree': git('rev-parse', 'HEAD^{tree}'), 'python': '3.11.15', 'difflibSha256': stdlib_sha, 'annotateSha256': sha((root / 'eyecite/annotate.py').read_bytes()), 'producerSha256': sha(Path(__file__).read_bytes()), 'cases': cases, 'annotations': annotations}
    assert git("status", "--porcelain") == "", "source changed during observation"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    header = dict(report)
    header.pop('cases')
    header.pop('annotations')
    text = json.dumps(header, ensure_ascii=True, indent=2)[:-2] + ',\n'
    for name in ['cases', 'annotations']:
        text += '  "' + name + '": [\n'
        text += ',\n'.join('    ' + json.dumps(row, ensure_ascii=True, separators=(',', ':')) for row in report[name])
        text += '\n  ]' + (',\n' if name == 'cases' else '\n}\n')
    args.output.write_text(text)
    print(json.dumps({'cases': len(cases), 'shortBinaryInputs': len(words) ** 2, 'sourceEvidenceOnly': True}))


if __name__ == '__main__':
    main()
