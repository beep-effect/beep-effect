#!/usr/bin/env python3
"""Validate literal cleaner provenance, content references and corruption controls."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def check(data):
    sha = lambda value: hashlib.sha256(value).hexdigest()
    assert data['schemaVersion'] == 'citation-literal-cleaners/v1'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['producerSha256'] == sha(Path(__file__).with_name('probe-literal-cleaners.py').read_bytes())
    assert data['sources'] == {'clean.py': 'b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db', 'tests/test_UtilsTest.py': '578a4ae4403a41623df62e082c86895bc05b4abd0a916b606214e40e65af8c1a'}
    assert data['licenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['lockSha256'] == '864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a'
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0' and data['unicodeVersion'] == '14.0.0'
    assert data['versions'] == {'eyecite': '2.7.6', 'reporters-db': '3.2.53', 'courts-db': '0.10.22', 'lxml': '5.1.0'}
    assert data['testedCodePoints'] == 1114112
    assert data['classifiers'] == {'inline_whitespace': [9, 32], 'all_whitespace': [9, 10, 11, 12, 13, 28, 29, 30, 31, 32, 133, 160, 5760, *range(8192, 8204), 8232, 8233, 8239, 8287, 12288], 'underscores': [], 'xml': []}
    artifacts = {row['sha256']: row['value'] for row in data['artifacts']}
    assert len(artifacts) == len(data['artifacts']) == 135
    assert list(artifacts) == sorted(artifacts)
    assert all(sha(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')) == digest for digest, value in artifacts.items())
    names = ['inline_whitespace', 'all_whitespace', 'underscores', 'xml']
    assert [row['name'] for row in data['cases']] == [f'{name}:{i}' for name in names for i in range(110)]
    assert all(row['cleaner'] == row['name'].split(':')[0] and row['text'] in artifacts and row['expected'] in artifacts for row in data['cases'])
    assert {row[key] for row in data['cases'] for key in ('text', 'expected')} == set(artifacts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/literal-cleaners.json').read_bytes())
    check(data)
    mutations = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d.update(oracleCommit='a' * 40), lambda d: d['artifacts'][0].update(value='corrupt'), lambda d: d['artifacts'].pop(), lambda d: d['cases'][0].update(text='a' * 64), lambda d: d['classifiers']['all_whitespace'].append(65279), lambda d: d.update(producerSha256='a' * 64)]
    for mutate in mutations:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            check(broken)
        except AssertionError:
            continue
        raise AssertionError('corruption accepted')
    if args.oracle_root:
        for name, digest in data['sources'].items():
            path = args.oracle_root / ('eyecite/' + name if name == 'clean.py' else name)
            assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
        with tempfile.TemporaryDirectory(prefix='citation-literal-cleaners-') as directory:
            output = Path(directory) / 'observations.json'
            subprocess.run([sys.executable, str(Path(__file__).with_name('probe-literal-cleaners.py')), '--oracle-root', str(args.oracle_root), '--output', str(output)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert json.loads(output.read_bytes()) == data
    print('PASS 440 literal vectors, 135 immutable strings, 4 x 1114112 code-point evaluations and 8 corruption controls; HTML/custom pipeline and full safety proof remain open')


if __name__ == '__main__': main()
