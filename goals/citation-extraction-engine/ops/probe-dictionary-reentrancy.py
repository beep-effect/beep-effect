#!/usr/bin/env python3
"""Capture pinned general-key lookup restarts after direct equality mutation."""
import argparse
import hashlib
import importlib.metadata
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
    git = lambda *parts: subprocess.check_output(['git', '-C', str(root), *parts], text=True).strip()
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == ('04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == 'cpython' and sys.hash_info.width == 64
    assert os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    assert sha(args.cpython_root / 'dictobject.c') == '474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8'
    assert sha(args.cpython_root / 'LICENSE') == '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf'
    scenes = ['clear-in-get', 'remove-in-get', 'replace-in-get', 'update-in-get', 'insert-no-resize', 'resize-in-get', 'resize-in-set', 'clear-in-remove', 'mutate-raise', 'false-after-resize', 'replace-five', 'read-get', 'clear-refill']
    rows = []
    for name in scenes:
        trace, events = [], []
        initial = [0, 2, 3, 4, 5] if name in ['resize-in-get', 'resize-in-set', 'false-after-resize'] else [0] if name == 'insert-no-resize' else [0, 2]
        states = [{'objectId': i, 'hash': '7' if i < 2 else str(32 + i), 'token': 'same' if i < 2 else str(i)} for i in range(7)]
        if name == 'false-after-resize': states[1]['token'] = 'different'
        active, mutations = False, 0
        def snapshot(): return [{'objectId': key.slot, 'value': value} for key, value in table.items()]
        def action():
            nonlocal mutations
            mutations += 1
            if name in ['clear-in-get', 'clear-in-remove', 'mutate-raise', 'clear-refill']:
                table.clear()
                trace.append({'kind': 'clear'})
                if name == 'clear-refill':
                    table[keys[0]] = 99
                    trace.append({'kind': 'set', 'key': 0, 'value': 99})
                if name == 'mutate-raise': raise ValueError('comparison-stopped')
            elif name in ['remove-in-get', 'replace-in-get', 'resize-in-set', 'replace-five']:
                result = table.pop(keys[0], None)
                trace.append({'kind': 'remove', 'key': 0, 'result': result})
                if name in ['replace-in-get', 'replace-five']:
                    table[keys[0]] = 99 + mutations
                    trace.append({'kind': 'set', 'key': 0, 'value': 99 + mutations})
                elif name == 'resize-in-set':
                    table[keys[6]] = 106
                    trace.append({'kind': 'set', 'key': 6, 'value': 106})
            elif name == 'update-in-get':
                table[keys[0]] = 99
                trace.append({'kind': 'set', 'key': 0, 'value': 99})
            elif name in ['insert-no-resize', 'resize-in-get', 'false-after-resize']:
                key = 2 if name == 'insert-no-resize' else 6
                table[keys[key]] = 100 + key
                trace.append({'kind': 'set', 'key': key, 'value': 100 + key})
            elif name == 'read-get':
                trace.append({'kind': 'read', 'entries': snapshot()})
                trace.append({'kind': 'get', 'key': 0, 'result': table.get(keys[0])})
            else: raise AssertionError(name)
        class Key:
            def __init__(self, slot): self.slot = slot
            def __hash__(self): return int(states[self.slot]['hash'])
            def __eq__(self, other):
                trace.append({'kind': 'compare', 'left': self.slot, 'right': other.slot})
                if active and self.slot == 0 and other.slot == 1 and mutations < (5 if name == 'replace-five' else 1): action()
                return states[self.slot]['token'] == states[other.slot]['token']
        keys = [Key(i) for i in range(7)]
        table = {keys[i]: 100 + i for i in initial}
        assert not trace
        active = True
        operations = [{'kind': 'remove' if name == 'clear-in-remove' else 'set' if name == 'resize-in-set' else 'get', 'key': 1}, {'kind': 'get', 'key': 0}]
        if name == 'resize-in-set': operations[0]['value'] = 55
        for operation in operations:
            trace.clear()
            try:
                key = keys[operation['key']]
                if operation['kind'] == 'set':
                    table[key] = operation['value']
                    result = None
                elif operation['kind'] == 'remove': result = table.pop(key, None)
                else: result = table.get(key)
                outcome = {'status': 'value', 'result': result}
            except ValueError: outcome = {'status': 'error', 'kind': 'ValueError'}
            events.append({'operation': operation, 'outcome': outcome, 'trace': list(trace), 'entries': snapshot()})
        rows.append({'name': name, 'initial': initial, 'keys': states, 'events': events})
    assert not git('status', '--porcelain')
    report = {'schemaVersion': 'citation-dictionary-reentrancy/v1', 'scope': 'direct comparison mutation in combined-general tables; Unicode/split tables, forked callbacks and complete engine proof remain open', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'), 'python': '3.11.15', 'pythonHashSeed': '0', 'hashWidth': 64, 'producerSha256': sha(Path(__file__)), 'dictionarySourceSha256': sha(args.cpython_root / 'dictobject.c'), 'cpythonLicenseSha256': sha(args.cpython_root / 'LICENSE'), 'oracleLicenseSha256': sha(root / 'LICENSE'), 'lockSha256': sha(root / 'uv.lock'), 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'reporters-db', 'courts-db']}, 'cases': rows}
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Captured {len(rows)} direct comparison-mutation histories / {sum(len(row["events"]) for row in rows)} operation outcomes')


if __name__ == '__main__': main()
