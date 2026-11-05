#!/usr/bin/env python3
"""Capture pinned CPython byte and canonical Unicode-storage hashes."""
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
    oracle, cpython = args.oracle_root.resolve(), args.cpython_root.resolve()
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    git = lambda *a: subprocess.check_output(['git', '-C', str(oracle), *a], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == ('04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == 'cpython'
    assert os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    assert (sys.hash_info.algorithm, sys.hash_info.width, sys.hash_info.cutoff, sys.byteorder) == ('siphash13', 64, 0, 'little')
    pins = {'pyhash.c': '7f18429290df0726669cbd6d8b5a8b48b843efff648fe8863d48da5db4745628', 'pyhash.h': 'a6ea755ff42ec955feaf49b1d234a5c2935899309ea59925d1d30f3e62fed67d', 'unicodeobject.c': '5dde8eb1b99878b4ea113cd6b5f88bca3667b0e23dc8c5262a07f5ea14d0d82e', 'LICENSE': '3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf', 'bootstrap_hash.c': '487eacb171863c17ae8838ba93e4d913100b8bdbfeab245277e104a0a6869886'}
    assert all(sha(cpython / name) == digest for name, digest in pins.items())
    mit = (cpython / 'pyhash.c').read_text().split(' <MIT License>\n', 1)[1].split(' </MIT License>', 1)[0]
    rows = []
    def text(name, value):
        points = list(map(ord, value)); maximum = max(points, default=0)
        width = 1 if maximum <= 255 else 2 if maximum <= 65535 else 4
        native = b''.join(point.to_bytes(width, 'little') for point in points)
        assert hash(value) == hash(native)
        roundtrip = value.encode('utf-16-le', 'surrogatepass').decode('utf-16-le', 'surrogatepass') == value
        rows.append({'name': name, 'kind': 'unicode', 'value': value, 'codepoints': points, 'width': width, 'hex': native.hex(), 'javascriptRoundtrip': roundtrip, 'hash': str(hash(value))})
    def binary(name, value): rows.append({'name': name, 'kind': 'bytes', 'hex': value.hex(), 'hash': str(hash(value))})
    for point in range(256): text(f'latin1-{point:02x}', chr(point))
    for point in [256, 257, 2047, 2048, 0xd7ff, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff, 0x10000, 0x10001, 0x1f600, 0x10ffff]:
        for suffix in ['', 'A', '\u00e9']: text(f'point-{point:x}-{len(suffix)}-{ord(suffix) if suffix else 0}', chr(point) + suffix)
    for name, sample in [('ascii', 'html'), ('latin1', 'Aé'), ('bmp', 'AĀ'), ('smp', 'A😀'), ('surrogate', 'A\ud800')]:
        for size in range(41): text(f'{name}-length-{size}', (sample * 41)[:size])
        for size in [4095, 4096, 4097]: text(f'{name}-long-{size}', (sample * 4097)[:size])
    for index, value in enumerate(['\ud83d\ude00', '\ud800\udc00', '\udfff\ud800', 'A\x00B', 'html', 'inline_whitespace', 'all_whitespace', 'underscores', 'xml']): text(f'control-{index}', value)
    for byte in range(256): binary(f'byte-{byte:02x}', bytes([byte]))
    for size in range(257): binary(f'byte-tail-{size}', bytes(index % 256 for index in range(size)))
    for size in [511, 512, 513, 1023, 1024, 1025, 2047, 2048, 2049, 8191, 8192, 8193, 16385]: binary(f'byte-long-{size}', bytes((index * 37 + 11) % 256 for index in range(size)))
    assert len({r['name'] for r in rows}) == len(rows)
    report = {'schemaVersion': 'citation-python-hashes/v1', 'scope': 'frozen bytes and explicit canonical Unicode storage; live object protocols and complete registry remain open', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'), 'python': '3.11.15', 'pythonHashSeed': '0', 'hashAlgorithm': 'siphash13', 'hashWidth': 64, 'hashCutoff': 0, 'byteorder': 'little', 'producerSha256': sha(Path(__file__)), 'cpythonSource': pins, 'siphashMitSha256': hashlib.sha256(mit.encode()).hexdigest(), 'oracleLicenseSha256': sha(oracle / 'LICENSE'), 'cases': rows}
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(rows)} full hash vectors / {sum(r.get("javascriptRoundtrip") is False for r in rows)} explicit surrogate-pair storage controls')


if __name__ == '__main__': main()
