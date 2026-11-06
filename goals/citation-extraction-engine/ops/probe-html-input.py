#!/usr/bin/env python3
"""Capture source-bound lxml Unicode buffer and wrapper-input decisions."""
import argparse
import ast
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import unicodedata

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
AUDIT_SHA = '049bbadd90348588e2e7a1c62daf1f5dba0b6865df9f2001b9461b8b80f9cb71'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(['git', '-C', str(root), *values], text=True).strip()
    assert git('rev-parse', 'HEAD') == PIN and git('rev-parse', 'HEAD^{tree}') == TREE and not git('status', '--porcelain')
    assert sys.version_info[:3] == (3, 11, 15) and unicodedata.unidata_version == '14.0.0'
    assert sys.byteorder == 'little' and os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    sys.path.insert(0, str(root))
    import lxml.html
    from lxml import etree
    assert importlib.metadata.version('lxml') == '5.1.0'
    package = Path(lxml.html.__file__).parent.parent
    api = package / 'apihelpers.pxi'
    expression = api.read_text().split('cdef object __RE_XML_ENCODING = ', 1)[1].split('\n\n', 1)[0]
    regex = ast.literal_eval(ast.parse(expression, mode='eval').body.args[0])
    declaration = re.compile(regex, re.U).match
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    repo = Path(__file__).resolve().parents[3]
    audit_path = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-cleaner-audit.json'
    assert sha(audit_path) == AUDIT_SHA
    audit = json.loads(audit_path.read_bytes())
    values = {a['sha256']: a['value'] for a in audit['artifacts']}
    vectors = [('audit:' + row['name'], values[row['text']]) for row in audit['cases']]
    chars = ['A', 'é', 'Ā', '😀', '\ufeff', '\u0085', '\x1c', '\x00', '\ud800', '\udc00']
    wrappers = ['{}', '<p>{}</p>', '<body>{}</body><body>B</body>C', '<head><title>{}</title></head><body>B</body>', '<div class="star-pagination">{}<b>B</b>C</div>', '<script>{}</script>T', '<html><body>{}</body><body>B</body>C</html>']
    for i, char in enumerate(chars):
        for j, wrapper in enumerate(wrappers):
            for k, value in enumerate([char, 'A' + char + 'B', '😀' + char + 'B']):
                vectors.append((f'encoding:{i}:{j}:{k}', wrapper.format(value)))
    for i, prefix in enumerate(['', ' ', '\u0085', '\x1c', '\ufeff', '<!--x-->']):
        for j, head in enumerate(['<html>', '<HTML>', '<!doctype html>', '<htmlx>', '<head>', '<x>']):
            for k, body in enumerate(['<body>A</body><body>B</body>C', '<body>A<b>B</b>C</body><body>D<i>E</i>F</body>G', '<body><!--x-->A</body><body>B<!--y-->C</body>D']):
                vectors.append((f'wrapper:{i}:{j}:{k}', prefix + head + body))
    whitespace = [point for point in range(0x110000) if re.match(r'\s', chr(point))]
    assert whitespace == [point for point in range(0x110000) if chr(point).isspace()]
    for point in whitespace + [0, 0x200b, 0xfeff]:
        char = chr(point)
        vectors.append((f'full-space:{point}', char + '<html><body>A</body><body>B</body>'))
        for i, prefix in enumerate(['<?xml', '<?xml ', '<?xml version="1"', '<?XML version="1"']):
            for j, ending in enumerate(['"x"', "'x'", "'x\"", '"x', '"x>tail"']):
                vectors.append((f'declaration:{point}:{i}:{j}', prefix + char + 'encoding' + char + '=' + char + ending + '?>A'))
    vectors.extend((f'edge:{i}', text) for i, text in enumerate([
        '<?xml encoding="x"?>A', '<?xml  encoding="x"?>A',
        '<?xml a> encoding="x"?>A', '<?xml a encodingfoo="x"?>A',
        '<?xml a encoding= encoding="x"?>A', '<?xml a encoding="x\'?>A',
        '<?xml a encoding="x>y"?>A', '<?xml a encoding="x',
        '<?xml' + 'x' * 8193 + ' encoding = "x"?>A',
        '<?xml a encoding' + ' ' * 8193 + '=x',
        '<?xml a encoding="' + 'x' * 8193,
        ' ' * 8193 + '<!DOCTYPE html>', '\ud800', '\udc00', '😀\ud800A', '😀\udc00A',
    ]))
    artifacts = {}
    def intern(value):
        digest = hashlib.sha256(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest()
        assert digest not in artifacts or artifacts[digest] == value
        artifacts[digest] = value
        return digest
    cases = []
    for name, text in vectors:
        rejected = declaration(text) is not None
        observed = False
        try:
            lxml.html.fromstring(text)
        except ValueError:
            observed = True
        except etree.ParserError:
            pass
        assert observed == rejected, name
        if rejected:
            outcome = {'kind': 'rejected', 'reason': 'unicode-encoding-declaration'}
        else:
            maximum = max(map(ord, text), default=0)
            encoding = 'UTF-8' if maximum <= 127 else 'ISO-8859-1' if maximum <= 255 else 'UTF-16LE' if maximum <= 65535 else 'UTF-32LE'
            buffer = text.encode(encoding, 'surrogatepass')
            outcome = {'kind': 'prepared', 'encoding': encoding, 'byteLength': len(buffer), 'bytesSha256': hashlib.sha256(buffer).hexdigest(), 'fullHtml': lxml.html._looks_like_full_html_unicode(text) is not None}
        cases.append({'name': name, 'text': intern(text), 'sourceUtf16': len(text.encode('utf-16-le', 'surrogatepass')) // 2, 'outcome': outcome})
    notice = package.parent / 'lxml-5.1.0.dist-info'
    report = {'schemaVersion': 'citation-html-input/v1', 'scope': 'Unicode preparation only; no target native parser or worker qualification', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'pythonHashSeed': '0', 'unicodeVersion': '14.0.0', 'byteorder': 'little', 'producerSha256': sha(Path(__file__)), 'auditSha256': AUDIT_SHA, 'sources': {name: sha(package / name) for name in ['parser.pxi', 'apihelpers.pxi', 'html/__init__.py']}, 'notices': {name: sha(notice / name) for name in ['LICENSE.txt', 'LICENSES.txt']}, 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'reporters-db', 'courts-db', 'lxml']}, 'licenseSha256': sha(root / 'LICENSE'), 'lockSha256': sha(root / 'uv.lock'), 'declarationExpression': regex, 'whitespaceCodePoints': whitespace, 'testedCodePoints': 0x110000, 'artifacts': [{'sha256': digest, 'value': artifacts[digest]} for digest in sorted(artifacts)], 'cases': cases}
    assert not git('status', '--porcelain')
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(cases)} input decisions / {len(artifacts)} immutable strings; Unicode preparation only')


if __name__ == '__main__':
    main()
