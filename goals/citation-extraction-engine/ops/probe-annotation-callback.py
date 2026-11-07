#!/usr/bin/env python3
"""Observe unchanged annotation callback order, inputs and final-join failures."""
import argparse
import hashlib
import json
import logging
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
    rows = []
    class Warnings(logging.Handler):
        def emit(self, record):
            warnings.append(record.levelname)
    handler = Warnings()
    annotation.logger.addHandler(handler)
    class Subclass(str):
        def __str__(self):
            coercions.append('str')
            raise AssertionError('unexpected coercion')
    try:
        for text in ['', 'abc def ghi', '<i>Foo</i> and Bar', '<i>Foo</em> and Bar', '<i>😀\ud83d\ude00</i>', '<i>\ud800X</i>']:
            n = len(text)
            inputs = [((0, 1), 'A', 'a'), ((1, n-1), 'B', 'b'), ((n-1, n), 'C', 'c'), ((1, n-1), 'Z', 'z')]
            for mode in ['unchecked', 'skip', 'wrap']:
                for program in ['join', 'empty', 'span', 'reverse', 'bad-first', 'bad-then-raise', 'raise-second', 'subclass']:
                    trace, checks, wrapped, warnings, coercions = [], [], [], [], []
                    def callback(before, span, after):
                        index = len(trace) + 1
                        trace.append({'before': native(before), 'span': native(span), 'after': native(after)})
                        if program in ('bad-then-raise', 'raise-second') and index == 2:
                            raise ValueError('synthetic callback failure')
                        if program in ('bad-first', 'bad-then-raise') and index == 1:
                            return None
                        if program == 'empty':
                            return ''
                        if program == 'join':
                            return before + span + after
                        if program == 'reverse':
                            return after + span[::-1] + before
                        if program == 'subclass':
                            return Subclass(span)
                        return span
                    def observed(span):
                        value = is_balanced_html(span)
                        checks.append({'text': native(span), 'fast': '<' not in span and '>' not in span, 'value': value})
                        return value
                    def observed_wrap(span, before, after):
                        result = wrap_html_tags(span, before, after)
                        wrapped.append({'text': native(span)})
                        return result
                    with patch.object(annotation, 'is_balanced_html', observed), patch.object(annotation, 'wrap_html_tags', observed_wrap):
                        try:
                            result = {'_tag': 'Success', 'text': native(annotation.annotate_citations(text, inputs, unbalanced_tags=mode, annotator=callback))}
                        except (TypeError, ValueError) as error:
                            result = {'_tag': 'Failure', 'kind': type(error).__name__}
                    rows.append({'id': len(rows), 'source': native(text), 'mode': mode, 'program': program,
                                 'input': [{'start': span[0], 'end': span[1], 'before': native(before), 'after': native(after)} for span, before, after in inputs],
                                 'trace': trace, 'checks': checks, 'wrapped': wrapped, 'warnings': warnings, 'coercions': coercions, 'result': result})
    finally:
        annotation.logger.removeHandler(handler)
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    out = {'schemaVersion': 'citation-annotation-callback/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()),
           'annotateSha256': sha((root / 'eyecite/annotate.py').read_bytes()), 'cases': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'cases': len(rows), 'callbacks': sum(len(r['trace']) for r in rows), 'failures': sum(r['result']['_tag']=='Failure' for r in rows), 'parserChecks': sum(not c['fast'] for r in rows for c in r['checks']), 'wraps': sum(len(r['wrapped']) for r in rows), 'coercions': sum(len(r['coercions']) for r in rows)}))


if __name__ == '__main__':
    main()
