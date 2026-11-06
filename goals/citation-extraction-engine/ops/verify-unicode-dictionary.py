#!/usr/bin/env python3
"""Validate complete pinned Unicode/general dictionary observations."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[3]
FIXTURE = REPO / 'packages/law-practice/use-cases/test/fixtures/eyecite/unicode-dictionary.json'
PRODUCER = Path(__file__).with_name('probe-unicode-dictionary.py')
SCENES = ['exact-text', 'host-hit', 'host-miss', 'host-set-hit', 'host-set-miss', 'delete-in-equality', 'update-in-equality', 'clear-refill', 'convert-in-equality', 'delete-raise', 'subclass-hit', 'subclass-miss', 'clear-after-general']


def sha(raw): return hashlib.sha256(raw).hexdigest()


def check(data):
    assert sha(json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode()) == '6e1d9f8bd4366b7db4ddbce52fbb4e3a9f320b08f837e730c7e3f79281231081'
    assert data['schemaVersion'] == 'citation-unicode-dictionary/v1'
    assert data['scope'] == 'combined Unicode/general-key transitions; source hash production, split tables and complete cleaner registry remain open'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0'
    assert data['hashWidth'] == 64 and data['hashAlgorithm'] == 'siphash13'
    assert data['producerSha256'] == sha(PRODUCER.read_bytes())
    assert data['dictionarySourceSha256'] == '474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8'
    assert data['cpythonLicenseSha256'] == '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf'
    assert data['oracleLicenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert [row['name'] for row in data['cases']] == SCENES
    outcomes = failures = hooks = 0
    for row in data['cases']:
        assert len(row['keys']) == 8 and row['initial'] == list(range(5))
        assert [k['objectId'] for k in row['keys']] == list(range(8))
        for key in row['keys']:
            assert key['kind'] in ['text', 'host', 'subclass']
            assert -(2 ** 63) <= int(key['hash']) < 2 ** 63 and int(key['hash']) != -1
            assert isinstance(key['text'], str) and isinstance(key['token'], str)
        for event in row['events']:
            outcomes += 1
            assert event['operation']['kind'] in ['get', 'set', 'clear']
            failures += event['outcome']['status'] == 'error'
            if event['outcome']['status'] == 'error': assert event['outcome'] == {'status': 'error', 'kind': 'ValueError'}
            for entry in event['entries']: assert 0 <= entry['objectId'] < 8 and type(entry['value']) is int
            for hook in event['trace']:
                hooks += 1
                assert hook['kind'] in ['hash', 'compare', 'remove', 'set', 'clear']
    assert outcomes == 40 and failures == 1 and hooks == 62


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--cpython-root', type=Path)
    args = parser.parse_args()
    raw = FIXTURE.read_bytes(); data = json.loads(raw); check(data)
    mutations = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d['cases'][0]['events'].pop(), lambda d: d['cases'][1]['events'][0]['trace'].clear(), lambda d: d['cases'][0]['keys'][0].update(hash='0'), lambda d: d['cases'][0]['keys'][0].update(kind='host'), lambda d: d.update(oracleCommit='0' * 40), lambda d: d.update(scope='complete cleaner parity'), lambda d: d.update(producerSha256='0' * 64), lambda d: d.update(cpythonLicenseSha256='0' * 64), lambda d: d['cases'][9]['events'][0].update(outcome={'status': 'value', 'result': 100}), lambda d: d['cases'][0]['events'][0]['entries'][0].update(value=999)]
    for mutate in mutations:
        corrupt = copy.deepcopy(data); mutate(corrupt)
        try: check(corrupt)
        except AssertionError: continue
        raise AssertionError('corrupt Unicode dictionary observation accepted')
    if args.oracle_root or args.cpython_root:
        assert args.oracle_root and args.cpython_root
        with tempfile.TemporaryDirectory(prefix='citation-unicode-dictionary-') as tmp:
            target = Path(tmp) / 'source.json'
            subprocess.run([str(args.oracle_root / '.venv/bin/python'), str(PRODUCER), '--oracle-root', str(args.oracle_root), '--cpython-root', str(args.cpython_root), '--output', str(target)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert target.read_bytes() == raw
    print('PASS 13 Unicode/general histories / 40 full outcomes / 12 corruption controls; complete registry proof remains open')


if __name__ == '__main__': main()
