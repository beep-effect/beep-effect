#!/usr/bin/env python3
"""Seal original short/Id./supra/unknown constructor evidence and supra profile."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CORPUS_SHA = '86dac62c3e85b1de5327dcafd03f4ff3e241b1d013bda00542df149c6867c0b7'
PRODUCER_SHA = '3347d0f85ecda21ca104844677c6a2a8a8f7753c07ab0da8174da0e8067ecbf5'
NORMALIZER_SHA = '9a8176ca6d55de38ff94731a1c532b9d4788651bcdd497c8d308b8520bae15e8'
PROFILE_SHA = 'c86c958858149b6b74f8b8b594e72123e65da2b1a71eeaac1ab8a806452834a1'
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, producer, normalizer, profile):
    assert sha(data) == CORPUS_SHA and sha(producer) == PRODUCER_SHA, 'reference constructor source seals'
    assert sha(normalizer) == NORMALIZER_SHA and sha(profile) == PROFILE_SHA, 'source profile dependency seals'
    corpus = json.loads(data)
    assert corpus['schemaVersion'] == 'citation-reference-token/v1'
    assert corpus['producerSha256'] == PRODUCER_SHA and corpus['normalizerSha256'] == NORMALIZER_SHA
    assert corpus['profileProducerSha256'] == PROFILE_SHA
    assert corpus['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert corpus['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert corpus['python'] == '3.11.15' and corpus['versions']['regex'] == '2023.12.25'
    pattern = corpus['configuration']['supra']['pattern']
    assert sha(bytes([pattern['width']]) + bytes.fromhex(pattern['bytes'])) == corpus['supraPatternSha256'] == '5e82e531e754da20a304f03d9a0ff46f1e5c89e30c9f2e661f8ec196e584e30d'
    bindings = corpus['configuration']['supra']['bindings']
    assert len(bindings) == 2
    for row in bindings:
        assert row['flags'] == 64 and row['profile'] == {'groups': 2, 'names': {'antecedent': 1, 'volume': 2}, 'minimumWidthFloor': 2, 'repeatedCaptures': False, 'nullableMultiRepeat': False}
    rows = corpus['cases']
    assert len(rows) == 24 and [row['id'] for row in rows] == list(range(24))
    assert len(corpus['editionBindings']) == 2
    assert sum(len(row['calls']) for row in rows) == 86
    assert sum(row['hasMarkup'] for row in rows) == 2
    assert len(corpus['noTargetDocuments']) == 1 and corpus['noTargetDocuments'][0]['scene'] == 2
    assert corpus['noTargetDocuments'][0]['tokenKinds'] == []
    kinds = {'CitationToken': 'ShortCaseCitation', 'IdToken': 'IdCitation', 'SupraToken': 'SupraCitation', 'SectionToken': 'UnknownCitation'}
    assert {kind: sum(row['token']['kind'] == kind for row in rows) for kind in kinds} == {'CitationToken': 7, 'IdToken': 7, 'SupraToken': 7, 'SectionToken': 3}
    for row in rows:
        assert row['error'] is None
        token, expected = row['token'], row['expected']
        word = row['words'][row['index']]
        assert token['kind'] == word['kind'] and token['start'] == word['start']
        assert token['data'] == word['data'] and token['groups'] == word['groups']
        assert expected['kind'] == kinds[token['kind']]
        assert expected['span'] == [token['start'], token['end'] if expected['spanEnd'] is None else expected['spanEnd']]
        assert expected['fullSpan'] == [expected['span'][0] if expected['fullSpanStart'] is None else expected['fullSpanStart'], expected['span'][1] if expected['fullSpanEnd'] is None else expected['fullSpanEnd']]
        assert ('year' in expected) == (token['kind'] == 'CitationToken')
        assert all(name in ['search', 'match', 'sub', 'split'] for name in row['calls'])
    assert rows[6]['expected']['metadata']['plaintiff']['bytes'] == '466f6f'
    assert 'plaintiff' not in rows[0]['expected']['metadata']
    return corpus


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=Path)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixtures = args.fixture_root or ops.parents[2] / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    data = (fixtures / 'reference-token.json').read_bytes()
    paths = [ops / name for name in ['probe-reference-token.py', 'export-operations.py', 'probe-regex-verbose.py']]
    dependencies = [path.read_bytes() for path in paths]
    corpus = validate(data, *dependencies)
    controls = 0
    if args.self_test:
        mutations = []
        for key in ['producerSha256', 'profileProducerSha256', 'licenseSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        del changed['cases'][6]['expected']['metadata']['plaintiff']
        mutations.extend([json.dumps(changed).encode(), data + b' '])
        for changed in mutations:
            try:
                validate(changed, *dependencies)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed original reference evidence accepted')
        for index in range(3):
            changed = list(dependencies)
            changed[index] += b' '
            try:
                validate(data, *changed)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed source profile dependency accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-reference-token-') as temp:
            output = Path(temp) / 'replayed.json'
            subprocess.run([sys.executable, str(paths[0]), '--oracle-root', str(args.oracle_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'original reference-token replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(corpus['cases']), 'controls': controls, 'oracleReplayed': args.oracle_root is not None}))


if __name__ == '__main__':
    main()
