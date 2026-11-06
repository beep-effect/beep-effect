#!/usr/bin/env python3
"""Capture exact source Unicode values across cleaner composition.

Source evidence only; target value ownership and registry parity remain open.
Native layout adapts CPython 3.11 PyASCIIObject/PyCompactUnicodeObject,
Python Software Foundation, PSF-2.0; see THIRD_PARTY_NOTICES.md.
"""
import argparse
import ctypes
import hashlib
import itertools
import json
import os
from pathlib import Path
import subprocess
import sys
import sysconfig


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *a: subprocess.check_output(['git', '-C', str(root), *a], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (
        '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.implementation.name == 'cpython' and sys.version_info[:3] == (3, 11, 15)
    assert os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    assert sys.byteorder == 'little' and ctypes.sizeof(ctypes.c_void_p) == 8
    header = Path(sysconfig.get_path('include')) / 'cpython/unicodeobject.h'
    header_text = header.read_text()
    assert 'unsigned int interned:2;' in header_text and 'unsigned int kind:3;' in header_text
    assert 'unsigned int compact:1;' in header_text and 'unsigned int ascii:1;' in header_text
    class Ascii(ctypes.Structure):
        _fields_ = [('refcount', ctypes.c_ssize_t), ('type', ctypes.c_void_p),
                    ('length', ctypes.c_ssize_t), ('hash', ctypes.c_ssize_t),
                    ('state', ctypes.c_uint), ('wstr', ctypes.c_void_p)]
    class Compact(ctypes.Structure):
        _fields_ = Ascii._fields_ + [('utf8_length', ctypes.c_ssize_t),
                                    ('utf8', ctypes.c_void_p), ('wstr_length', ctypes.c_ssize_t)]
    assert (ctypes.sizeof(Ascii), ctypes.sizeof(Compact), Ascii.state.offset) == (48, 72, 32)
    sys.path.insert(0, str(root))
    from eyecite.clean import clean_text, cleaners_lookup
    from lxml import etree
    assert etree.LXML_VERSION == (5, 1, 0, 0)
    assert etree.LIBXML_VERSION == (2, 12, 3)
    assert list(cleaners_lookup) == ['html', 'inline_whitespace', 'all_whitespace', 'underscores', 'xml']

    def value(text):
        points = list(map(ord, text))
        maximum = max(points, default=0)
        width = 1 if maximum <= 255 else 2 if maximum <= 65535 else 4
        native = b''.join(point.to_bytes(width, 'little') for point in points)
        assert hash(native) == hash(text)
        # Read only this live, retained interpreter-owned object. Never emit
        # addresses or infer layout on another Python/platform configuration.
        layout = Ascii.from_address(id(text))
        assert layout.length == len(points) and (layout.state >> 2) & 7 == width
        assert (layout.state >> 5) & 1 and (layout.state >> 7) & 1
        offset = ctypes.sizeof(Ascii) if (layout.state >> 6) & 1 else ctypes.sizeof(Compact)
        assert ctypes.string_at(id(text) + offset, len(native)) == native
        utf16 = text.encode('utf-16-le', 'surrogatepass')
        return {'codepoints': points, 'width': width, 'nativeHex': native.hex(),
                'pythonLength': len(text), 'utf16Units': len(utf16) // 2,
                'hash': str(hash(text)),
                'javascriptRoundtrip': utf16.decode('utf-16-le', 'surrogatepass') == text}

    def capture(name, original, steps):
        retained, events = [], []
        def observe(text):
            # Retain actual references until all identity relations are read;
            # Python can otherwise reuse a deallocated object's address.
            events.append({'value': value(text), 'sameAs': [i for i, old in enumerate(retained) if old is text]})
            retained.append(text)
            return text
        sequence = [observe]
        for step in steps:
            sequence.extend([step, observe])
        failure = None
        try:
            result = clean_text(original, sequence)
            assert result is retained[-1]
        except Exception as error:
            failure = type(error).__name__
        return {'name': name, 'steps': list(steps), 'events': events, 'failure': failure}

    samples = ['\ud83d__\ude00', '\ud800__\udc00', '\ud83d\ude00', '😀', '\udfff__\ud800',
               'A\ud83d__\ude00Z', '<b>\ud83d__\ude00</b>', '<?xml x?>\ud83d__\ude00',
               '\ud83d \t\ude00', '\ud83d\u200b\ude00', '\ud83d_\ude00', '\ud83d___\ude00']
    rows = []
    for length in range(4):
        for steps in itertools.product(cleaners_lookup, repeat=length):
            for index, original in enumerate(samples):
                rows.append(capture(f'composition-{length}-{len(rows)}-{index}', original, steps))
    assert len(rows) == 1872
    for prefix_index, prefix in enumerate(['', 'é', 'Ā', '😀']):
        for body_index, body in enumerate(['\ud83d__\ude00', '\ud800__\udc00', '\ud83d\ude00', '😀']):
            for suffix_index, suffix in enumerate(['', 'Ā', '😀']):
                for chain_index, steps in enumerate([['underscores'], ['underscores', 'html'], ['html', 'underscores']]):
                    rows.append(capture(f'width-{prefix_index}-{body_index}-{suffix_index}-{chain_index}', prefix + body + suffix, steps))
    assert len(rows) == len({row['name'] for row in rows}) == 2016
    report = {'schemaVersion': 'citation-cleaner-unicode/v1',
              'scope': 'source Unicode composition and storage-sensitive HTML; registry protocols remain open',
              'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'),
              'python': '3.11.15', 'pythonHashSeed': '0', 'lxml': '5.1.0', 'libxml': '2.12.3',
              'cleanSourceSha256': hashlib.sha256((root / 'eyecite/clean.py').read_bytes()).hexdigest(),
              'oracleLicenseSha256': hashlib.sha256((root / 'LICENSE').read_bytes()).hexdigest(),
              'runtimeUnicodeHeaderSha256': hashlib.sha256(header.read_bytes()).hexdigest(),
              'nativeLayoutVerification': 'direct retained compact-string storage; little-endian CPython 3.11 x86-64',
              'producerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'cases': rows}
    # Retain every full history on one line, keeping generated evidence reviewable.
    metadata = {key: item for key, item in report.items() if key != 'cases'}
    heading = json.dumps(metadata, ensure_ascii=True, indent=2)[:-2]
    histories = ',\n'.join('    ' + json.dumps(row, ensure_ascii=True, separators=(',', ':')) for row in rows)
    args.output.write_text(heading + ',\n  "cases": [\n' + histories + '\n  ]\n}\n')
    print(f'Captured {len(rows)} exact Unicode/identity histories')


if __name__ == '__main__':
    main()
