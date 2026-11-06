#!/usr/bin/env python3
"""Bind stop-word cleanup patterns to independent pinned regex-V0 profiles."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys


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
    import regex
    from regex import _regex_core as core
    from eyecite import regexes
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0

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
        assert type(node).__name__ in ('Character', 'Any', 'Property', 'Range', 'SetUnion', 'StartOfString', 'EndOfStringLine'), type(node).__name__
        return (0 if node.is_empty() else node.max_width()), False, False, False

    sha = lambda data: hashlib.sha256(data).hexdigest()
    patterns, bindings = {}, []
    for name, pattern in [('stopWords', regexes.STOP_WORD_REGEX), ('leadingIn', r'^(?i)In\s+')]:
        assert pattern.isascii()
        patterns[name] = {'width': 1, 'bytes': pattern.encode().hex()}
        fingerprint = sha(b'\x01' + pattern.encode())
        for flags in ((0, 2) if name == 'stopWords' else (0,)):
            compiled = regex.compile(pattern, flags)
            source, info = core.Source(pattern), core.Info(flags | core.UNICODE | core.VERSION0)
            width, _, repeated, nullable = profile(core._parse_pattern(source, info))
            assert info.group_count == compiled.groups and width > 0 and not repeated and not nullable
            bindings.append({'patternSha256': fingerprint, 'flags': flags,
                             'profile': {'groups': compiled.groups, 'names': dict(compiled.groupindex),
                                         'minimumWidthFloor': width, 'repeatedCaptures': repeated,
                                         'nullableMultiRepeat': nullable}})
    out = {'schemaVersion': 'citation-stop-word-patterns/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'regex': '2023.12.25', 'producerSha256': sha(Path(__file__).read_bytes()),
           'regexesSha256': sha((root / 'eyecite/regexes.py').read_bytes()),
           'coreSha256': sha(Path(core.__file__).read_bytes()), 'configuration': {'patterns': patterns, 'bindings': bindings}}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'bindings': bindings}))


if __name__ == '__main__':
    main()
