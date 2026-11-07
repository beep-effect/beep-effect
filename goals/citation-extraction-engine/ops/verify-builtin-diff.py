#!/usr/bin/env python3
"""Seal original builtin-diff evidence and optionally replay the pinned source."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

CORPUS_SHA = '3b8cb9c95fd5b9525c585b9d05ab2e10cdb6b6c774c91dbfcae2100307c6bc11'
PRODUCER_SHA = 'cacfe9e3bda0d6341317dcbdba03182eb89399d09314877a7a3652440f3e3b92'
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, producer):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'builtin evidence seal'
    report = json.loads(data)
    assert report['schemaVersion'] == 'citation-builtin-diff/v1'
    assert report['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert report['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert report['python'] == '3.11.15' and report['producerSha256'] == PRODUCER_SHA
    assert report['difflibSha256'] == '0c6afc23568d55b3e9ac914f9c5361e3033e778aa5b58d3cc82835fc5c638679'
    assert [row['id'] for row in report['cases']] == list(range(4231))
    assert [row['id'] for row in report['annotations']] == list(range(10))
    assert sum(row['origin'] == 'short-binary' for row in report['cases']) == 3969
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--fixture', type=Path)
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    repository = ops.parents[2]
    fixture = args.fixture if args.fixture is not None else repository / 'packages/law-practice/use-cases/test/fixtures/eyecite/builtin-diff.json'
    probe = ops / 'probe-builtin-diff.py'
    data, producer = fixture.read_bytes(), probe.read_bytes()
    report = validate(data, producer)
    controls = 0
    if args.self_test:
        changes = [data + b' ']
        for key in ['oracleCommit', 'difflibSha256', 'producerSha256']:
            altered = json.loads(data)
            altered[key] = 'changed'
            changes.append(json.dumps(altered).encode())
        for key in ['cases', 'annotations']:
            altered = json.loads(data)
            altered[key].pop()
            changes.append(json.dumps(altered).encode())
        altered = json.loads(data)
        altered['annotations'][1]['useDmp'] = True
        changes.append(json.dumps(altered).encode())
        for changed in changes:
            try:
                validate(changed, producer)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed builtin source evidence accepted')
        try:
            validate(data, producer + b' ')
        except AssertionError:
            controls += 1
        else:
            raise AssertionError('changed producer accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-builtin-diff-') as directory:
            output = Path(directory) / 'replayed.json'
            subprocess.run([str(args.oracle_root / '.venv/bin/python'), str(probe), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True, cwd=repository)
            assert output.read_bytes() == data, 'original builtin replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(report['cases']), 'annotations': len(report['annotations']), 'controls': controls, 'sourceReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
