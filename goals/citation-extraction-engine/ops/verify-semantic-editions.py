#!/usr/bin/env python3
"""Verify the complete runtime identity projection against sealed P0 evidence."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

MAPPING_SHA = 'b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5'
ARTIFACT_SHA = '9e3e5f9539e13f0cfce17489ece472686e11c9ccc446ba7d71319d8680c0dba8'


def verify(value, source, producer_sha):
    expected = []
    for row in source['editions']:
        family = {'case-reporter': 'case', 'law-publication': 'law',
                  'journal-publication': 'journal'}[row['kind']]
        binding = {'edition': row['artifactSha256'], 'family': family}
        if family == 'case':
            binding['reporterId'] = row['reporterId']
        expected.append(binding)
    assert len(expected) == len({row['edition'] for row in expected}) == 2533
    assert value == {
        'schemaVersion': 'citation-semantic-editions/v1',
        'mappingSha256': MAPPING_SHA,
        'vocabularyVersion': source['publicArtifactVersion'],
        'producerSha256': producer_sha,
        'editions': expected,
    }, 'runtime identities differ from the complete reviewed mapping'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    root = ops.parents[2]
    source_raw = (root/'packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json').read_bytes()
    assert hashlib.sha256(source_raw).hexdigest() == MAPPING_SHA
    source = json.loads(source_raw)
    raw = (root/'packages/law-practice/server/assets/citation/semantic-editions.json').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == ARTIFACT_SHA
    value = json.loads(raw)
    producer_sha = hashlib.sha256((ops/'export-semantic-editions.py').read_bytes()).hexdigest()
    verify(value, source, producer_sha)
    controls = 0
    if args.self_test:
        missing = copy.deepcopy(value)
        missing['editions'].pop()
        reordered = copy.deepcopy(value)
        reordered['editions'].reverse()
        changed = copy.deepcopy(value)
        changed['editions'][0]['reporterId'] = 'reporter:unreviewed'
        extra = copy.deepcopy(value)
        extra['editions'][0]['aliasGuess'] = True
        stale = copy.deepcopy(value)
        stale['producerSha256'] = '0'*64
        for invalid in (missing, reordered, changed, extra, stale):
            try:
                verify(invalid, source, producer_sha)
            except AssertionError:
                controls += 1
            else:
                raise AssertionError('corruption accepted')
        assert controls == 5
    print(json.dumps({'editions': len(value['editions']), 'corruptionControls': controls,
                      'artifactSha256': ARTIFACT_SHA}))


if __name__ == '__main__':
    main()
