#!/usr/bin/env python3
"""Observe original placeholder and emphasis discovery without DOM normalization."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    maximum = max(map(ord, text), default=0)
    width = 1 if maximum <= 255 else 2 if maximum <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite.models import Document
    from eyecite.utils import placeholder_markup

    # Call the actual method on an uninitialized Document to isolate discovery
    # from cleaning/diff construction and retain even malformed native strings.
    texts = ['', 'plain', '\x00', '😀', '\ud83d\ude00', '\ud800',
             ' Foo ', '\tFoo\n', '\u001cFoo\u001f', '\u00a0Foo\u2003',
             '&amp;', '<em>inner</em>', '</i><i>next', '\nA\r\nB\u2028C']
    openings = ['i', 'I', 'İ', 'ı', 'em', 'EM', 'Em', 'eM',
                'image', 'important', 'emphasis', 'i class="a>b"',
                'em data="x"', 'i\nclass=x', ' i', 'i/']
    closings = ['i', 'I', 'İ', 'ı', 'em', 'EM', 'em ', ' i']
    cases = [('', 'empty'), ('<> <i> </> </i> <a> </a> <I> </I>', 'short-tags'),
             ('<!--x--><!DOCTYPE html><?x?><a\nx>body</a>', 'non-elements'),
             ('<i><em>A</em>B</i><em>C</em>', 'nested-mixed'),
             ('<i>A<i>B</i>C</i>', 'nested-same'),
             ('<em>A</i>B</em>', 'mismatched-inner'),
             ('<i>A</i><i>B</i><em>C</em>', 'adjacent'),
             ('<i>A</iX></i>', 'closing-prefix'),
             ('<i>A</i\n>', 'closing-newline'),
             ('<i>unterminated', 'unterminated'),
             ('<i class="a>b">Foo</i>', 'quoted-angle'),
             ('<a<em>Foo</em>>', 'overlapping-opening')]
    for opening in openings:
        for closing in closings:
            cases.append((f'<{opening}> A\nB </{closing}>', 'opening-closing'))
    for text in texts:
        for opening in ['i', 'em', 'I', 'İ']:
            cases.append((f'😀\ud83d\ude00\x00<{opening}>{text}</{opening}>tail', 'native-inner'))
    # Each whitespace point is observed through the real str.strip call; a
    # JavaScript whitespace class must not silently replace CPython's table.
    for point in list(range(0x21)) + [0x85, 0xa0, 0x1680, *range(0x2000, 0x200c), 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff]:
        char = chr(point)
        cases.append((f'<em>{char}X{char}</em>', 'strip-point'))
    rows = []
    for ordinal, (markup, family) in enumerate(cases):
        document = object.__new__(Document)
        document.markup_text = markup
        Document.identify_emphasis_tags(document)
        placeholder = placeholder_markup(markup)
        assert len(placeholder) == len(markup)
        rows.append({'id': ordinal, 'family': family, 'markup': native(markup),
                     'placeholder': native(placeholder),
                     'tags': [{'text': native(text), 'start': start, 'end': end}
                              for text, start, end in document.emphasis_tags]})
    sha = lambda data: hashlib.sha256(data).hexdigest()
    output = {'schemaVersion': 'citation-html-discovery/v1', 'oracleCommit': PIN,
              'oracleTree': TREE, 'python': '3.11.15',
              'producerSha256': sha(Path(__file__).read_bytes()),
              'sources': {name: sha((root / name).read_bytes())
                          for name in ['eyecite/models.py', 'eyecite/utils.py']}, 'cases': rows}
    args.output.write_text(json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows), 'tags': sum(len(row['tags']) for row in rows),
                      'fixtureSha256': sha(args.output.read_bytes())}))


if __name__ == '__main__':
    main()
