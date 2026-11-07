#!/usr/bin/env python3
"""Observe the actual get_citations shortcut, ignored arguments and shared identity."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == ('04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import find, helpers, get_citations
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    citation = helpers.joke_cite[0]
    snapshot = {'kind': type(citation).__name__, 'index': citation.index,
                'token': {'kind': type(citation.token).__name__, 'data': native(citation.token.data), 'start': citation.token.start, 'end': citation.token.end,
                          'groups': {k: native(v) for k, v in citation.token.groups.items()}, 'exact': [], 'variation': [], 'short': citation.token.short},
                'metadata': {k: native(v) if isinstance(v, str) else v for k, v in vars(citation.metadata).items()},
                'year': citation.year, 'span': list(citation.span()), 'fullSpan': list(citation.full_span()),
                'fullSpanStart': citation.full_span_start, 'fullSpanEnd': citation.full_span_end,
                'editionGuess': citation.edition_guess, 'documentAttached': citation.document is not None,
                'groupsAliasToken': citation.groups is citation.token.groups}
    rows = []
    original = find.Document
    class Poison:
        def __bool__(self):
            raise AssertionError('shortcut evaluated ignored truth')
        def __iter__(self):
            raise AssertionError('shortcut iterated ignored steps')
    definitions = [
        ('plain', {'plain_text': 'eyecite'}),
        ('ambiguous', {'plain_text': 'eyecite', 'remove_ambiguous': True}),
        ('ignored-poison', {'plain_text': 'eyecite', 'markup_text': Poison(), 'clean_steps': Poison(), 'remove_ambiguous': Poison(), 'tokenizer': Poison()}),
        ('ignored-none', {'plain_text': 'eyecite', 'markup_text': None, 'clean_steps': None, 'tokenizer': None}),
    ]
    for text in ['eyecite ', ' eyecite', 'Eyecite', 'EYECITE', 'eyecite\n', 'eyecite\u0000', 'eyecite😀', '', None]:
        definitions.append(('control', {'plain_text': text}))
    definitions.extend([('defaults', {}), ('markup-default-steps', {'markup_text': '<p>Text</p>'}), ('plain-default-steps', {'plain_text': '35 U.S.C. § 101'})])
    for label, kwargs in definitions:
        events = []
        def document(*args, **kwargs):
            events.append('Document')
            return original(*args, **kwargs)
        with patch.object(find, 'Document', document):
            try:
                result = get_citations(**kwargs)
                error = None
            except Exception as exc:
                result, error = None, type(exc).__name__
        rows.append({'id': len(rows), 'label': label, 'plain': kwargs.get('plain_text', ''), 'shortcut': result is helpers.joke_cite,
                     'sameCitation': result is not None and len(result) == 1 and result[0] is citation,
                     'events': events, 'error': error})
    ops = Path(__file__).resolve().parent
    repo = ops.parents[2]
    output = {'schemaVersion': 'citation-extraction-shortcut/v1', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'),
              'producerSha256': sha(Path(__file__).read_bytes()), 'sources': {name: sha((root / 'eyecite' / name).read_bytes()) for name in ['find.py', 'helpers.py', 'models.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'lockSha256': sha((root / 'uv.lock').read_bytes()),
              'python': '3.11.15', 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'regex', 'lxml', 'reporters-db', 'courts-db']},
              'snapshot': snapshot, 'cases': rows,
              'scope': 'Actual primitive-string shortcut and bypass order; arbitrary equality overrides and mutable host/model behavior remain open.'}
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/extraction-shortcut.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path='+str(fixture)], input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2)+'\n', cwd=repo, text=True, capture_output=True, check=True).stdout
    args.output.write_text(formatted)
    print(json.dumps({'cases': len(rows), 'shortcuts': sum(r['shortcut'] for r in rows), 'sharedList': True, 'sharedCitation': True}))


if __name__ == '__main__':
    main()
