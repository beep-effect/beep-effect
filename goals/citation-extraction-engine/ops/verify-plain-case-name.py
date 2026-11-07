#!/usr/bin/env python3
"""Seal original whole plain-name helper calls; optional pinned replay."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = 'a63b136ccfac79f2dbf0c3ca38797d40cdb2d8296eb06b035ac676ed563ba1a2'
PRODUCER_SHA = '3305e1ee61adebca9f177becca49ace82b89e096268a9bad017db9548d839469'
SCAN_SHA = '9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553'
sha = lambda value: hashlib.sha256(value).hexdigest()


def validate(data, producer, scan_data):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'plain case-name evidence seals'
    assert sha(scan_data) == SCAN_SHA, 'original scan dependency seal'
    corpus, scan = json.loads(data), json.loads(scan_data)
    assert corpus['schemaVersion'] == 'citation-plain-case-name/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA and corpus['scanSha256'] == SCAN_SHA
    assert corpus['oracleCommit'] == scan['oracleCommit'] and corpus['oracleTree'] == scan['oracleTree']
    assert corpus['sources']['helpers.py'] == scan['helpersSha256']
    assert corpus['python'] == '3.11.15' and corpus['regex'] == '2023.12.25'
    cases = corpus['cases']
    assert len(cases) == 256 and [row['id'] for row in cases] == list(range(256))
    assert sum(row['processed'] for row in cases) == 120
    assert sum(row['error'] is not None for row in cases) == 32
    assert sum(len(row['regexCalls']) for row in cases) == 1912
    for source in scan['cases']:
        rows = [row for row in cases if row['scanCase'] == source['id']]
        assert {(row['short'], row['seeded']) for row in rows} == {(False, False), (False, True), (True, False), (True, True)}
        candidate = source['state']['candidateCaseName']
        expected = source['error'] is None and candidate is not None and candidate['bytes'] != ''
        for row in rows:
            assert row['processed'] == expected
            assert row['error'] == source['error']
            if not expected:
                assert row['after'] == row['before']
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'plain-case-name.json').read_bytes()
    producer = ops / 'probe-plain-case-name.py'
    scan_data = (fixtures / 'case-name-scan.json').read_bytes()
    corpus = validate(data, producer.read_bytes(), scan_data)
    controls = 0
    if args.self_test:
        mutations = []
        for key in ['producerSha256', 'scanSha256', 'licenseSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['cases'][0]['processed'] = True
        mutations.extend([json.dumps(changed).encode(), data + b' '])
        for changed in mutations:
            try:
                validate(changed, producer.read_bytes(), scan_data)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed whole-helper evidence accepted')
        for changed_producer, changed_scan in [(producer.read_bytes() + b' ', scan_data), (producer.read_bytes(), scan_data + b' ')]:
            try:
                validate(data, changed_producer, changed_scan)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed source dependency accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-plain-name-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original whole-helper replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'controls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
