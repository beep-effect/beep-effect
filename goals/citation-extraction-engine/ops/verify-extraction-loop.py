#!/usr/bin/env python3
"""Seal actual get_citations loop construction; optional exact pinned replay."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = '938316acc08880fd464a9e91b89e45ee802ed4ef08d6c08656baaa925fa97f3e'
PRODUCER_SHA = '4d646fc2f8b1caef262537f57856e467ee16382e798e55be91f686086e9bc4aa'
NORMALIZER_SHA = '9a8176ca6d55de38ff94731a1c532b9d4788651bcdd497c8d308b8520bae15e8'
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, producer, normalizer):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'extraction loop source seals'
    assert sha(normalizer) == NORMALIZER_SHA, 'original edition normalizer seal'
    corpus = json.loads(data)
    assert corpus['schemaVersion'] == 'citation-extraction-loop/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA and corpus['normalizerSha256'] == NORMALIZER_SHA
    assert corpus['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert corpus['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert corpus['python'] == '3.11.15' and corpus['versions']['eyecite'] == '2.7.6'
    assert corpus['versions']['regex'] == '2023.12.25'
    rows, bindings = corpus['cases'], corpus['bindings']
    assert len(rows) == 36 and len(bindings) == 8
    assert [row['id'] for row in rows] == list(range(36))
    assert [row['id'] for row in bindings] == list(range(8))
    assert len({row['ref'] for row in bindings}) == 8
    assert sum(len(row['before']) for row in rows) == 80
    assert sum(len(row['expected']) for row in rows) == 77
    assert sum(len(row['warnings']) for row in rows) == 2
    assert sum(bool(row['markup']['bytes']) for row in rows) == 4
    assert sum(row['removeAmbiguous'] for row in rows) == 16
    for row in rows:
        assert row['expected'] == [row['before'][index] for index in row['returned']]
        assert all(c['documentAttached'] == (c['kind'] != 'ReferenceCitation') for c in row['before'])
    assert {c['kind'] for row in rows for c in row['before']} == {'FullCaseCitation', 'FullLawCitation', 'FullJournalCitation', 'ShortCaseCitation', 'IdCitation', 'SupraCitation', 'UnknownCitation', 'ReferenceCitation'}
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'extraction-loop.json').read_bytes()
    producer, normalizer = ops / 'probe-extraction-loop.py', ops / 'export-operations.py'
    corpus = validate(data, producer.read_bytes(), normalizer.read_bytes())
    controls = 0
    if args.self_test:
        mutations = []
        for key in ['producerSha256', 'normalizerSha256', 'licenseSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['cases'][2]['expected'][0]['kind'] = 'FullLawCitation'
        mutations.extend([json.dumps(changed).encode(), data + b' '])
        for changed in mutations:
            try:
                validate(changed, producer.read_bytes(), normalizer.read_bytes())
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed original extraction-loop evidence accepted')
        for changed_producer, changed_normalizer in [(producer.read_bytes() + b' ', normalizer.read_bytes()), (producer.read_bytes(), normalizer.read_bytes() + b' ')]:
            try:
                validate(data, changed_producer, changed_normalizer)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed source dependency accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-extraction-loop-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original extraction-loop replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'controls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
