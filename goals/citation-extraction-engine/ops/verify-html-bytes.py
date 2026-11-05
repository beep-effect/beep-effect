#!/usr/bin/env python3
"""Seal complete byte/non-text source evidence and reject corrupted observations."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[3]
FIXTURE = REPO / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-bytes.json'
PRODUCER = Path(__file__).with_name('probe-html-bytes.py')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(data):
    return sha(json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode('ascii'))


def check(data):
    assert canonical(data) == '554c6466dbdcee8a2a9745110cc02140bbcf6e1e756a45405799937eb5383997'
    assert data['schemaVersion'] == 'citation-html-bytes/v1'
    assert data['scope'] == 'source byte parsing and non-text dispatch only; target composition remains separate'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['converter']['version'] == '1.17' and data['converter']['localeCharset'] == 'UTF-8'
    assert len(data['converter']['encodingGroups']) == 111 and sum(map(len, data['converter']['encodingGroups'])) == 347
    inventory = b''.join(b''.join(n.encode('ascii') + b'\0' for n in group) + b'\0' for group in data['converter']['encodingGroups'])
    assert sha(inventory) == data['converter']['inventorySha256']
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0'
    assert data['versions'] == {'eyecite': '2.7.6', 'lxml': '5.1.0'}
    assert data['libxmlRuntime'] == [2, 12, 3]
    assert data['cleanSourceSha256'] == 'b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db'
    assert data['lxmlHtmlSourceSha256'] == '34e708f580638899be495891e5d4ee6dbd391e2af737bef53bc991eb10971748'
    assert data['licenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['lockSha256'] == '864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a'
    assert data['producerSha256'] == sha(PRODUCER.read_bytes())
    values = {}
    for row in data['artifacts']:
        assert row['sha256'] not in values
        assert row['sha256'] == sha(json.dumps(row['value'], ensure_ascii=True, separators=(',', ':')).encode('ascii'))
        values[row['sha256']] = row['value']
    assert len(values) == 488
    used = set()
    def outcome(row, allowed):
        assert row['type'] in allowed
        if row['kind'] == 'success':
            assert row['type'] == 'builtins.str'; used.add(row['text'])
        else:
            assert row['kind'] == 'error' and row['type'] != 'builtins.str'; used.add(row['message'])
    names = set()
    for row in data['cases']:
        assert row['name'] not in names; names.add(row['name'])
        raw = bytes.fromhex(row['hex']); assert raw.hex() == row['hex']
        assert row['fullHtml'] == bool(re.match(br'^\s*<(?:html|!doctype)', raw, re.I))
        outcome(row['outcome'], ['builtins.str', 'builtins.UnicodeDecodeError', 'lxml.etree.ParserError'])
    assert len(names) == 589
    assert all('content-' + f'{n:02x}' in names and 'prefix-' + f'{n:02x}' in names for n in range(256))
    assert [r['name'] for r in data['cases'] if any(d['resourceLimit'] for d in r['diagnostics'])] == ['depth-256']
    assert sum(r['outcome']['kind'] == 'success' for r in data['cases']) == 565
    assert sum(r['outcome']['type'] == 'builtins.UnicodeDecodeError' for r in data['cases']) == 20
    assert sum(r['outcome']['type'] == 'lxml.etree.ParserError' for r in data['cases']) == 4
    controls = set()
    for row in data['nonTextCases']:
        assert row['name'] == row['cleaner'] + ':' + row['valueKind'] and row['name'] not in controls
        controls.add(row['name']); assert row['hooks'] == []
        outcome(row['outcome'], ['builtins.str', 'builtins.TypeError'])
    assert len(controls) == 45
    assert sum(r['outcome']['kind'] == 'success' for r in data['nonTextCases']) == 6
    assert used == set(values)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    raw = FIXTURE.read_bytes(); data = json.loads(raw); check(data)
    mutations = [
        lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])),
        lambda d: d['cases'][0].update(hex='00'), lambda d: d['cases'][1].update(fullHtml=True),
        lambda d: d['artifacts'][0].update(value='corrupt'), lambda d: d.update(oracleCommit='a' * 40),
        lambda d: d.update(scope='target complete'), lambda d: d.update(producerSha256='a' * 64),
        lambda d: d['nonTextCases'].pop(), lambda d: d['nonTextCases'][0]['hooks'].append('str'),
        lambda d: d['cases'][-1].update(outcome={'kind': 'success', 'type': 'builtins.str', 'text': 'a' * 64}),
        lambda d: d.update(libxmlRuntime=[2, 15, 4]),
    ]
    for mutate in mutations:
        broken = copy.deepcopy(data); mutate(broken)
        try: check(broken)
        except AssertionError: continue
        raise AssertionError('corrupt evidence accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-html-bytes-') as tmp:
            output = Path(tmp) / 'source.json'
            subprocess.run([str(args.oracle_root / '.venv/bin/python'), str(PRODUCER), '--oracle-root', str(args.oracle_root), '--output', str(output)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert output.read_bytes() == raw
    print('PASS 589 byte outcomes / 45 non-text dispatch cases / 488 full strings / 12 corruption controls; no target parity claim')


if __name__ == '__main__':
    main()
