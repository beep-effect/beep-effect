#!/usr/bin/env python3
"""Observe original annotation source mapping and exact pre-overlap coordinates."""
import argparse
from bisect import bisect_left, bisect_right
import hashlib
import importlib.metadata
import json
from pathlib import Path
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
    import fast_diff_match_patch
    assert importlib.metadata.version("fast-diff-match-patch") == "2.0.1"
    assert fast_diff_match_patch.CHAR_WIDTH == 4
    from eyecite.annotate import SpanUpdater, annotate_citations
    from eyecite.utils import placeholder_markup
    pairs = [('foo 1 U.S. 1 bar', 'foo <i>1 U.S. 1</i> bar'),
             ('Foo Bar', '<i>Foo</i> <em>Bar</em>'), ('ababa', 'ab'),
             ('A😀B', '<b>A</b>😀B'), ('A\ud800B', '<i>A\ud800</i>B'),
             ('A\ud83d\ude00B', 'A<i>\ud83d\ude00</i>B')]
    rows = []
    pack = lambda values: [{'start': span[0], 'end': span[1], 'before': native(before), 'after': native(after)}
                           for span, before, after in values]
    for plain, source in pairs:
        placeholder = placeholder_markup(source)
        updater = SpanUpdater(plain, placeholder)
        n = len(plain)
        for annotations in [[((0, n), '[', ']')], [((1, n-1), '<a>', '</a>')],
                            [((-1, n+2), '(', ')')], [((0, 1), '[', ']'), ((1, n), '{', '}')],
                            [((1, 1), 'B', 'b'), ((1, 1), 'A', 'a')],
                            [((2, 1), '<a>', '</a>'), ((0, n), '[', ']')]]:
            mapped = [((updater.update(start, bisect_right), updater.update(end, bisect_left)), before, after)
                      for (start, end), before, after in sorted(annotations)]
            result = annotate_citations(plain, annotations, source_text=source)
            assert result == annotate_citations(plain, annotations, source_text=source, offset_updater=updater)
            rows.append({'id': len(rows), 'plain': native(plain), 'source': native(source),
                         'placeholder': native(placeholder), 'input': pack(annotations), 'mapped': pack(mapped),
                         'steps': [{'operation': op, 'amount': amount} for op, amount in SpanUpdater.get_diff_steps(plain, placeholder)],
                         'result': native(result)})
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    out = {'schemaVersion': 'citation-annotation-mapping/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'dmp': '2.0.1', 'dmpModuleSha256': sha(Path(fast_diff_match_patch.__file__).read_bytes()), 'producerSha256': sha(Path(__file__).read_bytes()),
           'annotateSha256': sha((root / 'eyecite/annotate.py').read_bytes()), 'cases': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows), 'mappedAnnotations': sum(len(row['mapped']) for row in rows)}))


if __name__ == '__main__':
    main()
