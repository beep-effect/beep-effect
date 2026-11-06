#!/usr/bin/env python3
"""Capture complete HTML-cleaner outcomes for every frozen input-preparation case."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(['git', '-C', str(root), *values], text=True).strip()
    assert git('rev-parse', 'HEAD') == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert git('rev-parse', 'HEAD^{tree}') == 'a35a58fac03400f71a93a93485b77f1d56f2b02f' and not git('status', '--porcelain')
    assert sys.version_info[:3] == (3, 11, 15) and os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    sys.path.insert(0, str(root))
    import lxml.html
    from lxml import etree
    from eyecite.clean import html
    assert etree.LIBXML_VERSION == etree.LIBXML_COMPILED_VERSION == (2, 12, 3)
    repo = Path(__file__).resolve().parents[3]
    path = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-input.json'
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    assert sha(path) == '66dc28d39e9c82120857af03227dfea59396fb3b7a65202248d52f53fa5a2a8a'
    inputs = json.loads(path.read_bytes())
    artifacts = {row['sha256']: row['value'] for row in inputs['artifacts']}
    def intern(value):
        digest = hashlib.sha256(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest()
        assert digest not in artifacts or artifacts[digest] == value
        artifacts[digest] = value
        return digest
    extra = []
    prefixes = ['', '<html>', '<!DOCTYPE html>', '\x1c<html>', '\ufeff<html>']
    bodies = [
        '<head>A<title>B</title>C</head>T<head>D<title>E</title>F</head>U<body>V</body>W',
        '<body>A</body>X<body>B</body>Y<body>C</body>Z',
        '<body>A<!--c-->B</body>X<body>C<!--d-->D</body>Y',
        '<body class="star-pagination">A</body>X<body>B<b>C</b>D</body>Y',
    ]
    for i, prefix in enumerate(prefixes):
        for j, body in enumerate(bodies):
            extra.append({'name': f'container:{i}:{j}', 'text': intern(prefix + body)})
    extra.extend([
        {'name': 'native-long-tag-name', 'text': intern('<' + 'a' * 50001 + '>VISIBLE</' + 'a' * 50001 + '>')},
        {'name': 'native-long-attribute-name', 'text': intern('<div ' + 'a' * 50001 + '="x">VISIBLE</div>')},
    ])
    rows = []
    for row in inputs['cases'] + extra:
        text = artifacts[row['text']]
        try:
            outcome = {'kind': 'success', 'value': intern(html(text))}
        except (ValueError, etree.ParserError) as error:
            outcome = {'kind': 'error', 'type': type(error).__module__ + '.' + type(error).__name__}
        diagnostics = [] if outcome.get('type') == 'builtins.ValueError' else [{'domain': e.domain_name, 'type': e.type_name, 'level': e.level_name, 'depthLimit': e.message.startswith('Excessive depth in document:'), 'resourceLimit': e.type_name in ['ERR_NAME_TOO_LONG', 'ERR_NO_MEMORY', 'XPATH_MEMORY_ERROR'] or e.message.startswith('Excessive depth in document:') or 'Huge input lookup' in e.message} for e in lxml.html.html_parser.error_log]
        rows.append({'name': row['name'], 'text': row['text'], 'outcome': outcome, 'diagnostics': diagnostics})
    report = {'schemaVersion': 'citation-html-kernel-cases/v1', 'scope': 'source cleaner outcomes; target worker qualification remains separate', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'), 'python': '3.11.15', 'pythonHashSeed': '0', 'producerSha256': sha(Path(__file__)), 'inputCorpusSha256': sha(path), 'cleanSourceSha256': sha(root / 'eyecite/clean.py'), 'licenseSha256': sha(root / 'LICENSE'), 'lockSha256': sha(root / 'uv.lock'), 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'reporters-db', 'courts-db', 'lxml']}, 'libxmlRuntime': list(etree.LIBXML_VERSION), 'libxmlCompiled': list(etree.LIBXML_COMPILED_VERSION), 'artifacts': [{'sha256': digest, 'value': artifacts[digest]} for digest in sorted(artifacts)], 'cases': rows}
    assert not git('status', '--porcelain')
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(rows)} complete cleaner outcomes / {len(artifacts)} immutable strings')


if __name__ == '__main__':
    main()
