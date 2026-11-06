#!/usr/bin/env python3
"""Verify sealed original HTML case-name observations; never target parity."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = 'e6231633d7a3d4115295517539aecda42045ce2a8253f565f9db86dacfcf1670'
PRODUCER_SHA = '5b6a1afeb93c9fb0543e498c17f357a315aa4459694d3a25994c575f5d0c5d68'
sha = lambda value: hashlib.sha256(value).hexdigest()


def validate(data, producer):
    assert sha(data) == CORPUS_SHA, 'HTML case-name corpus seal'
    assert sha(producer) == PRODUCER_SHA, 'HTML case-name producer seal'
    corpus = json.loads(data)
    assert corpus['schemaVersion'] == 'citation-html-case-names/v1'
    assert (corpus['oracleCommit'], corpus['oracleTree'], corpus['python']) == (
        '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '3.11.15')
    assert corpus['producerSha256'] == PRODUCER_SHA
    assert corpus['versions'] == {'eyecite': '2.7.6', 'lxml': '5.1.0', 'regex': '2023.12.25', 'fast-diff-match-patch': '2.0.1'}
    assert set(corpus['sources']) == {'helpers.py', 'models.py', 'tokenizers.py', 'utils.py', 'annotate.py', 'clean.py'}
    cases = corpus['cases']
    assert len(cases) == 128 and [row['id'] for row in cases] == list(range(128))
    assert sum(row['short'] for row in cases) == sum(row['seeded'] for row in cases) == 64
    assert sum(row['before'] != row['after'] for row in cases) == 88
    assert all(row['error'] is None for row in cases)
    branches = Counter(call['name'] for row in cases for call in row['calls'] if call['operation'] == 'branch')
    assert branches == {'_extract_short_citation_name': 64, '_extract_plaintiff_defendant_from_versus': 36,
                        '_extract_from_single_html_element': 26, '_extract_defendant_after_stopword': 8,
                        '_extract_from_separate_html_elements': 2}
    operations = Counter(call['operation'] for row in cases for call in row['calls'])
    assert operations == {'find': 142, 'branch': 136, 'clean': 116, 'convert': 90}
    for row in cases:
        assert row['words'][row['index']]['kind'] == 'CitationToken'
        for call in row['calls']:
            if call['operation'] == 'convert':
                assert len(call['tags']) == 1 and set(call['result']) == {'text', 'start', 'end'}
            elif call['operation'] == 'find':
                assert len(call['tags']) <= 1
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'html-case-names.json').read_bytes()
    producer = ops / 'probe-html-case-names.py'
    corpus = validate(data, producer.read_bytes())
    controls = 0
    if args.self_test:
        mutations = []
        for key in ['producerSha256', 'oracleCommit', 'licenseSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        for key in ['calls', 'words', 'tags']:
            changed = json.loads(data)
            changed['cases'][0][key].clear()
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['cases'][0]['after']['fullSpanStart'] = 999
        mutations.extend([json.dumps(changed).encode(), data + b' '])
        for changed in mutations:
            try:
                validate(changed, producer.read_bytes())
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('corrupted HTML case-name evidence accepted')
        try:
            validate(data, producer.read_bytes() + b' ')
        except AssertionError:
            controls += 1
        else:
            raise AssertionError('changed producer accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-html-case-names-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original HTML case-name replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'branches': 5,
                      'corruptionControls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
