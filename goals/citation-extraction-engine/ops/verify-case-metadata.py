#!/usr/bin/env python3
"""Seal original full-case metadata transitions; optional exact pinned replay."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = 'a374a736cc27a3954165e0acfeca926a2adb92e7eacdbe6180794017afcd77a9'
PRODUCER_SHA = '6c15115203786794057d1b612ce3a0a710aebf7a49f538b9f93562020d8258cd'
NORMALIZER_SHA = '9a8176ca6d55de38ff94731a1c532b9d4788651bcdd497c8d308b8520bae15e8'
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, producer, normalizer):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'full-case evidence seals'
    assert sha(normalizer) == NORMALIZER_SHA, 'edition identity normalizer seal'
    corpus = json.loads(data)
    assert corpus['schemaVersion'] == 'citation-case-metadata/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA and corpus['normalizerSha256'] == NORMALIZER_SHA
    assert corpus['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert corpus['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert corpus['python'] == '3.11.15' and corpus['versions']['eyecite'] == '2.7.6'
    assert corpus['versions']['regex'] == '2023.12.25'
    assert corpus['highestValidYear'] == 2027 and corpus['currentDate'] == '2026-11-06'
    rows, documents, snapshots = corpus['cases'], corpus['documents'], corpus['snapshots']
    assert (len(rows), len(documents), len(snapshots)) == (80, 40, 150)
    assert [row['id'] for row in rows] == list(range(80))
    assert sum(call['count'] for row in rows for call in row['regexCalls']) == 21065
    assert sum(len(row['clockReads']) for row in rows) == 8
    counts = {name: 0 for name in ['Post', 'HtmlName', 'PlainName', 'Pre', 'Court', 'Edition']}
    for row in rows:
        document = documents[row['document']]
        trace = row['trace']
        names = [step['phase'] for step in trace]
        assert names[0] == 'Post' and names[-3:] == ['Pre', 'Court', 'Edition']
        assert names[1:-3] in ([['HtmlName'], ['HtmlName', 'PlainName']] if document['hasMarkup'] else [['PlainName']])
        current = row['initial']
        for step in trace:
            assert step['before'] == current
            assert 0 <= step['after'] < len(snapshots)
            before, after = snapshots[current], snapshots[step['after']]
            assert before['span'] == after['span']
            assert before['exact'] == after['exact'] and before['variation'] == after['variation']
            assert after['allEditions'] == after['exact'] + after['variation']
            if step['phase'] == 'Court':
                assert after['editionGuess'] == before['editionGuess']
                assert after['year'] == before['year']
            current = step['after']
            counts[step['phase']] += 1
        assert row['final'] == current
        prior = None
        for call in row['regexCalls']:
            assert call['phase'] in names and call['method'] in ['search', 'match', 'sub', 'split']
            assert isinstance(call['count'], int) and call['count'] > 0
            pair = (call['phase'], call['method'])
            assert pair != prior, 'noncanonical lossless call runs'
            prior = pair
        assert all(phase == 'Edition' for phase in row['clockReads'])
    assert counts == {'Post': 80, 'HtmlName': 40, 'PlainName': 51, 'Pre': 80, 'Court': 80, 'Edition': 80}
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'case-metadata.json').read_bytes()
    producer, normalizer = ops / 'probe-case-metadata.py', ops / 'export-operations.py'
    corpus = validate(data, producer.read_bytes(), normalizer.read_bytes())
    controls = 0
    if args.self_test:
        mutations = []
        for key in ['producerSha256', 'normalizerSha256', 'licenseSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['cases'][0]['trace'].reverse()
        mutations.extend([json.dumps(changed).encode(), data + b' '])
        changed = json.loads(data)
        changed['cases'][0]['regexCalls'][0]['count'] += 1
        mutations.append(json.dumps(changed).encode())
        for changed in mutations:
            try:
                validate(changed, producer.read_bytes(), normalizer.read_bytes())
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed full-case transition evidence accepted')
        for changed_producer, changed_normalizer in [(producer.read_bytes() + b' ', normalizer.read_bytes()), (producer.read_bytes(), normalizer.read_bytes() + b' ')]:
            try:
                validate(data, changed_producer, changed_normalizer)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed source dependency accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-case-metadata-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original full-case replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'controls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
