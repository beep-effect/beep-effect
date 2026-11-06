#!/usr/bin/env python3
"""Bind two fixed HTML discovery programs and prove finite backreference lowering."""
import argparse
import hashlib
import itertools
import json
from pathlib import Path
import re
from re import _parser
import subprocess
import sys

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
LOWERED = r'(?:<em[^>]*>([\s\S]*?)</em>|<(?-i:[iIİ])[^>]*>([\s\S]*?)</(?-i:[iIİ])>|<(?-i:ı)[^>]*>([\s\S]*?)</(?-i:ı)>)'


def native(text):
    maximum = max(map(ord, text), default=0)
    width = 1 if maximum <= 255 else 2 if maximum <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def text(value):
    data, width = bytes.fromhex(value['bytes']), value['width']
    return ''.join(chr(int.from_bytes(data[i:i+width], 'little')) for i in range(0, len(data), width))


def profile(tree, repeated=False):
    repeated_capture = nullable_multi = False
    for kind, value in tree:
        name = str(kind)
        if name == 'SUBPATTERN':
            repeated_capture |= value[0] is not None and repeated
            children = [profile(value[3], repeated)]
        elif name == 'BRANCH':
            children = [profile(branch, repeated) for branch in value[1]]
        elif name in ('MAX_REPEAT', 'MIN_REPEAT'):
            multiple = value[1] > 1
            nullable_multi |= multiple and value[2].getwidth()[0] == 0
            children = [profile(value[2], repeated or multiple)]
        else:
            assert name in ('LITERAL', 'NOT_LITERAL', 'IN'), name
            children = []
        repeated_capture |= any(row[0] for row in children)
        nullable_multi |= any(row[1] for row in children)
    return repeated_capture, nullable_multi


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
    original = re.compile(r'<(em|i)[^>]*>(.*?)</\1>', re.I | re.S)
    lowered = re.compile(LOWERED, re.I)
    corpus_path = Path(__file__).resolve().parents[3] / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-discovery.json'
    sha = lambda data: hashlib.sha256(data).hexdigest()
    assert sha(corpus_path.read_bytes()) == '300ebdae40b70009428549807c2c6bf44692d7fef645c32ba8ad10223ad8ee2e'
    corpus = json.loads(corpus_path.read_text())
    observed = lambda p, t: [(m.start(), m.end(), m.span(2) if p is original else next(m.span(i) for i in range(1, 4) if m.group(i) is not None)) for m in p.finditer(t)]
    for row in corpus['cases']:
        markup = text(row['markup'])
        document = object.__new__(Document)
        document.markup_text = markup
        Document.identify_emphasis_tags(document)
        assert [(native(body), start, end) for body, start, end in document.emphasis_tags] == [(tag['text'], tag['start'], tag['end']) for tag in row['tags']]
        assert native(placeholder_markup(markup)) == row['placeholder']
        assert observed(original, markup) == observed(lowered, markup)
    parts = ['<i>', '<I>', '<İ>', '<ı>', '</i>', '</I>', '</İ>', '</ı>', '<em>', '<EM>', '</em>', '</EM>', 'a', '\n']
    digest, count = hashlib.sha256(), 0
    for length in range(5):
        for sequence in itertools.product(parts, repeat=length):
            markup = ''.join(sequence)
            expected = observed(original, markup)
            assert expected == observed(lowered, markup)
            digest.update(json.dumps([markup, expected], ensure_ascii=True, separators=(',', ':')).encode() + b'\n')
            count += 1
    # Keep the rejected simple lowering as a concrete negative control.
    naive = re.compile(r'(?:<em[^>]*>([\s\S]*?)</em>|<i[^>]*>([\s\S]*?)</i>)', re.I)
    assert not original.search('<i>x</ı>') and naive.search('<i>x</ı>')
    patterns, bindings = {}, []
    for name, pattern, flags in [('placeholder', r'<([\/a-z])[^>]+>', 0), ('emphasis', LOWERED, 2)]:
        storage = native(pattern)
        compiled = re.compile(pattern, flags)
        parsed = _parser.parse(pattern, flags)
        repeated, nullable = profile(parsed)
        assert not repeated and not nullable
        patterns[name] = storage
        bindings.append({'patternSha256': sha(bytes([storage['width']]) + bytes.fromhex(storage['bytes'])),
                         'flags': flags, 'profile': {'groups': compiled.groups, 'names': dict(compiled.groupindex),
                         'minimumWidthFloor': parsed.getwidth()[0], 'repeatedCaptures': repeated, 'nullableMultiRepeat': nullable}})
    result = {'schemaVersion': 'citation-html-discovery-patterns/v1', 'oracleCommit': PIN, 'oracleTree': TREE,
              'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()),
              'sourceCorpusSha256': sha(corpus_path.read_bytes()),
              'exhaustiveSequences': count, 'exhaustiveSha256': digest.hexdigest(),
              'configuration': {'patterns': patterns, 'bindings': bindings}}
    args.output.write_text(json.dumps(result, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'bindings': bindings, 'sequences': count, 'fixtureSha256': sha(args.output.read_bytes())}))


if __name__ == '__main__':
    main()
