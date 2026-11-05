#!/usr/bin/env python3
"""Capture pinned combined Unicode/general dictionary transitions and mutation."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--cpython-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *a: subprocess.check_output(['git', '-C', str(root), *a], text=True).strip()
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == ('04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == 'cpython'
    assert os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    assert sys.hash_info.width == 64 and sys.hash_info.algorithm == 'siphash13'
    assert sha(args.cpython_root / 'dictobject.c') == '474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8'
    assert sha(args.cpython_root / 'LICENSE') == '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf'
    rows = []
    scenes = ['exact-text', 'host-hit', 'host-miss', 'host-set-hit', 'host-set-miss', 'delete-in-equality', 'update-in-equality', 'clear-refill', 'convert-in-equality', 'delete-raise', 'subclass-hit', 'subclass-miss', 'clear-after-general']
    for name in scenes:
        trace, events, changed = [], [], False
        texts = ['html', 'inline_whitespace', 'all_whitespace', 'underscores', 'xml']
        descriptors = [{'objectId': i, 'kind': 'text', 'text': t, 'hash': str(hash(t)), 'token': t} for i, t in enumerate(texts)]
        descriptors += [
            {'objectId': 5, 'kind': 'subclass' if name.startswith('subclass') else 'host', 'text': 'html', 'hash': str(hash('html')), 'token': 'missing' if name in ['host-miss', 'host-set-miss', 'subclass-miss'] else 'html'},
            {'objectId': 6, 'kind': 'host', 'text': '', 'hash': str(hash('html')), 'token': 'other'},
            {'objectId': 7, 'kind': 'text', 'text': 'html', 'hash': str(hash('html')), 'token': 'html'},
        ]
        def slot(value):
            for index, key in enumerate(keys):
                if key is value: return index
            raise AssertionError('unowned source key')
        def snapshot(): return [{'objectId': slot(key), 'value': value} for key, value in table.items()]
        def action():
            nonlocal changed
            if changed: return
            changed = True
            if name in ['delete-in-equality', 'delete-raise']:
                result = table.pop(keys[0], None)
                trace.append({'kind': 'remove', 'key': 0, 'result': result})
                if name == 'delete-raise': raise ValueError('comparison-stopped')
            elif name == 'update-in-equality':
                table[keys[0]] = 99
                trace.append({'kind': 'set', 'key': 0, 'value': 99})
            elif name == 'clear-refill':
                table.clear(); trace.append({'kind': 'clear'})
                for i in range(5):
                    table[keys[i]] = 200 + i
                    trace.append({'kind': 'set', 'key': i, 'value': 200 + i})
            elif name == 'convert-in-equality':
                table[keys[6]] = 106
                trace.append({'kind': 'set', 'key': 6, 'value': 106})
        def compare(left, other):
            right = slot(other)
            trace.append({'kind': 'compare', 'left': left, 'right': right})
            if left == 5: action()
            return descriptors[left]['token'] == descriptors[right]['token']
        class Host:
            def __init__(self, i): self.i = i
            def __hash__(self):
                trace.append({'kind': 'hash', 'key': self.i})
                return int(descriptors[self.i]['hash'])
            def __eq__(self, other): return compare(self.i, other)
        class Text(str):
            def __new__(cls, i):
                obj = super().__new__(cls, descriptors[i]['text']); obj.i = i; return obj
            def __hash__(self):
                trace.append({'kind': 'hash', 'key': self.i})
                return int(descriptors[self.i]['hash'])
            def __eq__(self, other): return compare(self.i, other)
        keys = [''.join(['', t]) for t in texts]
        keys += [Text(5) if name.startswith('subclass') else Host(5), Host(6), ''.join(['', 'html'])]
        assert keys[0] is not keys[7]
        table = {keys[i]: 100 + i for i in range(5)}
        assert not trace
        operations = [{'kind': 'get', 'key': 7 if name == 'exact-text' else 5}]
        if name in ['host-set-hit', 'host-set-miss', 'clear-after-general']:
            operations = [{'kind': 'set', 'key': 5, 'value': 55}]
        if name == 'clear-after-general':
            operations += [{'kind': 'clear'}, {'kind': 'set', 'key': 0, 'value': 300}, {'kind': 'get', 'key': 7}]
        else:
            operations += [{'kind': 'get', 'key': 7}, {'kind': 'get', 'key': 6}]
        for operation in operations:
            trace.clear()
            try:
                if operation['kind'] == 'set':
                    table[keys[operation['key']]] = operation['value']; result = None
                elif operation['kind'] == 'clear': table.clear(); result = None
                else: result = table.get(keys[operation['key']])
                outcome = {'status': 'value', 'result': result}
            except ValueError: outcome = {'status': 'error', 'kind': 'ValueError'}
            events.append({'operation': operation, 'outcome': outcome, 'trace': list(trace), 'entries': snapshot()})
        rows.append({'name': name, 'keys': descriptors, 'initial': list(range(5)), 'events': events})
    assert not git('status', '--porcelain')
    report = {'schemaVersion': 'citation-unicode-dictionary/v1', 'scope': 'combined Unicode/general-key transitions; source hash production, split tables and complete cleaner registry remain open', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'), 'python': '3.11.15', 'pythonHashSeed': '0', 'hashWidth': 64, 'hashAlgorithm': 'siphash13', 'producerSha256': sha(Path(__file__)), 'dictionarySourceSha256': sha(args.cpython_root / 'dictobject.c'), 'cpythonLicenseSha256': sha(args.cpython_root / 'LICENSE'), 'oracleLicenseSha256': sha(root / 'LICENSE'), 'cases': rows}
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Captured {len(rows)} Unicode/general histories / {sum(len(r["events"]) for r in rows)} outcomes')


if __name__ == '__main__': main()
