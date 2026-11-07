#!/usr/bin/env python3
"""Observe original wrap annotation, actual XML checks and wrap-helper calls."""
import argparse
import hashlib
import json
import logging
import re
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch


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
    import eyecite.annotate as annotation
    from eyecite.utils import is_balanced_html, wrap_html_tags
    texts = ['', 'plain text', '<i>Foo</i>', '<em>Foo</em>', '<b>Foo</b>', '<I>Foo</I>',
             '<br>Foo', '<i>Foo</em>', 'x<i>Foo</i>z<i>Bar</i>', '<i><em>Foo</i></em>',
             '<i class="x">Foo</i>', '<i>😀A</i>', '<i>\ud83d\ude00A</i>', '<i>\ud83d\ude00😀A</i>',
             '<i>\ud800A</i>', '<i>&amp;</i>', '<i>Foo\x00</i>', '<em>\nFoo</em>']
    rows = []
    class Warnings(logging.Handler):
        def emit(self, record):
            warnings.append(record.levelname)
    handler = Warnings()
    annotation.logger.addHandler(handler)
    try:
        for text in texts:
            n = len(text)
            for annotations in [[], [((0, n), '<a>', '</a>')], [((1, n-1), '[', ']')],
                                [((3, n-4), '<a>', '</a>')], [((-3, n), '[', ']')],
                                [((0, 3), 'B', 'b'), ((1, n), 'A', 'a')],
                                [((0, n), '<a>', '</a>'), ((0, n), '[', ']')],
                                [((0, n), r'\q', ']')], [((1, n-1), r'\q', ']')]]:
                checks, warnings, wrapped = [], [], []
                def observed(span):
                    value = is_balanced_html(span)
                    checks.append({'text': native(span), 'fast': '<' not in span and '>' not in span, 'value': value})
                    return value
                def observed_wrap(span, before, after):
                    call = {'text': native(span), 'before': native(before), 'after': native(after), 'success': False}
                    wrapped.append(call)
                    result = wrap_html_tags(span, before, after)
                    call['success'] = True
                    return result
                with patch.object(annotation, 'is_balanced_html', observed), patch.object(annotation, 'wrap_html_tags', observed_wrap):
                    try:
                        result = {'_tag': 'Success', 'text': native(annotation.annotate_citations(text, annotations, unbalanced_tags='wrap'))}
                    except (re.error, IndexError) as error:
                        result = {'_tag': 'Failure', 'kind': type(error).__name__}
                rows.append({'id': len(rows), 'source': native(text),
                             'input': [{'start': span[0], 'end': span[1], 'before': native(before), 'after': native(after)} for span, before, after in annotations],
                             'checks': checks, 'wrapped': wrapped, 'warnings': warnings, 'result': result})
    finally:
        annotation.logger.removeHandler(handler)
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    out = {'schemaVersion': 'citation-annotation-wrap-composition/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()),
           'annotateSha256': sha((root / 'eyecite/annotate.py').read_bytes()), 'cases': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows), 'checks': sum(len(row['checks']) for row in rows), 'parserChecks': sum(not c['fast'] for row in rows for c in row['checks']), 'wrapCalls': sum(len(row['wrapped']) for row in rows), 'successfulWrapCalls': sum(c['success'] for row in rows for c in row['wrapped']), 'failures': sum(row['result']['_tag']=='Failure' for row in rows)}))


if __name__ == '__main__':
    main()
