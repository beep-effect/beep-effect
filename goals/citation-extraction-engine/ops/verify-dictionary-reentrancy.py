"""Verify direct dictionary mutation evidence, controls and optional pinned replay."""
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
    canonical = json.dumps(data, separators=(',', ':')).encode()
    assert hashlib.sha256(canonical).hexdigest() == '0b9fa521222051a120381f8b6cb64338e546c8453abc706a9f88b42af0c14b2e'
    assert data['schemaVersion'] == 'citation-dictionary-reentrancy/v1'
    assert data['producerSha256'] == hashlib.sha256(Path(__file__).with_name('probe-dictionary-reentrancy.py').read_bytes()).hexdigest()
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['dictionarySourceSha256'] == '474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8'
    assert data['cpythonLicenseSha256'] == '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf'
    assert [row['name'] for row in data['cases']] == ['clear-in-get', 'remove-in-get', 'replace-in-get', 'update-in-get', 'insert-no-resize', 'resize-in-get', 'resize-in-set', 'clear-in-remove', 'mutate-raise', 'false-after-resize', 'replace-five', 'read-get', 'clear-refill']
    assert sum(len(row['events']) for row in data['cases']) == 26
    assert sum(len(event['trace']) for row in data['cases'] for event in row['events']) == 49
    assert sum(event['outcome']['status'] == 'error' for row in data['cases'] for event in row['events']) == 1
    for row in data['cases']:
        assert [key['objectId'] for key in row['keys']] == list(range(7))
        assert all(event['operation']['key'] in [0, 1] and len({entry['objectId'] for entry in event['entries']}) == len(event['entries']) for event in row['events'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--cpython-root', type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/dictionary-reentrancy.json').read_bytes())
    check(data)
    mutations = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d['cases'].reverse(), lambda d: d['cases'][0]['events'][0]['trace'].clear(), lambda d: d['cases'][0]['events'][0]['outcome'].update(result=999), lambda d: d['cases'][0]['events'][0]['entries'].append({'objectId': 0, 'value': 999}), lambda d: d.update(oracleCommit='a' * 40), lambda d: d.update(cpythonLicenseSha256='a' * 64), lambda d: d.update(producerSha256='a' * 64), lambda d: d.update(scope='complete engine parity')]
    for mutate in mutations:
        altered = copy.deepcopy(data)
        mutate(altered)
        try: check(altered)
        except AssertionError: continue
        raise AssertionError('corruption accepted')
    if args.oracle_root is not None:
        assert args.cpython_root is not None
        with tempfile.TemporaryDirectory(prefix='citation-dictionary-reentrancy-') as directory:
            output = Path(directory) / 'fresh.json'
            subprocess.run([sys.executable, str(Path(__file__).with_name('probe-dictionary-reentrancy.py')), '--oracle-root', str(args.oracle_root), '--cpython-root', str(args.cpython_root), '--output', str(output)], cwd=repo, env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert json.loads(output.read_bytes()) == data
    print('PASS 13 direct comparison-mutation histories, 26 outcomes, 49 trace events and 10 corruption controls; full dictionary/cleaner parity remains open')


if __name__ == '__main__': main()
