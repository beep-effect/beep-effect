#!/usr/bin/env python3
"""Project sealed oracle installation data into the production parser catalog."""
import argparse
import hashlib
import json
from pathlib import Path

CANONICAL_SHA = '7f624597ee68176326cd8252a9858acd48faa7be27f1dc3e986119140a4080f3'
PAYLOAD_SHA = '8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c'
ORACLE = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'


def read_sealed(root, name, expected):
    raw = (root/name).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected, f'source seal: {name}'
    value = json.loads(raw)
    pin = value['commit'] if name == 'operation-cases.json' else value['oracleCommit']
    assert pin == ORACLE, f'source pin: {name}'
    return value


def project(root):
    canonical = read_sealed(root, 'canonical-tokenizer.json', CANONICAL_SHA)
    sources = {name: read_sealed(root, name, digest) for name, digest in canonical['inputs'].items()}
    artifacts = sources['operation-cases.json']['artifacts']
    payload = artifacts[PAYLOAD_SHA]['payload']
    assert hashlib.sha256(payload.encode()).hexdigest() == PAYLOAD_SHA
    compact = sources['extractor-recipes.json']
    recipes = []
    for ordinal, (pattern_sha, extra_index) in enumerate(compact['recipes']):
        flags, kind, exact, variation, short = compact['extras'][extra_index]
        recipes.append({'id': ordinal, 'patternSha256': pattern_sha, 'flags': flags,
                        'kind': kind, 'exact': [compact['editionRefs'][i] for i in exact],
                        'variation': [compact['editionRefs'][i] for i in variation], 'short': short})
    facts = sources['regex-program-facts.json']
    indices = facts['artifactDescriptorIndices'][PAYLOAD_SHA]
    descriptors = [facts['descriptors'][i] for i in dict.fromkeys(indices)]
    frozen = {'reporters': [], 'editions': []}
    for ref, row in artifacts.items():
        if row['kind'] != 'model-value':
            continue
        kind = json.loads(row['payload'])['pythonType']
        if kind == 'eyecite.models.Reporter': key = 'reporters'
        elif kind == 'eyecite.models.Edition': key = 'editions'
        else: continue
        assert hashlib.sha256(row['payload'].encode()).hexdigest() == ref
        frozen[key].append({'ref': ref, 'payload': row['payload']})
    assert len(recipes) == len(indices) == 6805
    assert len(frozen['reporters']) == 2430
    assert len(frozen['editions']) == len(canonical['editions']) == 2533
    metadata = {'recipes': recipes, 'hashes': sources['extractor-selection.json']['canonical']['hashes'],
                'descriptors': descriptors, 'editions': canonical['editions']}
    assert len(metadata['hashes']) == 6805
    return {'schemaVersion': 'citation-parser-catalog/v1', 'oracleCommit': ORACLE,
            'oracleTree': canonical['oracleTree'], 'python': canonical['python'],
            'hashSeed': canonical['hashSeed'], 'hashProfile': canonical['hashProfile'],
            'producerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'inputs': {'canonical-tokenizer.json': CANONICAL_SHA, **canonical['inputs']},
            'payload': payload, 'metadata': metadata, 'frozen': frozen}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    value = project(repo/'packages/law-practice/use-cases/test/fixtures/eyecite')
    raw = (json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'))+'\n').encode()
    target = args.output or repo/'packages/law-practice/server/assets/citation/parser-catalog.data'
    if args.check:
        assert target.read_bytes() == raw, 'runtime projection differs from complete sealed source'
        loader = (repo/'packages/law-practice/server/src/internal/Citation/ParserCatalog.ts').read_text()
        assert hashlib.sha256(raw).hexdigest() in loader, 'runtime byte seal stale'
        assert str(len(raw)) in loader, 'runtime byte ceiling stale'
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    print(json.dumps({'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                      'extractors': len(value['metadata']['recipes']),
                      'descriptors': len(value['metadata']['descriptors']),
                      'reporters': len(value['frozen']['reporters']), 'editions': len(value['frozen']['editions'])}))


if __name__ == '__main__':
    main()
