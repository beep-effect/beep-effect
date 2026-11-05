#!/usr/bin/env python3
"""Capture literal cleaner vectors and exhaustive single-code-point facts."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
import unicodedata


PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(['git', '-C', str(root), *values], text=True).strip()
    assert git('rev-parse', 'HEAD') == PIN and git('rev-parse', 'HEAD^{tree}') == TREE and not git('status', '--porcelain')
    assert sys.version_info[:3] == (3, 11, 15) and unicodedata.unidata_version == '14.0.0'
    assert os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    sys.path.insert(0, str(root))
    from eyecite import clean
    names = ['inline_whitespace', 'all_whitespace', 'underscores', 'xml']
    classifiers = {name: [] for name in names}
    for point in range(0x110000):
        char = chr(point)
        for name in names:
            result = getattr(clean, name)(char)
            if (result == ' ' if name.endswith('whitespace') else result != char): classifiers[name].append(point)
    texts = [
        '', 'a', '  word \t \n  word  ', '__word__word_', '_', '__', '___', '_a__b___c_',
        'a\r\nb\vc\fd', '\ufeff\u200b\u0085\u001c\u2028\u2029\u00a0', '😀__a\t\t😀', '\ud800__\udfff',
        '<?xml?>tail', '<?xml version="1"?>tail', '<?xml\r?>tail', '<?xml\n?>tail',
        '<?xml\u2028?>tail', '<?xml\u2029?>tail', '<?xml\x00?>tail', '<?xml\v?>tail',
        '<?XML?>tail', ' <?xml?>tail', '\ufeff<?xml?>tail', '<?xml?><?xml?>tail', '<?xmlfoo?>tail',
        '<?xml?x?>tail', '<?xml?>\nrest', '<?xml', '<?xml?', '<?xml\r\n?>tail',
    ]
    for point in classifiers['all_whitespace']:
        char = chr(point)
        texts.extend(['a' + char * 3 + 'b', char * 2 + 'a' + char * 2])
    for size in [4094, 4095, 4096, 4097, 8193]:
        texts.extend(['a' * size + '___z', '_' * size + 'a', 'a' * size + ' \t z', '<?xml' + 'x' * size + '?>tail'])
    artifacts = {}
    def intern(text):
        digest = hashlib.sha256(json.dumps(text, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest()
        assert digest not in artifacts or artifacts[digest] == text
        artifacts[digest] = text
        return digest
    cases = [{'name': f'{name}:{index}', 'cleaner': name, 'text': intern(text), 'expected': intern(getattr(clean, name)(text))} for name in names for index, text in enumerate(texts)]
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    report = {'schemaVersion': 'citation-literal-cleaners/v1', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'pythonHashSeed': '0', 'unicodeVersion': unicodedata.unidata_version, 'producerSha256': sha(Path(__file__)), 'sources': {'clean.py': sha(root / 'eyecite/clean.py'), 'tests/test_UtilsTest.py': sha(root / 'tests/test_UtilsTest.py')}, 'licenseSha256': sha(root / 'LICENSE'), 'lockSha256': sha(root / 'uv.lock'), 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'reporters-db', 'courts-db', 'lxml']}, 'testedCodePoints': 0x110000, 'classifiers': classifiers, 'artifacts': [{'sha256': digest, 'value': artifacts[digest]} for digest in sorted(artifacts)], 'cases': cases}
    assert not git('status', '--porcelain')
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(cases)} primitive vectors and 4 x 1114112 single-code-point evaluations')


if __name__ == '__main__': main()
