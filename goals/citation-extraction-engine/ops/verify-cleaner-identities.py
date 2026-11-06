#!/usr/bin/env python3
"""Seal complete cleaner identity observations and reject fabricated relations."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[3]
FIXTURE = REPO / 'packages/law-practice/use-cases/test/fixtures/eyecite/cleaner-identities.json'
PRODUCER = Path(__file__).with_name('probe-cleaner-identities.py')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return sha(json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode('ascii'))


def check(data):
    assert canonical(data) == '9764f039311c092718f16a935aad2ee9ff801c0a59795cca1f2b82a5264220f0'
    assert data['schemaVersion'] == 'citation-cleaner-identities/v1'
    assert data['scope'] == 'source text object identity and subclass observations; live owner proof remains separate'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0'
    assert data['producerSha256'] == sha(PRODUCER.read_bytes())
    assert data['cleanSourceSha256'] == 'b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db'
    assert data['oracleLicenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['cpythonSource'] == {'tag': 'v3.11.15', 'files': {'sre.c': 'db0b655aad48299782cfa460d6bac5d0093015b675ab193c0526fbc8ef5d2b78', 'unicodeobject.c': '5dde8eb1b99878b4ea113cd6b5f88bca3667b0e23dc8c5262a07f5ea14d0d82e', 'LICENSE': '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf'}}
    artifacts = {}
    for row in data['artifacts']:
        assert row['sha256'] not in artifacts
        assert row['sha256'] == sha(json.dumps(row['value'], ensure_ascii=True, separators=(',', ':')).encode('ascii'))
        artifacts[row['sha256']] = row['value']
    assert len(artifacts) == 40 and len(data['cases']) == 340
    names, used, counts = set(), set(), {'success': 0, 'error': 0}
    for row in data['cases']:
        assert row['name'] not in names; names.add(row['name'])
        assert row['subtype'] in ['plain', 'marked'] and row['hooks'] == []
        used.add(row['input'])
        outcome = row['outcome']; counts[outcome['kind']] += 1
        if outcome['kind'] == 'success':
            assert outcome['subtype'] == 'plain'; used.add(outcome['text'])
            for name in ['sameInput', 'sameAcrossCalls', 'sameAcrossInputs', 'sameInputObjects', 'cachedEmpty', 'cachedSpace']:
                assert type(outcome[name]) is bool
        else:
            assert row['cleaner'] == 'html' and outcome['type'] == 'lxml.etree.ParserError'
            used.add(outcome['message'])
    assert used == set(artifacts) and counts == {'success': 324, 'error': 16}
    expected = {f'{name}:{index}:{subtype}' for name in ['html', 'inline_whitespace', 'all_whitespace', 'underscores', 'xml'] for index in range(34) for subtype in ['plain', 'marked']}
    assert names == expected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--cpython-root', type=Path)
    args = parser.parse_args()
    raw = FIXTURE.read_bytes(); data = json.loads(raw); check(data)
    mutations = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d['cases'][0].update(input='a' * 64), lambda d: d['artifacts'][0].update(value='corrupt'), lambda d: d.update(oracleCommit='a' * 40), lambda d: d.update(scope='target complete'), lambda d: d['cases'][1]['hooks'].append('str'), lambda d: d['cases'][0]['outcome'].update(type='builtins.TypeError'), lambda d: d['cases'][2]['outcome'].update(sameInput=not d['cases'][2]['outcome']['sameInput']), lambda d: d['cases'][2]['outcome'].update(cachedSpace=True), lambda d: d['cpythonSource']['files'].update(LICENSE='a' * 64), lambda d: d.update(producerSha256='a' * 64)]
    for mutate in mutations:
        broken = copy.deepcopy(data); mutate(broken)
        try: check(broken)
        except AssertionError: continue
        raise AssertionError('corrupt identity evidence accepted')
    if args.oracle_root or args.cpython_root:
        assert args.oracle_root and args.cpython_root
        with tempfile.TemporaryDirectory(prefix='citation-cleaner-identities-') as tmp:
            output = Path(tmp) / 'source.json'
            subprocess.run([str(args.oracle_root / '.venv/bin/python'), str(PRODUCER), '--oracle-root', str(args.oracle_root), '--cpython-root', str(args.cpython_root), '--output', str(output)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert output.read_bytes() == raw
    print('PASS 340 identity cases / 40 full strings / no coercion hooks / 12 corruption controls; full live owner parity remains separate')


if __name__ == '__main__':
    main()
