#!/usr/bin/env python3
"""Seal original HTML/plain caller selection; optional exact pinned replay."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = '20690a9a72d7206b50c8f039edd5fe531262d3bf079035c8fcb2367e6aadb29b'
PRODUCER_SHA = 'd4526db5c87f0343d50f08872871ae435761ca5c939b379b36e988b10651f015'
HTML_SHA = 'e6231633d7a3d4115295517539aecda42045ce2a8253f565f9db86dacfcf1670'
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, producer, html):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'selection evidence seals'
    assert sha(html) == HTML_SHA, 'original HTML dependency seal'
    corpus, dependency = json.loads(data), json.loads(html)
    assert corpus['schemaVersion'] == 'citation-case-name-selection/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA and corpus['htmlSha256'] == HTML_SHA
    assert corpus['oracleCommit'] == dependency['oracleCommit'] and corpus['oracleTree'] == dependency['oracleTree']
    assert corpus['python'] == '3.11.15'
    assert corpus['versions']['eyecite'] == '2.7.6' and corpus['versions']['regex'] == '2023.12.25'
    rows, documents = corpus['cases'], corpus['documents']
    assert len(rows) == 272 and len(documents) == 68
    assert [row['id'] for row in rows] == list(range(272))
    assert sum('html' in row['trace'] for row in rows) == 136
    assert sum('plain' in row['trace'] for row in rows) == 157
    assert sum(len(row['regexCalls']) for row in rows) == 2621
    empty_assignments = retained_empty = retained_nonempty = 0
    for row in rows:
        document = documents[row['document']]
        assert document['short'] == (row['mode'] == 'Short')
        assert row['after']['span'] == row['before']['span']
        assert row['after']['fullSpanEnd'] == row['before']['fullSpanEnd']
        if not row['hasMarkup']:
            assert row['trace'] == ['plain']
            continue
        field = 'antecedent_guess' if row['mode'] == 'Short' else 'defendant'
        before, after = row['before']['metadata'][field], row['after']['metadata'][field]
        assert row['trace'] in [['html'], ['html', 'plain']]
        if row['trace'] == ['html']:
            assert after is not None
            empty_assignments += after['bytes'] == '' and before is None
            retained_empty += after == before and before is not None and before['bytes'] == ''
            retained_nonempty += after == before and before is not None and before['bytes'] != ''
    assert empty_assignments and retained_empty and retained_nonempty
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'case-name-selection.json').read_bytes()
    producer = ops / 'probe-case-name-selection.py'
    html = (fixtures / 'html-case-names.json').read_bytes()
    corpus = validate(data, producer.read_bytes(), html)
    controls = 0
    if args.self_test:
        mutations = []
        for key in ['producerSha256', 'htmlSha256', 'licenseSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['cases'][268]['trace'] = ['html', 'plain']
        mutations.extend([json.dumps(changed).encode(), data + b' '])
        for changed in mutations:
            try:
                validate(changed, producer.read_bytes(), html)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed original caller evidence accepted')
        for changed_producer, changed_html in [(producer.read_bytes() + b' ', html), (producer.read_bytes(), html + b' ')]:
            try:
                validate(data, changed_producer, changed_html)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed source dependency accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-name-selection-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original caller replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'controls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
