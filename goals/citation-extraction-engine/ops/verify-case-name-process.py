#!/usr/bin/env python3
"""Seal portable case-name processing evidence; optionally replay its oracle.

This validates source evidence only. It cannot qualify target implementation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = '027c7f42d55d4fe9ee6f000c98c6427d4931f45bf82675277f60864762b51505'
PRODUCER_SHA = 'ffb105df6a837b5d8179f53f60dc800979b661a550362e6b48e672ae83791767'
SCAN_SHA = '9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553'
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, producer, scan_data):
    assert sha(data) == CORPUS_SHA, 'case-name processing corpus seal'
    assert sha(producer) == PRODUCER_SHA, 'case-name processing producer seal'
    assert sha(scan_data) == SCAN_SHA, 'case-name scan dependency seal'
    corpus, scan = json.loads(data), json.loads(scan_data)
    assert corpus['schemaVersion'] == 'citation-case-name-process/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA and corpus['scanCorpusSha256'] == SCAN_SHA
    assert (corpus['oracleCommit'], corpus['oracleTree'], corpus['python'], corpus['regex']) == (
        '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f',
        '3.11.15', '2023.12.25')
    strips, cases = corpus['strips'], corpus['cases']
    assert len(strips) == 178 and len(cases) == 328
    assert [row['id'] for row in strips] == list(range(178))
    assert [row['id'] for row in cases] == list(range(328))
    assert sum(len(row['calls']) for row in strips + cases) == 2166
    assert sum(row['error'] == 'TypeError' for row in cases) == 100
    assert sum(row['error'] == 'ValueError' for row in cases) == 16
    valid = {row['id'] for row in scan['cases'] if row['error'] is None}
    assert len(valid) == 56
    for source_id in valid:
        derived = [row for row in cases if row['scanCase'] == source_id]
        assert {(row['short'], row['seeded']) for row in derived} == {
            (False, False), (False, True), (True, False), (True, True)}
    assert sum(row['scanCase'] is None for row in cases) == 104
    for row in strips:
        calls = row['calls']
        assert [(call['pattern'], call['flags']) for call in calls] == [
            ('stopWords', 0), ('leadingIn', 0), ('stopWords', 2)]
        assert all(call['operation'] == 'sub' and call['count'] == 0 for call in calls)
        assert calls[0]['source'] == row['source']
    assert len(corpus['grammar']) == 10
    rejected = [row for row in corpus['grammar'] if row['error'] is not None]
    assert rejected == [{'engine': 'python-re', 'error': 'error', 'flags': 0, 'pattern': 'leadingIn'}]
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'case-name-process.json').read_bytes()
    producer = ops / 'probe-case-name-process.py'
    scan_data = (fixtures / 'case-name-scan.json').read_bytes()
    corpus = validate(data, producer.read_bytes(), scan_data)
    if args.self_test:
        # The seal covers every byte, including failures' partial mutations,
        # complete traces, metadata attribute presence and source identities.
        mutations = []
        for key in ('strips', 'cases', 'grammar'):
            copy = json.loads(data)
            copy[key].pop()
            mutations.append(json.dumps(copy).encode())
        for key in ('helpersSha256', 'regexesSha256', 'scanCorpusSha256', 'producerSha256'):
            copy = json.loads(data)
            copy[key] = '0' * 64
            mutations.append(json.dumps(copy).encode())
        mutations.append(data + b' ')
        for mutated in mutations:
            try:
                validate(mutated, producer.read_bytes(), scan_data)
            except AssertionError:
                continue
            raise AssertionError('corrupted evidence was accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-case-name-process-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root),
                            '--fixture-root', str(fixtures), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'source replay differs from portable corpus'
    print(json.dumps({'ok': True, 'sourceEvidenceOnly': True, 'strips': len(corpus['strips']),
                      'cases': len(corpus['cases']), 'corruptionControls': 8 if args.self_test else 0,
                      'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
