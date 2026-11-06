#!/usr/bin/env python3
"""Observe actual Document mode branches, step mutation and phase ordering."""
import argparse
import hashlib
import inspect
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(value):
    maximum = max(map(ord, value), default=0)
    width = 1 if maximum <= 255 else 2 if maximum <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in value).hex()}


def value(data):
    if isinstance(data, str):
        return {'kind': 'unicode', 'native': native(data)}
    if data is None:
        return {'kind': 'none'}
    raise AssertionError(type(data).__name__)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    dependencies = {name: importlib.metadata.version(name) for name in ['lxml', 'fast-diff-match-patch']}
    assert dependencies == {'lxml': '5.1.0', 'fast-diff-match-patch': '2.0.1'}
    sys.path.insert(0, str(root))
    from eyecite import models, utils
    original_clean, original_diff = models.clean_text, models.SpanUpdater
    original_placeholder, original_emphasis = utils.placeholder_markup, models.Document.identify_emphasis_tags
    rows = []
    for plain, markup in [('', ''), ('A__ B', ''), ('', '<em>Foo</em>'),
                          ('Foo', '<em>Foo</em>'), ('', None), ('A__ B', None),
                          ('\ud83d\ude00__A', ''), ('', '<em title="😀">Foo</em>')]:
        for kind in ['default', 'list-empty', 'list-html', 'list-underscores',
                     'tuple-empty', 'tuple-html', 'none', 'generator-empty',
                     'generator-html', 'callback-none', 'callback-identity',
                     'list-permissive', 'list-false', 'list-truth-error']:
            events, maps = [], []

            class Steps(list):
                def __bool__(self):
                    events.append('steps:truth')
                    if kind == 'list-truth-error':
                        raise RuntimeError('source protocol control')
                    if kind == 'list-false':
                        return False
                    return list.__len__(self) != 0

                def __contains__(self, item):
                    events.append('steps:contains:' + item)
                    return list.__contains__(self, item)

                def insert(self, index, item):
                    events.append('steps:insert:' + str(index) + ':' + str(item))
                    if kind == 'list-permissive':
                        return None
                    return list.insert(self, index, item)

                def __iter__(self):
                    events.append('steps:iter')
                    return list.__iter__(self)

            def callback(text):
                events.append(kind)
                return None if kind == 'callback-none' else text

            definitions = {'list-empty': lambda: Steps(), 'list-html': lambda: Steps(['html']),
                           'list-underscores': lambda: Steps(['underscores']),
                           'tuple-empty': lambda: (), 'tuple-html': lambda: ('html',),
                           'none': lambda: None, 'generator-empty': lambda: iter(x for x in []),
                           'generator-html': lambda: iter(x for x in ['html']),
                           'callback-none': lambda: Steps([callback]), 'callback-identity': lambda: Steps([callback]),
                           'list-permissive': lambda: Steps(), 'list-false': lambda: Steps(['underscores']),
                           'list-truth-error': lambda: Steps(['html']),
                           'default': lambda: None}
            steps = definitions[kind]()
            kwargs = {'plain_text': plain, 'markup_text': markup}
            if kind != 'default':
                kwargs['clean_steps'] = steps

            def clean(text, program):
                events.append('clean:start')
                result = original_clean(text, program)
                events.append('clean:end')
                return result

            def diff(before, after):
                events.append('diff:' + str(len(maps)))
                maps.append({'before': value(before), 'after': value(after)})
                return original_diff(before, after)

            def placeholder(text):
                events.append('placeholder')
                return original_placeholder(text)

            def emphasis(document):
                events.append('emphasis')
                return original_emphasis(document)

            document = object.__new__(models.Document)
            error = None
            with patch.object(models, 'clean_text', clean), patch.object(models, 'SpanUpdater', diff), \
                 patch.object(utils, 'placeholder_markup', placeholder), \
                 patch.object(models.Document, 'identify_emphasis_tags', emphasis), \
                 patch.object(models.logger, 'warning', lambda *_: events.append('warning:html-added')):
                try:
                    models.Document.__init__(document, **kwargs)
                except Exception as exc:
                    error = type(exc).__name__
            tokens = lambda xs: [x if isinstance(x, str) else 'callback' for x in xs]
            if isinstance(document.clean_steps, list):
                after = {'kind': 'list', 'items': tokens(list.__iter__(document.clean_steps))}
            elif isinstance(document.clean_steps, tuple):
                after = {'kind': 'tuple', 'items': tokens(document.clean_steps)}
            elif inspect.isgenerator(document.clean_steps):
                after = {'kind': 'generator', 'state': inspect.getgeneratorstate(document.clean_steps)}
            else:
                assert document.clean_steps is None
                after = {'kind': 'none'}
            rows.append({'id': len(rows), 'plainInput': value(plain), 'markupInput': value(markup),
                         'stepsKind': kind, 'error': error, 'events': events, 'maps': maps,
                         'plain': value(document.plain_text), 'source': value(document.source_text),
                         'sourceIsPlainInput': document.source_text is plain,
                         'sourceIsMarkupInput': document.source_text is markup,
                         'plainIsPlainInput': document.plain_text is plain,
                         'stepsIsInput': kind != 'default' and document.clean_steps is steps,
                         'stepsAfter': after,
                         'hasForward': document.plain_to_markup is not None,
                         'hasBackward': document.markup_to_plain is not None,
                         'emphasis': [{'text': native(text), 'start': start, 'end': end}
                                      for text, start, end in document.emphasis_tags]})
    sha = lambda data: hashlib.sha256(data).hexdigest()
    assert len(rows) == 112 and sum(row['error'] is None for row in rows) == 55
    assert rows[29]['error'] == 'TypeError' and rows[29]['events'] == ['steps:contains:html', 'steps:insert:html:0']
    assert rows[39]['error'] is None and rows[39]['stepsAfter'] == {'kind': 'list', 'items': []}
    assert rows[39]['events'][2:4] == ['warning:html-added', 'clean:start']
    assert rows[36]['plain'] == rows[36]['markupInput'] and rows[36]['stepsAfter']['state'] == 'GEN_CLOSED'
    assert rows[49]['error'] == 'ValueError' and rows[49]['stepsAfter']['state'] == 'GEN_CREATED'
    assert rows[23]['error'] is None and rows[23]['plain'] == {'kind': 'none'}
    repo_root = Path(__file__).resolve().parents[3]
    command = ['bunx', '--no-install', 'biome']
    output = {'schemaVersion': 'citation-document-input-modes/v1', 'oracleCommit': PIN, 'oracleTree': TREE,
              'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()),
              'dependencies': dependencies,
              'formatter': subprocess.check_output(command + ['--version'], text=True, cwd=repo_root).strip(),
              'sources': {name: sha((root / name).read_bytes()) for name in ['eyecite/models.py', 'eyecite/clean.py', 'eyecite/utils.py']},
              'cases': rows}
    fixture_path = repo_root / 'packages/law-practice/use-cases/test/fixtures/eyecite/document-input-modes.json'
    formatted = subprocess.run(command + ['format', '--stdin-file-path=' + str(fixture_path)],
                               input=json.dumps(output, sort_keys=True, ensure_ascii=True, indent=2) + '\n',
                               text=True, capture_output=True, check=True, cwd=repo_root).stdout
    args.output.write_text(formatted)
    print(json.dumps({'cases': len(rows), 'errors': sum(row['error'] is not None for row in rows),
                      'fixtureSha256': sha(args.output.read_bytes())}))


if __name__ == '__main__':
    main()
