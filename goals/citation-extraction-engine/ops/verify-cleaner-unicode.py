#!/usr/bin/env python3
"""Seal exact source Unicode composition; this does not prove a TypeScript port."""
from collections import Counter
import argparse
import itertools
import os
import subprocess
import tempfile
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / 'packages/law-practice/use-cases/test/fixtures/eyecite/cleaner-unicode.json'
PRODUCER = Path(__file__).with_name('probe-cleaner-unicode.py')
SEAL = 'a3f00d52bfb6cdedff16395899254e1754fbef5f65de4fb298df5a1c0063c551'


def check(data):
    assert hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest() == SEAL
    assert data['schemaVersion'] == 'citation-cleaner-unicode/v1'
    assert data['scope'] == 'source Unicode composition and storage-sensitive HTML; registry protocols remain open'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert (data['python'], data['pythonHashSeed'], data['lxml'], data['libxml']) == ('3.11.15', '0', '5.1.0', '2.12.3')
    assert data['cleanSourceSha256'] == 'b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db'
    assert data['oracleLicenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['producerSha256'] == hashlib.sha256(PRODUCER.read_bytes()).hexdigest()
    assert data['runtimeUnicodeHeaderSha256'] == '9183d40b4aec778c4f59d2091b4374722f635116a33ae6fc66c16e0b5fa700b5'
    assert data['nativeLayoutVerification'] == 'direct retained compact-string storage; little-endian CPython 3.11 x86-64'
    rows = data['cases']
    assert len(rows) == len({row['name'] for row in rows}) == 2016
    assert Counter(row['failure'] for row in rows) == {None: 1534, 'ParserError': 482}
    names = ['html', 'inline_whitespace', 'all_whitespace', 'underscores', 'xml']
    expected = {chain: 12 for n in range(4) for chain in itertools.product(names, repeat=n)}
    assert Counter(tuple(r['steps']) for r in rows if r['name'].startswith('composition-')) == expected
    assert sum(r['name'].startswith('width-') for r in rows) == 144
    snapshots = nonroundtrip = 0
    for row in rows:
        events = row['events']
        assert 1 <= len(events) <= len(row['steps']) + 1
        assert (row['failure'] is not None) == (len(events) < len(row['steps']) + 1)
        assert all(step in ['html', 'inline_whitespace', 'all_whitespace', 'underscores', 'xml'] for step in row['steps'])
        for index, event in enumerate(events):
            value = event['value']
            points = value['codepoints']
            assert all(type(p) is int and 0 <= p <= 0x10ffff for p in points)
            text = ''.join(map(chr, points))
            largest = max(points, default=0)
            width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
            assert value['width'] == width
            assert bytes.fromhex(value['nativeHex']) == b''.join(p.to_bytes(width, 'little') for p in points)
            assert value['pythonLength'] == len(points)
            utf16 = text.encode('utf-16-le', 'surrogatepass')
            assert value['utf16Units'] == len(utf16) // 2
            assert value['javascriptRoundtrip'] == (utf16.decode('utf-16-le', 'surrogatepass') == text)
            assert -(2**63) <= int(value['hash']) < 2**63 and int(value['hash']) != -1
            assert event['sameAs'] == sorted(set(event['sameAs']))
            assert all(type(i) is int and 0 <= i < index for i in event['sameAs'])
            assert all(events[i]['value'] == value for i in event['sameAs'])
            # Identity is an equivalence relation among retained source values.
            for old in event['sameAs']:
                assert events[old]['sameAs'] == [i for i in event['sameAs'] if i < old]
            snapshots += 1
            nonroundtrip += not value['javascriptRoundtrip']
    assert (snapshots, nonroundtrip) == (6412, 1208)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    raw = FIXTURE.read_bytes()
    data = json.loads(raw)
    check(data)
    mutations = [
        lambda d: d['cases'].pop(),
        lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])),
        lambda d: d['cases'][0]['events'][0]['value'].update(width=4),
        lambda d: d['cases'][0]['events'][0]['value'].update(codepoints=[0x1f600]),
        lambda d: d['cases'][0]['events'][0]['value'].update(nativeHex=''),
        lambda d: d['cases'][0]['events'][0]['value'].update(pythonLength=1),
        lambda d: d['cases'][0]['events'][0]['value'].update(utf16Units=1),
        lambda d: d['cases'][0]['events'][0]['value'].update(hash='-1'),
        lambda d: d['cases'][0]['events'][0].update(sameAs=[0]),
        lambda d: d['cases'][0].update(failure='ParserError'),
        lambda d: d.update(oracleCommit='0' * 40),
        lambda d: d.update(oracleLicenseSha256='0' * 64),
        lambda d: d.update(producerSha256='0' * 64),
        lambda d: d.update(pythonHashSeed='1'),
        lambda d: d.update(lxml='other'),
        lambda d: d.update(scope='complete engine parity'),
        lambda d: d.update(runtimeUnicodeHeaderSha256='0' * 64),
        lambda d: d.update(nativeLayoutVerification='inferred from JavaScript projection'),
        lambda d: next(e['value'] for r in d['cases'] for e in r['events'] if not e['value']['javascriptRoundtrip']).update(codepoints=[0x1f600], width=4, nativeHex='00f60100', pythonLength=1, utf16Units=2, hash='-3536540696076613844', javascriptRoundtrip=True),
        lambda d: next(r for r in d['cases'] if r['name']=='width-3-0-0-1')['events'][-1]['value'].update(codepoints=[0x1f600, 0x1f600]),
    ]
    assert len(mutations) == 20
    for mutation in mutations:
        broken = copy.deepcopy(data)
        mutation(broken)
        try:
            check(broken)
        except AssertionError:
            continue
        raise AssertionError('corrupt Unicode evidence accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-cleaner-unicode-') as tmp:
            target = Path(tmp) / 'source.json'
            subprocess.run([str(args.oracle_root / '.venv/bin/python'), str(PRODUCER), '--oracle-root', str(args.oracle_root), '--output', str(target)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert target.read_bytes() == raw
    print('PASS 2016 source histories / 6412 snapshots / 1208 nonroundtrip snapshots / 20 corruption controls; implementation unproved')


if __name__ == '__main__':
    main()
