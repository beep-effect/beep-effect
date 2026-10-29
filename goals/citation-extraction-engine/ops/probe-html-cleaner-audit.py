#!/usr/bin/env python3
"""Capture HTML parser semantics and the native-depth safety conflict."""
import argparse
import ast
import collections
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import unicodedata

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(['git', '-C', str(root), *values], text=True).strip()
    assert git('rev-parse', 'HEAD') == PIN and git('rev-parse', 'HEAD^{tree}') == TREE and not git('status', '--porcelain')
    assert sys.version_info[:3] == (3, 11, 15) and unicodedata.unidata_version == '14.0.0'
    assert os.environ.get('PYTHONHASHSEED') == '0' and not sys.flags.hash_randomization
    assert sys.byteorder == 'little' and struct.calcsize('P') == 8
    sys.path.insert(0, str(root))
    from eyecite.clean import html as clean_html
    import lxml
    import lxml.html
    from lxml import etree
    assert etree.LIBXML_VERSION == etree.LIBXML_COMPILED_VERSION == (2, 12, 3)
    assert importlib.metadata.version('lxml') == '5.1.0'
    source = root / 'eyecite/clean.py'
    tree = ast.parse(source.read_text())
    html_function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'html')
    expression = next(node.args[0].value for node in ast.walk(html_function) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'xpath')
    vectors = [
        ('empty', ''), ('space-only', ' \t\r\n'), ('plain', 'plain text'),
        ('comment-only', '<!--comment-->'), ('comment-split', 'a<!--comment-->b'),
        ('head-title', '<head><title>TITLE</title></head><body>BODY</body>'),
        ('head-direct', '<head>HEAD<title>TITLE</title></head><body>BODY</body>'),
        ('nested-star', '<div class="star-pagination">HIDDEN<b>CHILD</b>TAIL</div>'),
        ('star-multi-class', '<div class="star-pagination other">VISIBLE</div>'),
        ('star-space-class', '<div class=" star-pagination ">VISIBLE</div>'),
        ('star-case-class', '<div class="STAR-PAGINATION">VISIBLE</div>'),
        ('style-direct', '<style>HIDDEN</style>TAIL'), ('script-direct', '<script>HIDDEN</script>TAIL'),
        ('page-number-nested', '<page-number>HIDDEN<b>CHILD</b>TAIL</page-number>'),
        ('link-tail', '<link>LINKTAIL<b>CHILD</b>TAIL'),
        ('xml-encoding-declaration', '<?xml version="1.0" encoding="utf8"?><p>VISIBLE</p>'),
        ('xml-no-encoding', '<?xml version="1.0"?><p>VISIBLE</p>'),
        ('xml-leading-space', ' <?xml encoding="utf8"?><p>VISIBLE</p>'),
        ('unicode-latin1', 'aé b'), ('unicode-bmp', 'aĀ b'), ('unicode-astral', 'a😀 b'),
        ('unicode-isolated-surrogate', 'a\ud800b'), ('nul-ascii', 'a\x00b'), ('nul-bmp', 'aĀ\x00b'),
        ('nul-only', '\x00'), ('entity-html4', 'a&nbsp;&copy;&NotEqualTilde;b'),
        ('entity-numeric', 'a&#0;&#x80;&#x1F600;b'), ('malformed-close', '<b>A<i>B</b>C</i>D'),
        ('table-recovery', 'A<table>B<tr><td>C</td></tr>D</table>E'),
        ('multiple-body', '<body>A</body><body>B</body>C'),
        ('multiple-head', '<head><title>A</title></head><head><title>B</title></head><body>C</body>'),
        ('doctype-only', '<!DOCTYPE html>'), ('cdata', 'A<![CDATA[B]]>C'),
    ]
    for name, char in [('nbsp', '\u00a0'), ('nel', '\u0085'), ('vertical-tab', '\v'), ('zero-width', '\u200b'), ('bom', '\ufeff'), ('ascii-space', ' '), ('lf', '\n')]:
        vectors.append(('text-node-' + name, '<p>' + char + '</p><b>END</b>'))
    for depth in [254, 255, 256, 257, 300]:
        vectors.append((f'depth-{depth}', '<div>' * depth + 'VISIBLE' + '</div>' * depth))
    for tag in ['div', 'head', 'style', 'script', 'page-number', 'title', 'textarea', 'noscript']:
        for attribute in ['', ' class="star-pagination"', ' class="star-pagination other"']:
            vectors.append((f'parent:{tag}:{attribute}', f'<{tag}{attribute}>BEFORE<b>CHILD</b>AFTER</{tag}>END'))
    artifacts = {}
    def intern(value):
        digest = hashlib.sha256(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest()
        assert digest not in artifacts or artifacts[digest] == value
        artifacts[digest] = value
        return digest
    cases = []
    for name, text in vectors:
        try:
            value = clean_html(text)
            outcome = {'kind': 'success', 'value': intern(value)}
        except (ValueError, etree.ParserError) as error:
            outcome = {'kind': 'error', 'type': type(error).__module__ + '.' + type(error).__name__}
        diagnostics = [{'domain': entry.domain_name, 'type': entry.type_name, 'level': entry.level_name, 'depthLimit': entry.message.startswith('Excessive depth in document:')} for entry in lxml.html.html_parser.error_log] if outcome.get('type') != 'builtins.ValueError' else []
        nodes, selected = [], []
        if outcome['kind'] == 'success':
            document = lxml.html.fromstring(text)
            all_text = document.xpath('//text()')
            positions = collections.defaultdict(collections.deque)
            for index, item in enumerate(all_text):
                positions[(id(item.getparent()), item.is_tail, str(item))].append(index)
                parent = item.getparent().getparent() if item.is_tail else item.getparent()
                nodes.append({'value': intern(str(item)), 'parentTag': parent.tag if parent is not None else '#document', 'parentClass': parent.get('class') if parent is not None else None, 'tail': item.is_tail})
            actual = document.xpath(expression)
            selected = [positions[(id(item.getparent()), item.is_tail, str(item))].popleft() for item in actual]
            assert ' '.join(str(item) for item in actual) == value
        cases.append({'name': name, 'text': intern(text), 'sourceUtf16': len(text.encode('utf-16-le', 'surrogatepass')) // 2, 'outcome': outcome, 'nodes': nodes, 'selected': selected, 'diagnostics': diagnostics})
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    lxml_root = Path(lxml.__file__).parent
    report = {'schemaVersion': 'citation-html-cleaner-audit/v1', 'scope': 'Source observations only; native depth exhaustion produces successful truncation. This artifact authorizes no target behavior or divergence.', 'oracleCommit': PIN, 'oracleTree': TREE, 'producerSha256': sha(Path(__file__)), 'sources': {'clean.py': sha(source), 'lxml/html/__init__.py': sha(Path(lxml.html.__file__)), 'lxml/parser.pxi': sha(lxml_root / 'parser.pxi'), 'lxml/apihelpers.pxi': sha(lxml_root / 'apihelpers.pxi')}, 'licenseSha256': sha(root / 'LICENSE'), 'lockSha256': sha(root / 'uv.lock'), 'python': '3.11.15', 'pythonHashSeed': '0', 'unicodeVersion': unicodedata.unidata_version, 'byteorder': sys.byteorder, 'pointerBits': 64, 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'reporters-db', 'courts-db', 'lxml']}, 'libxmlRuntime': list(etree.LIBXML_VERSION), 'libxmlCompiled': list(etree.LIBXML_COMPILED_VERSION), 'xpath': expression, 'artifacts': [{'sha256': key, 'value': artifacts[key]} for key in sorted(artifacts)], 'cases': cases, 'targetProof': None, 'divergenceApproval': None}
    assert not git('status', '--porcelain')
    args.output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(f'Captured {len(cases)} HTML observations; depth 255/256 safety conflict retained, no target or divergence approval')


if __name__ == '__main__': main()
