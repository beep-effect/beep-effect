#!/usr/bin/env python3
"""Observe positional/scoped case flags from both exact source regex engines."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
from re import _parser
import subprocess
import sys

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


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
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    import regex
    from regex import _regex_core as core
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    def python_profile(tree, repeated=False):
        captures = repeated_capture = nullable = False
        for kind, value in tree:
            name = str(kind)
            if name == 'SUBPATTERN':
                capturing = value[0] is not None
                captures |= capturing
                repeated_capture |= capturing and repeated
                child = python_profile(value[3], repeated)
            elif name == 'BRANCH':
                children = [python_profile(branch, repeated) for branch in value[1]]
                child = tuple(any(row[i] for row in children) for i in range(3))
            elif name in ('MAX_REPEAT', 'MIN_REPEAT'):
                multiple = value[1] > 1
                nullable |= multiple and value[2].getwidth()[0] == 0
                child = python_profile(value[2], repeated or multiple)
            else:
                child = (False, False, False)
            captures |= child[0]
            repeated_capture |= child[1]
            nullable |= child[2]
        return captures, repeated_capture, nullable

    def profile(node, repeated=False):
        if isinstance(node, core.Group):
            width, _, repeat, nullable = profile(node.subpattern, repeated)
            return width, True, repeated or repeat, nullable
        if isinstance(node, (core.GreedyRepeat, core.LazyRepeat)):
            multiple = node.max_count is None or node.max_count > 1
            width, captures, repeat, nullable = profile(node.subpattern, repeated or multiple)
            return width * node.min_count, captures, repeat, nullable or (multiple and width == 0)
        if isinstance(node, (core.Sequence, core.Branch)):
            rows = [profile(item, repeated) for item in (node.items if isinstance(node, core.Sequence) else node.branches)]
            width = sum(row[0] for row in rows) if isinstance(node, core.Sequence) else min(row[0] for row in rows)
            return width, *(any(row[i] for row in rows) for i in range(1, 4))
        return (0 if node.is_empty() else node.max_width()), False, False, False

    definitions = [
        (r'^(?i)In\s+', 0, True, 'İN '), (r'(?i)In\s+', 0, True, 'ın '),
        (r'a(?i)b', 0, True, 'aB'), (r'(a(?i)b)c', 0, True, 'aBc'),
        (r'(?i:a)b', 0, True, 'Ab'), (r'(?i)a(?-i)b', 0, True, 'Ab'),
        (r'(?i:a(?-i)b)c', 0, True, 'Abc'), (r'(?-i:a)b', 2, True, 'aB'),
        (r'a|(?i)b', 0, False, 'B'), (r'(?i:a|b)c', 0, False, 'Bc'),
        (r'(?:a(?i)b)c', 0, False, 'aBc'), (r'(?P<n>a(?i)b)c', 0, False, 'aBc'),
        (r'(?i)(?i)a', 0, False, 'A'), (r'(?ii)a', 0, False, 'A'),
        (r'(?i:(?-i:a)b)c', 0, False, 'aBc'), (r'(?i)a(?-i)b(?i)c', 0, False, 'AbC'),
        (r'a(?i)*b', 0, True, 'aab'), (r'a(?i)?b', 0, False, 'ab'),
        (r'(?i:a)+b', 0, False, 'Aab'), (r'(?i)', 0, True, ''),
        (r'(?-i)', 2, False, ''), (r'(?i:)', 0, False, ''),
        (r'(?i-i)a', 0, False, ''), (r'(?i-)a', 0, False, ''),
        (r'(?-:a)', 0, False, ''), (r'(?i', 0, False, ''),
        (r'(?i)*a', 0, False, ''), (r'a(?i)**b', 0, False, ''),
        (r'[(?i)]', 0, False, 'i'), (r'\(\?i\)', 0, False, '(?i)'),
        ('# (?i)\na', 64, True, 'a'), (' (?i) a ', 64, False, 'A'),
        (r'(?i:[a-z])(?-i:[A-Z])', 0, True, 'KA'),
        (r'(?i:\x69)N', 0, False, 'ıN'), (r'(?i:\bI\b)', 0, False, 'İ'),
    ]
    texts = ['', 'a', 'A', 'b', 'B', 'ab', 'aB', 'Ab', 'AB', 'abc', 'aBc', 'abC', 'ABC',
             'in ', 'IN ', 'In\n', 'İN ', 'ın ', 'KA', 'İN', 'aab', 'Aab', '(?i)', 'i', '😀']
    rows = []
    sha = lambda data: hashlib.sha256(data).hexdigest()
    for ordinal, (pattern, flags, smoke, witness) in enumerate(definitions):
        word = native(pattern)
        row = {'id': ordinal, 'pattern': word, 'flags': flags, 'smoke': smoke,
               'patternSha256': sha(bytes([word['width']]) + bytes.fromhex(word['bytes'])), 'engines': {}}
        for name, engine in (('python-re', re), ('python-regex-v0', regex)):
            try:
                compiled = engine.compile(pattern, flags)
            except (re.error, regex.error):
                row['engines'][name] = {'kind': 'source-error', 'profile': None, 'cases': []}
                continue
            if name == 'python-re':
                tree = _parser.parse(pattern, flags)
                width = tree.getwidth()[0]
                _, repeated, nullable = python_profile(tree)
            else:
                source = core.Source(pattern)
                source.ignore_space = bool(flags & regex.X)
                info = core.Info(flags | core.UNICODE | core.VERSION0)
                tree = core._parse_pattern(source, info)
                assert info.group_count == compiled.groups
                width, _, repeated, nullable = profile(tree)
            descriptor = {'groups': compiled.groups, 'names': dict(compiled.groupindex),
                          'minimumWidthFloor': width, 'repeatedCaptures': repeated, 'nullableMultiRepeat': nullable}
            cases = []
            for text in [witness] + [text for text in texts if text != witness]:
                modes = {}
                for mode in ('search', 'match', 'finditer'):
                    matches = list(compiled.finditer(text)) if mode == 'finditer' else [getattr(compiled, mode)(text)]
                    modes[mode] = [[list(match.span(group)) for group in range(compiled.groups + 1)]
                                   for match in matches if match is not None]
                cases.append({'source': native(text), 'modes': modes})
            row['engines'][name] = {'kind': 'parser-only' if repeated or nullable else 'single-match',
                                    'profile': descriptor, 'cases': cases}
        rows.append(row)
    out = {'schemaVersion': 'citation-regex-case-flags/v1', 'oracleCommit': PIN, 'oracleTree': TREE,
           'python': '3.11.15', 'regex': '2023.12.25', 'producerSha256': sha(Path(__file__).read_bytes()),
           'coreSha256': sha(Path(core.__file__).read_bytes()),
           'patterns': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    counts = {name: {str(full): sum((2 if row['engines'][name]['profile']['minimumWidthFloor'] == 0 else 3) *
                                   (len(row['engines'][name]['cases']) if full else 1) for row in rows
                                   if row['engines'][name]['kind'] == 'single-match' and (full or row['smoke']))
                     for full in (False, True)} for name in ('python-re', 'python-regex-v0')}
    print(json.dumps({'patterns': len(rows), 'outcomes': len(rows) * 2,
                      'observations': sum(3 * len(engine['cases']) for row in rows for engine in row['engines'].values()),
                      'counts': counts}))


if __name__ == '__main__':
    main()
