#!/usr/bin/env python3
"""Project authenticated eyecite helper configuration without fixture cases."""
import argparse
import base64
import hashlib
import json
from pathlib import Path

ORACLE = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
INPUTS = {
    'post-case-metadata': 'cbaab9900587e97522d7a442326ae4604cbed97bc655204cf919baa996d6b48a',
    'pre-case-metadata': '6cfd521369b960f677231e9e5c9ca2981c6dc0ca6c0f7e9edf551f01c3dda4bd',
    'case-name-scan': '9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553',
    'case-name-process-patterns': '3786b74826d9b3f3b88bf03d673da59f43abe4a54ee81f3615fe8871926d7a87',
    'stop-word-patterns': '98bdf393eb38077254b0a241767ef935ee4adaf04184c0d29b08565b1c5fa1ae',
    'html-case-name-pattern': '4fd9710564c5d2ee74e298f3db7f1f4d08bb3d9543ab598afff340323a9dc0c4',
    'law-metadata': '098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea',
    'journal-metadata': '0ed802a638ba04073c4410ee826a40e463cd1c22b31cb49b895339f232a5aa6f',
    'pin-extraction': '0874170bf716c53337fbb17f75819b2af7ed890b999de4d86b0b585902c82f75',
    'reference-token': '86dac62c3e85b1de5327dcafd03f4ff3e241b1d013bda00542df149c6867c0b7',
    'reference-template': '25b2e91fac26f724a24f9822d299169cdc2dde8cd55cb91f1210b01f97ff9e68',
    'generated-references': 'a741045d3c71ca4437c54e3af1781063c5ec66c091bfdfc4a4dbb2abce5d4006',
    'html-discovery-patterns': '95830f0e880b234b2b5ada632e94a1b88abc67c69d825148226dcdcea8b8a230',
}


def native_json(value):
    """Use the Base64 byte representation derived by Effect's JSON codec."""
    if isinstance(value, list):
        return [native_json(item) for item in value]
    if isinstance(value, dict):
        if set(value) == {'width', 'bytes'}:
            assert value['width'] in (1, 2, 4)
            raw = bytes.fromhex(value['bytes'])
            assert len(raw) % value['width'] == 0
            return {'width': value['width'], 'bytes': base64.b64encode(raw).decode('ascii')}
        return {key: native_json(item) for key, item in value.items()}
    return value


def project(root):
    sources = {}
    for name, seal in INPUTS.items():
        raw = (root/(name+'.json')).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == seal, f'source seal: {name}'
        source = json.loads(raw)
        assert source['oracleCommit'] == ORACLE, f'source pin: {name}'
        sources[name] = source
    configs = {name: source['configuration'] for name, source in sources.items() if 'configuration' in source}
    temporal = ['post-case-metadata', 'pre-case-metadata', 'law-metadata', 'journal-metadata', 'pin-extraction']
    # Captured fixture dates are evidence, never a production installation clock.
    assert len({configs[name]['highestValidYear'] for name in temporal}) == 1
    for name in temporal:
        del configs[name]['highestValidYear']
    names = {
        'plain': {'scan': configs['case-name-scan'],
                  'process': {**configs['case-name-process-patterns'], 'cleaner': configs['stop-word-patterns']}},
        'html': {**configs['html-case-name-pattern'], 'cleaner': configs['stop-word-patterns']},
    }
    value = {
        'schemaVersion': 'citation-helper-configurations/v1', 'oracleCommit': ORACLE,
        'producerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'inputs': {name+'.json': seal for name, seal in INPUTS.items()},
        'case': {'post': configs['post-case-metadata'], 'pre': configs['pre-case-metadata'], 'names': names},
        'law': configs['law-metadata'], 'journal': configs['journal-metadata'],
        'pin': configs['pin-extraction'], 'supra': configs['reference-token']['supra'],
        'generated': {'patterns': sources['reference-template']['patterns'],
                      'disallowedNames': sources['generated-references']['disallowedNames']},
        'discovery': configs['html-discovery-patterns'],
    }
    return native_json(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    value = project(repo/'packages/law-practice/use-cases/test/fixtures/eyecite')
    raw = (json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'))+'\n').encode()
    target = args.output or repo/'packages/law-practice/server/assets/citation/helper-configurations.data'
    if args.check:
        assert target.read_bytes() == raw, 'production helper projection differs'
        loader = (repo/'packages/law-practice/server/src/internal/Citation/HelperConfigurations.ts').read_text()
        assert hashlib.sha256(raw).hexdigest() in loader, 'runtime digest stale'
        assert str(len(raw)) in loader, 'runtime length stale'
    else:
        target.write_bytes(raw)
    print(json.dumps({'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'sources': len(INPUTS)}))


if __name__ == '__main__':
    main()
