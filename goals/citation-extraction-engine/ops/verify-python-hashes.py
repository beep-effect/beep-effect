#!/usr/bin/env python3
"""Seal pinned byte/Unicode hash vectors and complete SipHash attribution."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[3]
FIXTURE = REPO / 'packages/law-practice/use-cases/test/fixtures/eyecite/python-hashes.json'
PRODUCER = Path(__file__).with_name('probe-python-hashes.py')
NOTICES = REPO / 'THIRD_PARTY_NOTICES.md'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def check(data, notices):
    assert sha(json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode()) == '9a1a9fe6b563f199d69a56688f76e84c48fbe7b97d7a3db372290cc1c4fbdd60'
    assert data['schemaVersion'] == 'citation-python-hashes/v1'
    assert data['scope'] == 'frozen bytes and explicit canonical Unicode storage; live object protocols and complete registry remain open'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0'
    assert (data['hashAlgorithm'], data['hashWidth'], data['hashCutoff'], data['byteorder']) == ('siphash13', 64, 0, 'little')
    assert data['producerSha256'] == sha(PRODUCER.read_bytes())
    assert data['cpythonSource'] == {'pyhash.c': '7f18429290df0726669cbd6d8b5a8b48b843efff648fe8863d48da5db4745628', 'pyhash.h': 'a6ea755ff42ec955feaf49b1d234a5c2935899309ea59925d1d30f3e62fed67d', 'unicodeobject.c': '5dde8eb1b99878b4ea113cd6b5f88bca3667b0e23dc8c5262a07f5ea14d0d82e', 'LICENSE': '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf', 'bootstrap_hash.c': '487eacb171863c17ae8838ba93e4d913100b8bdbfeab245277e104a0a6869886'}
    assert data['oracleLicenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['siphashMitSha256'] == 'c4e4a1ac18ae32c9318bb3ecee03057d6a094936f2500c89c60600918b3d6409'
    assert notices.count('<!-- citation-siphash-mit:begin -->') == 1
    assert notices.count('<!-- citation-siphash-mit:end -->') == 1
    indented = notices.split('<!-- citation-siphash-mit:begin -->\n\n', 1)[1].split('\n<!-- citation-siphash-mit:end -->', 1)[0]
    fragment = ''.join(line[4:] if line.startswith('    ') else line for line in indented.splitlines(keepends=True))
    assert sha(fragment.encode()) == data['siphashMitSha256']
    names, known = set(), {}
    counts = {'unicode': 0, 'bytes': 0}; explicit = 0
    for row in data['cases']:
        assert row['name'] not in names; names.add(row['name'])
        native = bytes.fromhex(row['hex']); value = int(row['hash'])
        assert -(2 ** 63) <= value < 2 ** 63 and value != -1
        if not native: assert value == 0
        assert known.get(row['hex'], value) == value; known[row['hex']] = value
        counts[row['kind']] += 1
        if row['kind'] == 'unicode':
            points = row['codepoints']; assert all(type(p) is int and 0 <= p <= 0x10ffff for p in points)
            original = ''.join(map(chr, points))
            assert original.encode('utf-16-le', 'surrogatepass') == row['value'].encode('utf-16-le', 'surrogatepass')
            largest = max(points, default=0); width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
            assert row['width'] == width and b''.join(p.to_bytes(width, 'little') for p in points) == native
            roundtrip = original.encode('utf-16-le', 'surrogatepass').decode('utf-16-le', 'surrogatepass') == original
            assert (original == row['value']) == roundtrip
            assert row['javascriptRoundtrip'] == roundtrip; explicit += not roundtrip
    assert counts == {'unicode': 530, 'bytes': 526} and explicit == 2 and len(names) == 1056


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    parser.add_argument('--cpython-root', type=Path)
    args = parser.parse_args()
    raw = FIXTURE.read_bytes(); data = json.loads(raw); notices = NOTICES.read_text(); check(data, notices)
    mutations = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d['cases'][0].update(hash='-1'), lambda d: d['cases'][0].update(hex='ffff'), lambda d: d['cases'][0].update(width=4), lambda d: d['cases'][0]['codepoints'].append(0x110000), lambda d: d.update(oracleCommit='0' * 40), lambda d: d.update(hashAlgorithm='siphash24'), lambda d: d.update(pythonHashSeed='1'), lambda d: d.update(siphashMitSha256='0' * 64), lambda d: next(r for r in d['cases'] if r.get('javascriptRoundtrip') is False).update(javascriptRoundtrip=True), lambda d: d.update(scope='complete cleaner registry parity')]
    for mutate in mutations:
        broken = copy.deepcopy(data); mutate(broken)
        try: check(broken, notices)
        except (AssertionError, IndexError): continue
        raise AssertionError('corrupt Python hash evidence accepted')
    for broken in [notices.replace('citation-siphash-mit:begin', 'removed-siphash-mit:begin'), notices.replace('Copyright (c) 2013  Marek Majkowski', 'Copyright removed')]:
        try: check(data, broken)
        except (AssertionError, IndexError): continue
        raise AssertionError('missing/changed SipHash license accepted')
    if args.oracle_root or args.cpython_root:
        assert args.oracle_root and args.cpython_root
        with tempfile.TemporaryDirectory(prefix='citation-python-hashes-') as tmp:
            target = Path(tmp) / 'source.json'
            subprocess.run([str(args.oracle_root / '.venv/bin/python'), str(PRODUCER), '--oracle-root', str(args.oracle_root), '--cpython-root', str(args.cpython_root), '--output', str(target)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert target.read_bytes() == raw
    print('PASS 1056 full hash vectors / 2 explicit surrogate storage controls / complete MIT notice / 14 corruption controls; registry proof remains open')


if __name__ == '__main__': main()
