#!/usr/bin/env python3
"""Observe original is_balanced_html XML parsing and its no-angle fast path."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import random
import subprocess
import sys


def native(text):
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    pin, tree = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (pin, tree, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite.utils import is_balanced_html
    from lxml import etree
    assert importlib.metadata.version('lxml') == '5.1.0'
    assert etree.LIBXML_VERSION == (2, 12, 3)
    texts = ['', 'plain', 'x\x00y', '\ud800', '\ud83d\ude00', '<', '>', '<>',
             '<i>Foo</i>', '<br>', '<br/>', '<hr></hr>', '<I>Foo</I>', '<i>Foo</em>',
             '<a:b/>', '<a:b xmlns:a="urn:x"/>', '<a xmlns="urn:x"/>', '<a x="1" x="2"/>',
             '&unknown;', '&amp;', '&#0;', '&#xD800;', '<i>&amp;</i>', '<i>&unknown;</i>',
             '<i>\x00</i>', '<i>😀</i>', '<i>\ud800</i>', '<i>\ud83d\ude00</i>', '<i>\ud83d\ude00😀</i>', '<!--x-->', '<!--x--->', '<![CDATA[x]]>',
             '<?xml version="1.0"?>', '<!DOCTYPE a SYSTEM "file:///private">', '</div><a/>',
             '<i a="x>y">z</i>', '<i a="x<y">z</i>', '<i>&#x1F600;</i>']
    texts += ['<i>' * n + 'X' + '</i>' * n for n in [253, 254, 255, 256, 257, 512]]
    rng = random.Random(7718)
    for _ in range(256):
        texts.append(''.join(rng.choice(['<i>', '</i>', '<b>', '</b>', '<em/>', '<br>', '&amp;', '&x;', 'A', '😀', '\n', '\x00']) for _ in range(rng.randrange(12))))
    rows = []
    for text in texts:
        value, error = None, None
        try:
            value = is_balanced_html(text)
        except (UnicodeEncodeError, ValueError) as exc:
            error = type(exc).__name__
        rows.append({'id': len(rows), 'source': native(text), 'fast': '<' not in text and '>' not in text,
                     'value': value, 'error': error})
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    out = {'schemaVersion': 'citation-annotation-xml/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'lxml': '5.1.0', 'libxml': '2.12.3',
           'producerSha256': sha(Path(__file__).read_bytes()), 'utilsSha256': sha((root / 'eyecite/utils.py').read_bytes()), 'cases': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows), 'fast': sum(row['fast'] for row in rows), 'errors': sum(row['error'] is not None for row in rows)}))


if __name__ == '__main__':
    main()
