#!/usr/bin/env python3
"""Bind the original HTML single-element versus split to its regex-V0 profile."""
import argparse
import ast
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (
        '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    import regex
    from regex import _regex_core as core
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    source_file = root / 'eyecite/helpers.py'
    helper = next(node for node in ast.parse(source_file.read_text()).body
                  if isinstance(node, ast.FunctionDef) and node.name == '_extract_from_single_html_element')
    pattern = next(ast.literal_eval(node.value) for node in helper.body
                   if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'pattern' for target in node.targets))
    compiled = regex.compile(pattern, regex.I)
    info = core.Info(core.UNICODE | core.VERSION0 | core.IGNORECASE)
    tree = core._parse_pattern(core.Source(pattern), info)

    def profile(node):
        if isinstance(node, core.Sequence):
            rows = [profile(item) for item in node.items]
            return sum(row[0] for row in rows), any(row[1] for row in rows)
        if isinstance(node, (core.GreedyRepeat, core.LazyRepeat)):
            width, nullable = profile(node.subpattern)
            return width * node.min_count, nullable or (width == 0 and (node.max_count is None or node.max_count > 1))
        assert not isinstance(node, (core.Group, core.Branch)), type(node).__name__
        return (0 if node.is_empty() else node.max_width()), False

    width, nullable = profile(tree)
    assert compiled.groups == info.group_count == 0 and width > 0 and not nullable
    sha = lambda data: hashlib.sha256(data).hexdigest()
    values = ['Foo v. Bar', 'Foo vs Bar', 'Foo VS. Bar', 'Foo vſ. Bar', 'Foo\tv.\nBar', 'Foo v.Bar', 'Foo v. Bar v. Third']
    output = {'schemaVersion': 'citation-html-case-name-pattern/v1', 'oracleCommit': git('rev-parse', 'HEAD'),
              'python': '3.11.15', 'regex': '2023.12.25', 'producerSha256': sha(Path(__file__).read_bytes()),
              'helpersSha256': sha(source_file.read_bytes()), 'regexCoreSha256': sha(Path(core.__file__).read_bytes()),
              'configuration': {'patterns': {'splitV': {'width': 1, 'bytes': pattern.encode().hex()}},
                                'bindings': [{'patternSha256': sha(b'\x01' + pattern.encode()), 'flags': 2,
                                              'profile': {'groups': 0, 'names': {}, 'minimumWidthFloor': width,
                                                          'repeatedCaptures': False, 'nullableMultiRepeat': nullable}}]},
              'splits': [{'source': value, 'result': compiled.split(value, maxsplit=1)} for value in values]}
    repo = Path(__file__).resolve().parents[3]
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-case-name-pattern.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path=' + str(fixture)],
                               input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n',
                               cwd=repo, text=True, capture_output=True, check=True).stdout
    args.output.write_text(formatted)
    print(f'Captured original HTML versus split: minimum width {width}, flags 2, no captures; source evidence only')


if __name__ == '__main__':
    main()
