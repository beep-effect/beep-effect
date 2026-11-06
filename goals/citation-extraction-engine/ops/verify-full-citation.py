#!/usr/bin/env python3
"""Seal actual full-citation construction; optional exact pinned replay."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = 'a303ae5063b50d3af5344aefd0e43826412e932265778f7a46936af058c93b1c'
PRODUCER_SHA = '7aab295e609ecdd11254d379b57129297185d666e7c843ac6bcf3044133be453'
NORMALIZER_SHA = '9a8176ca6d55de38ff94731a1c532b9d4788651bcdd497c8d308b8520bae15e8'
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, producer, normalizer):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'full-citation source seals'
    assert sha(normalizer) == NORMALIZER_SHA, 'original edition normalizer seal'
    corpus = json.loads(data)
    assert corpus['schemaVersion'] == 'citation-full-extraction/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA and corpus['normalizerSha256'] == NORMALIZER_SHA
    assert corpus['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert corpus['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert corpus['python'] == '3.11.15' and corpus['versions']['eyecite'] == '2.7.6'
    assert corpus['versions']['regex'] == '2023.12.25'
    rows, bindings = corpus['cases'], corpus['bindings']
    assert len(rows) == 15 and len(bindings) == 7
    assert [row['id'] for row in rows] == list(range(15))
    assert [row['id'] for row in bindings] == list(range(7))
    assert len({row['ref'] for row in bindings}) == 7
    assert sum(len(row['calls']) for row in rows) == 91
    assert {name: sum(row['expected']['kind'] == name for row in rows) for name in ['FullCaseCitation', 'FullLawCitation', 'FullJournalCitation']} == {'FullCaseCitation': 7, 'FullLawCitation': 5, 'FullJournalCitation': 3}
    for row in rows:
        token, expected = row['token'], row['expected']
        assert token['kind'] == 'CitationToken' and token['short'] is False
        word = row['words'][row['index']]
        assert word['kind'] == token['kind'] and word['data'] == token['data']
        assert word['groups'] == token['groups'] and word['start'] == token['start']
        sources = {bindings[i]['source'] for i in token['exact'] or token['variation']}
        selected = next(name for source, name in [('reporters', 'FullCaseCitation'), ('laws', 'FullLawCitation'), ('journals', 'FullJournalCitation')] if source in sources)
        assert expected['kind'] == selected
        assert expected['span'] == [token['start'], token['end']]
        assert expected['fullSpan'] == [token['start'] if expected['fullSpanStart'] is None else expected['fullSpanStart'], token['end'] if expected['fullSpanEnd'] is None else expected['fullSpanEnd']]
        assert expected['editionGuess'] is None or expected['editionGuess'] in {b['ref'] for b in bindings}
        assert all(call in ['search', 'match', 'sub', 'split'] for call in row['calls'])
        assert isinstance(row['courtRegexCalls'], int) and row['courtRegexCalls'] >= 0
    assert rows[6]['expected']['kind'] == 'FullLawCitation'
    assert rows[9]['expected']['kind'] == 'FullLawCitation'
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'full-extraction.json').read_bytes()
    producer, normalizer = ops / 'probe-full-citation.py', ops / 'export-operations.py'
    corpus = validate(data, producer.read_bytes(), normalizer.read_bytes())
    controls = 0
    if args.self_test:
        mutations = []
        for key in ['producerSha256', 'normalizerSha256', 'licenseSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['cases'][9]['expected']['kind'] = 'FullCaseCitation'
        mutations.extend([json.dumps(changed).encode(), data + b' '])
        for changed in mutations:
            try:
                validate(changed, producer.read_bytes(), normalizer.read_bytes())
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed original full-citation evidence accepted')
        for changed_producer, changed_normalizer in [(producer.read_bytes() + b' ', normalizer.read_bytes()), (producer.read_bytes(), normalizer.read_bytes() + b' ')]:
            try:
                validate(data, changed_producer, changed_normalizer)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed source dependency accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-full-extraction-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original full-citation replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'controls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
