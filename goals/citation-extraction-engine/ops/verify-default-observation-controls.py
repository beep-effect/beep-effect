#!/usr/bin/env python3
"""Validate source default branches and reject corrupted observations."""
import argparse
import collections
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def check(data):
    repo = Path(__file__).resolve().parents[3]
    fixtures = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    assert data['schemaVersion'] == 'citation-default-observations/v1'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['producerSha256'] == sha(Path(__file__).with_name('probe-default-observations.py'))
    assert data['contextProducerSha256'] == sha(Path(__file__).with_name('probe-default-resolution.py'))
    assert data['contextFixtureSha256'] == sha(fixtures / 'default-resolution-cases.json')
    assert data['sources'] == {'resolve.py': '651ede8c2a2d5df9ec9c9f1145530a6de7fca15304d1816b7f620a81ab3f2044', 'models.py': '2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a'}
    assert data['licenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['lockSha256'] == '864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a'
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0'
    contexts = json.loads((fixtures / 'default-resolution-cases.json').read_bytes())['cases']
    assert len(data['cases']) == 46
    assert [row['name'] for row in data['cases']] == [row['name'] for row in contexts]
    counts = collections.Counter()
    assert sum(len(row['nativeTrace']) for row in data['cases']) == 394
    for row, context in zip(data['cases'], contexts):
        assert row['outcome'] == context['outcome']
        assert [v['index'] for v in row['decisions']] == (list(range(len(context['mentions']))) if context['outcome']['status'] == 'value' else [])
        for event in row['nativeTrace']:
            assert event['method'].endswith('.__hash__') or event['method'].endswith('.__eq__')
            assert event['self'] is None or event['self'] in range(len(context['mentions']))
            assert event['other'] is None or event['other'] in range(len(context['mentions']))
        for decision in row['decisions']:
            counts[(decision['status'], decision.get('reason'))] += 1
            if decision['status'] == 'Ambiguous':
                assert decision['distinctCount'] == 2
                assert len(decision['candidateIndices']) >= 2
                assert all(index < decision['index'] and context['mentions'][index]['citation']['type'] in ('case', 'law', 'journal') for index in decision['candidateIndices'])
    assert counts == {('Resolved', None): 77, ('Unresolved', 'no-previous-authority'): 13, ('Unresolved', 'no-matching-authority'): 5, ('Ambiguous', None): 5, ('Unresolved', 'invalid-pin-cite'): 4, ('Unresolved', 'unsupported-citation'): 2, ('Unresolved', 'missing-antecedent'): 2}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/default-observations.json').read_bytes())
    check(data)
    ambiguous = next(i for i, row in enumerate(data['cases']) if any(v['status'] == 'Ambiguous' for v in row['decisions']))
    def change_count(d):
        next(v for v in d['cases'][ambiguous]['decisions'] if v['status'] == 'Ambiguous')['distinctCount'] = 1
    def change_reason(d):
        next(v for row in d['cases'] for v in row['decisions'] if v.get('reason') == 'invalid-pin-cite')['reason'] = 'no-matching-authority'
    mutations = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d.update(oracleCommit='a' * 40), change_count, change_reason, lambda d: d['cases'][0]['nativeTrace'].pop(), lambda d: d['sources'].update(**{'resolve.py': 'a' * 64}), lambda d: d.update(contextProducerSha256='a' * 64)]
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
            assert hashlib.sha256((args.oracle_root / 'eyecite' / name).read_bytes()).hexdigest() == digest
        with tempfile.TemporaryDirectory(prefix='citation-default-observations-') as directory:
            output = Path(directory) / 'observations.json'
            subprocess.run([sys.executable, str(Path(__file__).with_name('probe-default-observations.py')), '--oracle-root', str(args.oracle_root), '--output', str(output)], env={**os.environ, 'PYTHONHASHSEED': '0'}, stdout=subprocess.DEVNULL, check=True)
            assert json.loads(output.read_bytes()) == data
    print('PASS 46 default histories / 108 decisions / 394 unchanged native calls and 8 corruption controls; historical candidate identity translation remains conditional')


if __name__ == '__main__': main()
