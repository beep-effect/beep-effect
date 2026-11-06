#!/usr/bin/env python3
"""Capture candidate-processing regex profiles and direct CPython int results."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
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
    assert sys.version_info[:3] == (3, 11, 15) and sys.get_int_max_str_digits() == 4300
    import regex
    from regex import _regex_core as core
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    sha = lambda data: hashlib.sha256(data).hexdigest()

    def profile(node):
        if isinstance(node, (core.Sequence, core.Branch)):
            rows = [profile(item) for item in (node.items if isinstance(node, core.Sequence) else node.branches)]
            return (sum(row[0] for row in rows) if isinstance(node, core.Sequence) else min(row[0] for row in rows), any(row[1] for row in rows))
        if isinstance(node, (core.GreedyRepeat, core.LazyRepeat)):
            width, nullable = profile(node.subpattern)
            return width * node.min_count, nullable or (width == 0 and (node.max_count is None or node.max_count > 1))
        assert not isinstance(node, core.Group)
        return (0 if node.is_empty() else node.max_width()), False

    patterns, bindings = {}, []
    for name, pattern in [('splitV', r'\s+v\.?\s+'), ('lowercase', r'\b[a-z]\w*\b')]:
        patterns[name] = native(pattern)
        compiled = regex.compile(pattern)
        source, info = core.Source(pattern), core.Info(core.UNICODE | core.VERSION0)
        width, nullable = profile(core._parse_pattern(source, info))
        assert compiled.groups == info.group_count == 0 and width > 0 and not nullable
        bindings.append({'patternSha256': sha(b'\x01' + pattern.encode()), 'flags': 0,
                         'profile': {'groups': 0, 'names': {}, 'minimumWidthFloor': width,
                                     'repeatedCaptures': False, 'nullableMultiRepeat': nullable}})
    values = ['', ' ', '0', '0000', '+0', '-0', '+1999', '-1999', '1_999', '_1', '1_', '1__2',
              '  +1999 ', '１２３', '١٩٩٩', '𑽑𑽒𑽓𑽔', '\ud800', '😀', '\ud83d\ude00', '¹', '𝟙',
              '1.0', '0x10', '- 1', '9' * 4299, '9' * 4300, '9' * 4301, '0' * 4300,
              '0' * 4301, '_'.join('0' * 4300), '1' * 16, '-123456789012345678901234567890']
    values += [char + '+1999' + char for char in map(chr, range(0x110000)) if char.isspace()]
    cases = []
    for text in dict.fromkeys(values):
        error, value = None, None
        try:
            value = str(int(text))
        except ValueError:
            error = 'ValueError'
        cases.append({'id': len(cases), 'source': native(text), 'value': value, 'error': error})
    out = {'schemaVersion': 'citation-case-name-process-patterns/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'regex': '2023.12.25', 'integerDigitLimit': 4300,
           'producerSha256': sha(Path(__file__).read_bytes()), 'coreSha256': sha(Path(core.__file__).read_bytes()),
           'configuration': {'patterns': patterns, 'bindings': bindings}, 'integers': cases}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'bindings': bindings, 'integers': len(cases), 'errors': sum(row['error'] is not None for row in cases)}))


if __name__ == '__main__':
    main()
