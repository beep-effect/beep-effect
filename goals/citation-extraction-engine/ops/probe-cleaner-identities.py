#!/usr/bin/env python3
"""Capture pinned cleaner text identity, subclass and coercion-hook behavior."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--cpython-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *a: subprocess.check_output(['git', '-C', str(root), *a], text=True).strip()
    assert git('rev-parse', 'HEAD') == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert git('rev-parse', 'HEAD^{tree}') == 'a35a58fac03400f71a93a93485b77f1d56f2b02f' and not git('status', '--porcelain')
    assert sys.version_info[:3] == (3, 11, 15) and os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    pins = {'sre.c': 'db0b655aad48299782cfa460d6bac5d0093015b675ab193c0526fbc8ef5d2b78', 'unicodeobject.c': '5dde8eb1b99878b4ea113cd6b5f88bca3667b0e23dc8c5262a07f5ea14d0d82e', 'LICENSE': '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf'}
    assert all(sha(args.cpython_root / name) == expected for name, expected in pins.items())
    sys.path.insert(0, str(root))
    from eyecite.clean import cleaners_lookup
    hooks = []
    class Marked(str):
        def __str__(self): hooks.append('str'); raise AssertionError('coercion')
        def __len__(self): hooks.append('len'); raise AssertionError('length hook')
        def __getitem__(self, key): hooks.append('getitem'); raise AssertionError('slice hook')
        def __eq__(self, value): hooks.append('eq'); raise AssertionError('comparison hook')
        def __hash__(self): hooks.append('hash'); raise AssertionError('hash hook')
    artifacts = {}
    def intern(value):
        value = str.__str__(value)
        digest = hashlib.sha256(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest()
        assert digest not in artifacts or artifacts[digest] == value
        artifacts[digest] = value
        return digest
    empty, space = '', chr(32)
    texts = ['', 'A', 'é', 'Ā', '😀', 'AB', '_', '__', '___', 'A_B', 'A__', '__A', 'A__B', 'A__B___C', ' ', '  ', '\t', '\r\n', '\u200b', '\u00a0', 'A B', ' A ', '__ __', '__ ', ' __', '<?xml?>', '<?xml?>A', '<?xml?> ', '<?xml?><b>A</b>', '<?xml\n?>A', '<b>A</b>', '<script>X</script>', '<p>A</p><p>B</p>', '\ud800__A\t\udfff']
    cases = []
    retained = []
    for cleaner, fn in cleaners_lookup.items():
        for index, value in enumerate(texts):
            for subtype in ['plain', 'marked']:
                first = ''.join(['', value]) if subtype == 'plain' else Marked(value)
                other = ''.join(['', value]) if subtype == 'plain' else Marked(value)
                retained.extend([first, other])
                hooks.clear()
                try:
                    result = fn(first)
                    repeated = fn(first)
                    independent = fn(other)
                    retained.extend([result, repeated, independent])
                    relations = {'sameInput': result is first, 'sameAcrossCalls': result is repeated, 'sameAcrossInputs': result is independent, 'sameInputObjects': first is other, 'cachedEmpty': result is empty, 'cachedSpace': result is space}
                    outcome = {'kind': 'success', 'text': intern(result), 'subtype': 'plain' if type(result) is str else 'marked', **relations}
                    assert intern(repeated) == outcome['text'] == intern(independent)
                except Exception as error:
                    outcome = {'kind': 'error', 'type': type(error).__module__ + '.' + type(error).__name__, 'message': intern(str(error))}
                cases.append({'name': f'{cleaner}:{index}:{subtype}', 'cleaner': cleaner, 'input': intern(value), 'subtype': subtype, 'outcome': outcome, 'hooks': list(hooks)})
    report = {'schemaVersion': 'citation-cleaner-identities/v1', 'scope': 'source text object identity and subclass observations; live owner proof remains separate', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'), 'python': '3.11.15', 'pythonHashSeed': '0', 'producerSha256': sha(Path(__file__)), 'cleanSourceSha256': sha(root / 'eyecite/clean.py'), 'oracleLicenseSha256': sha(root / 'LICENSE'), 'cpythonSource': {'tag': 'v3.11.15', 'files': pins}, 'artifacts': [{'sha256': k, 'value': artifacts[k]} for k in sorted(artifacts)], 'cases': cases}
    assert not git('status', '--porcelain')
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(cases)} complete identity cases / {len(artifacts)} full strings')


if __name__ == '__main__':
    main()
