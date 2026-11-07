#!/usr/bin/env python3
"""Seal original shortcut state and identity evidence; optionally replay the pin."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = '1e676df2e8da2fae7831d9b93223b88d0f46a9a26587d5fc82833835fed12328'
PRODUCER_SHA = '3845143687fc8bd675020078e1e630f16f365db8a46f5a506c2dd23d4964474c'
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def validate(data, producer):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'shortcut source seals'
    corpus = json.loads(data)
    assert corpus['schemaVersion'] == 'citation-extraction-shortcut/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA
    assert corpus['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert corpus['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert corpus['python'] == '3.11.15' and corpus['versions']['eyecite'] == '2.7.6'
    rows, state = corpus['cases'], corpus['snapshot']
    assert len(rows) == 16 and [r['id'] for r in rows] == list(range(16))
    assert sum(r['shortcut'] for r in rows) == 4
    assert all(r['sameCitation'] and r['events'] == [] and r['error'] is None for r in rows[:4])
    assert all(not r['shortcut'] and r['events'] == ['Document'] for r in rows[4:])
    assert state['kind'] == 'FullCaseCitation' and state['token']['kind'] == 'CitationToken'
    assert state['span'] == state['fullSpan'] == [0, 99]
    assert state['year'] is None and state['editionGuess'] is None and not state['documentAttached']
    assert state['metadata']['year'] == {'width': 1, 'bytes': '32303231'}
    assert rows[13]['error'] == 'ValueError' and rows[14]['error'] == 'TypeError' and rows[15]['error'] is None
    assert state['groupsAliasToken']
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'extraction-shortcut.json').read_bytes()
    producer = ops / 'probe-extraction-shortcut.py'
    corpus = validate(data, producer.read_bytes())
    controls = 0
    if args.self_test:
        mutations = [data+b' ']
        for key in ['producerSha256', 'licenseSha256']:
            changed = json.loads(data); changed[key] = '0'*64
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data); changed['cases'][2]['events'] = ['Document']
        mutations.append(json.dumps(changed).encode())
        changed = json.loads(data); changed['snapshot']['year'] = 2021
        mutations.append(json.dumps(changed).encode())
        changed = json.loads(data); changed['snapshot']['span'][1] = 7
        mutations.append(json.dumps(changed).encode())
        for mutated in mutations:
            try:
                validate(mutated, producer.read_bytes())
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed shortcut evidence accepted')
        try:
            validate(data, producer.read_bytes()+b' ')
        except AssertionError:
            controls += 1
        else:
            raise AssertionError('changed shortcut producer accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-extraction-shortcut-') as temp:
            output = Path(temp)/'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original shortcut replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'controls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
