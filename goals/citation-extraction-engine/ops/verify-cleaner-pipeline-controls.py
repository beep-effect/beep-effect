"""Validate complete source cleaner observations and reject portable corruption."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/cleaner-pipeline.json'
    operation = fixture.with_name('operation-cases.json')
    checker = Path(__file__).with_name('check-cleaner-pipeline.ts')
    producer = Path(__file__).with_name('probe-cleaner-pipeline.py')
    raw = fixture.read_bytes()
    data = json.loads(raw)
    sha = lambda value: hashlib.sha256(value).hexdigest()
    canonical = lambda value: json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')
    assert sha(raw) == '814406f61958dfe9d43b32cad562378372e07fa5f32f5e5a5437457e6ea5e3ff'
    assert data['producerSha256'] == sha(producer.read_bytes())
    assert data['operationCorpusSha256'] == sha(operation.read_bytes())
    artifacts = {item['sha256']: item['value'] for item in data['artifacts']}
    assert len(artifacts) == len(data['artifacts']) == 109 and list(artifacts) == sorted(artifacts)
    assert all(sha(canonical(value)) == digest for digest, value in artifacts.items())
    references = []
    def walk(value):
        if isinstance(value, list):
            for item in value: walk(item)
        elif isinstance(value, dict):
            for key, item in value.items():
                if key in ['text', 'message']:
                    assert isinstance(item, str) and item in artifacts
                    references.append(item)
                else: walk(item)
    walk(data['cases'])
    assert set(references) == set(artifacts)
    assert data['namedTextCount'] == 7 and data['namedSequenceCount'] == 156
    assert len(data['customScenes']) == len(set(data['customScenes'])) == 51
    names = [f'named:{text}:{sequence}' for text in range(7) for sequence in range(156)]
    names += [f'official:{index}' for index in range(12)] + data['customScenes']
    assert [row['name'] for row in data['cases']] == names and len(names) == len(set(names)) == 1155
    assert [row['family'] for row in data['cases']] == ['named'] * 1092 + ['official'] * 12 + ['custom'] * 51
    cases = {row['name']: row for row in data['cases']}
    assert cases['return-host']['runs'][0]['value']['kind'] == 'host'
    assert cases['return-none']['runs'][0]['value']['kind'] == 'none'
    assert cases['return-int']['runs'][0]['value'] == {'kind': 'int', 'value': '7'}
    assert cases['empty-text-subclass']['runs'][0]['sameAsInput']
    assert [event['kind'] for event in cases['unhashable-callable']['events']] == ['run-enter', 'run-complete']
    assert sum(event['kind'] == 'step-hash' for event in cases['dispatch:switch-hash']['events']) == 2
    assert [event['name'] for event in cases['dispatch:switch-hash']['events'] if event['kind'] == 'builtin-enter'] == ['underscores']
    assert [run['kind'] for run in cases['dispatch:delete-second-hash']['runs']] == ['failure', 'success']
    assert sum(event['kind'] == 'callback-enter' for event in cases['live-step-append']['events']) == 2
    assert not any(event['kind'] == 'callback-enter' and event['name'] == 'suffix' for event in cases['live-step-remove']['events'])
    assert cases['state-across-runs']['runs'][0]['value'] != cases['state-across-runs']['runs'][1]['value']
    assert any(item['resourceLimit'] for event in cases['resource-before-callback']['events'] if event['kind'] == 'html-diagnostics' for item in event['items'])
    assert any(event['kind'] == 'callback-enter' for event in cases['resource-before-callback']['events'])
    def invoke(path):
        return subprocess.run(['bun', 'run', str(checker), str(path), str(operation)], cwd=repo, capture_output=True, text=True, timeout=120)
    result = invoke(fixture)
    assert result.returncode == 0 and 'target contracts and parity remain open' in result.stdout
    def rebound(d):
        old = d['artifacts'][0]['sha256']
        value = 'changed source text'
        new = sha(canonical(value))
        d['artifacts'][0] = {'sha256': new, 'value': value}
        def replace(item):
            if isinstance(item, list): return [replace(value) for value in item]
            if isinstance(item, dict): return {key: new if key in ['text', 'message'] and value == old else replace(value) for key, value in item.items()}
            return item
        d['cases'] = replace(d['cases'])
        d['artifacts'].sort(key=lambda item: item['sha256'])
    mutations = {
        'schema': lambda d: d.update(schemaVersion='wrong'),
        'pin': lambda d: d.update(oracleCommit='a' * 40),
        'license': lambda d: d.update(licenseSha256='a' * 64),
        'producer': lambda d: d.update(producerSha256='a' * 64),
        'runtime': lambda d: d['versions'].update(lxml='wrong'),
        'scope': lambda d: d.update(scope='target parity passed'),
        'missing-case': lambda d: d['cases'].pop(),
        'duplicate-case': lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])),
        'case-order': lambda d: d['cases'].reverse(),
        'missing-scene': lambda d: d['customScenes'].pop(),
        'trace': lambda d: d['cases'][0]['events'].pop(),
        'outcome': lambda d: d['cases'][0]['runs'].clear(),
        'missing-artifact': lambda d: d['artifacts'].pop(),
        'changed-artifact': lambda d: d['artifacts'][0].update(value='changed'),
        'rebound-artifact': rebound,
        'hash-seed': lambda d: d.update(pythonHashSeed='1'),
    }
    with tempfile.TemporaryDirectory(prefix='citation-cleaner-controls-') as directory:
        altered = Path(directory) / 'altered.json'
        for name, mutate in mutations.items():
            broken = copy.deepcopy(data)
            mutate(broken)
            altered.write_text(json.dumps(broken, ensure_ascii=True, indent=2) + '\n')
            result = invoke(altered)
            assert result.returncode == 1 and 'Cleaner source corpus validation failed.' in result.stdout + result.stderr, name
            print('PASS ' + name, flush=True)
        if args.oracle_root:
            output = Path(directory) / 'replay.json'
            subprocess.run([sys.executable, str(producer), '--oracle-root', str(args.oracle_root), '--output', str(output)], cwd=repo, env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert output.read_bytes() == raw
            for source, digest in data['sources'].items():
                path = args.oracle_root / ('eyecite/' + source if source == 'clean.py' else source)
                assert sha(path.read_bytes()) == digest
    print('PASS 1155 source cases, 51 custom scenes, 109 immutable strings and 16 portable corruption controls; target pipeline remains open')


if __name__ == '__main__': main()
