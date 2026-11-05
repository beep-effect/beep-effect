#!/usr/bin/env python3
"""Capture actual positive lookahead profiles/matches and the journal helper pattern."""
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
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    import regex
    from regex import _regex_core as core
    from eyecite.regexes import POST_JOURNAL_CITATION_REGEX as journal
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    sha = lambda b: hashlib.sha256(b).hexdigest()
    def cp_walk(node, repeated=False):
        captures = repeat = nullable = False
        for op, value in node:
            name = str(op)
            child = (False, False, False)
            if name == 'SUBPATTERN':
                captures = True
                repeat |= repeated
                child = cp_walk(value[3], repeated)
            elif name == 'ASSERT':
                assert value[0] == 1
                child = cp_walk(value[1], repeated)
            elif name == 'BRANCH':
                children = [cp_walk(b, repeated) for b in value[1]]
                child = tuple(any(r[i] for r in children) for i in range(3))
            elif name in ('MAX_REPEAT', 'MIN_REPEAT'):
                multiple = value[1] > 1
                nullable |= multiple and value[2].getwidth()[0] == 0
                child = cp_walk(value[2], repeated or multiple)
            captures |= child[0]
            repeat |= child[1]
            nullable |= child[2]
        return captures, repeat, nullable
    def v0_walk(node, repeated=False):
        if isinstance(node, core.Group):
            width, _, repeat, nullable = v0_walk(node.subpattern, repeated)
            return width, True, repeated or repeat, nullable
        if isinstance(node, core.LookAround):
            assert not node.behind and node.positive
            _, captures, repeat, nullable = v0_walk(node.subpattern, repeated)
            return 0, captures, repeat, nullable
        if isinstance(node, (core.GreedyRepeat, core.LazyRepeat)):
            multiple = node.max_count is None or node.max_count > 1
            width, captures, repeat, nullable = v0_walk(node.subpattern, repeated or multiple)
            return width*node.min_count, captures, repeat, nullable or (multiple and width == 0)
        if isinstance(node, (core.Sequence, core.Branch)):
            children = [v0_walk(x, repeated) for x in (node.items if isinstance(node, core.Sequence) else node.branches)]
            width = sum(r[0] for r in children) if isinstance(node, core.Sequence) else min(r[0] for r in children)
            return width, *(any(r[i] for r in children) for i in range(1, 4))
        assert type(node).__name__ in ('Character', 'String', 'Property', 'Range', 'SetUnion', 'Any', 'StartOfString', 'EndOfString', 'EndOfStringLine'), type(node).__name__
        return (0 if node.is_empty() else node.max_width()), False, False, False
    definitions = [
        ('a(?=b)', ['ab', 'ac', 'a', 'zab'], 0, True),
        ('(?=a)a', ['a', 'b', 'za'], 0, False),
        ('(?=(?P<value>a+))a', ['aaa', 'ab', 'b'], 0, True),
        ('a(?=b|$)', ['ab', 'a', 'a\n', 'ac'], 0, False),
        ('(?=)', ['', 'x'], 0, False),
        ('(?=a)?a', ['a', 'aa', 'b'], 0, True),
        ('a(?=b)*', ['ab', 'a', 'ac'], 0, False),
        ('(?=(a?))?a', ['a', 'aa', 'b'], 0, True),
        ('(?:a(?=b))+', ['ab', 'aab', 'b'], 0, False),
        ('(?=a|ab)ab', ['ab', 'a', 'zab'], 0, False),
        ('(?=(?:a|b))(?P<value>.)', ['a', 'b', 'c'], 0, True),
        ('(?=😀)😀', ['😀', '\ud83d\ude00', 'x'], 0, False),
        ('(?=\ud83d\ude00)\ud83d\ude00', ['😀', '\ud83d\ude00', 'x'], 0, False),
        ('(? = a ) a', ['a', 'b'], 64, True),
    ]
    texts = [', 123 (2020)', ', 123x', ' (2020)', ' (note)', '', ', 42;', ', 12, 13 (2001) (remark)']
    definitions += [(journal, texts, 64, True), (f'^(?:{journal})', texts, 64, False), (f'(?:{journal})$', texts, 64, False)]
    rows = []
    for index, (pattern, texts, flags, smoke) in enumerate(definitions):
        word = native(pattern)
        record = {'id': index, 'pattern': word, 'flags': flags, 'smoke': smoke, 'patternSha256': sha(bytes([word['width']])+bytes.fromhex(word['bytes'])), 'engines': {}}
        for name, engine in (('python-re', re), ('python-regex-v0', regex)):
            try: compiled = engine.compile(pattern, flags)
            except (re.error, regex.error):
                record['engines'][name] = {'kind': 'source-error', 'profile': None, 'cases': []}
                continue
            if name == 'python-re':
                tree = _parser.parse(pattern, flags)
                _, repeated, nullable = cp_walk(tree)
                width = tree.getwidth()[0]
            else:
                source = core.Source(pattern)
                source.ignore_space = bool(flags & regex.X)
                info = core.Info(flags | core.UNICODE | core.VERSION0)
                tree = core._parse_pattern(source, info)
                width, _, repeated, nullable = v0_walk(tree)
            profile = {'groups': compiled.groups, 'names': dict(compiled.groupindex), 'minimumWidthFloor': width, 'repeatedCaptures': repeated, 'nullableMultiRepeat': nullable}
            cases = []
            for text in texts:
                modes = {}
                for mode in ('search', 'match', 'finditer'):
                    matches = list(compiled.finditer(text)) if mode == 'finditer' else [getattr(compiled, mode)(text)]
                    modes[mode] = [[list(m.span(g)) for g in range(compiled.groups+1)] for m in matches if m is not None]
                cases.append({'source': native(text), 'modes': modes})
            record['engines'][name] = {'kind': 'parser-only' if repeated or nullable else 'single-match', 'profile': profile, 'cases': cases}
        rows.append(record)
    out = {'schemaVersion': 'citation-regex-lookahead/v1', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'regex': '2023.12.25', 'producerSha256': sha(Path(__file__).read_bytes()), 'patterns': rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2)+'\n')
    print(json.dumps({'patterns': len(rows), 'sourceCalls': sum(3*len(e['cases']) for r in rows for e in r['engines'].values())}))


if __name__ == '__main__': main()
