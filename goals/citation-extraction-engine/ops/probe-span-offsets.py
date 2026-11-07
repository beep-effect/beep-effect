#!/usr/bin/env python3
"""Observe original SpanUpdater construction/lookups and real HTML map geometry."""
import argparse
from bisect import bisect_left, bisect_right
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch


def native(text):
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
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
    from eyecite.annotate import SpanUpdater
    from eyecite import helpers, models, utils
    import fast_diff_match_patch
    assert importlib.metadata.version('fast-diff-match-patch') == '2.0.1'
    sha = lambda data: hashlib.sha256(data).hexdigest()

    def entries(updater):
        return [{'offset': offset, 'kind': 'shift' if update.func.__name__ == 'shift_offset' else 'replace',
                 'value': update.keywords['delta' if update.func.__name__ == 'shift_offset' else 'new_offset']}
                for offset, update in zip(updater.offsets, updater.updaters)]

    def capture(before, after, engine, supplied=None):
        row = {'id': len(maps), 'before': native(before), 'after': native(after), 'engine': engine}
        try:
            if supplied is not None:
                steps = supplied
                with patch.object(SpanUpdater, 'get_diff_steps', return_value=steps):
                    updater = SpanUpdater(before, after)
            else:
                steps = list((SpanUpdater.get_diff_steps if engine == 'dmp' else SpanUpdater.get_diff_steps_builtin)(before, after))
                updater = SpanUpdater(before, after, use_dmp=engine == 'dmp')
        except (UnicodeError, ValueError) as exc:
            row.update(error=type(exc).__name__, steps=[], entries=[], queries=[])
            maps.append(row)
            return row['id']
        positions = sorted(set([-3, -1, 0, 1, len(before), len(before) + 1, len(before) + 3] +
                               list(range(len(before) + 1)) + updater.offsets))
        queries = []
        for position in positions:
            for side, bisect in [('left', bisect_left), ('right', bisect_right)]:
                value, error = None, None
                try:
                    value = updater.update(position, bisect)
                except IndexError:
                    error = 'IndexError'
                queries.append({'position': position, 'side': side, 'value': value, 'error': error})
        row.update(error=None, steps=[{'operation': op, 'amount': amount} for op, amount in steps], entries=entries(updater), queries=queries)
        maps.append(row)
        return row['id']

    pairs = [('', ''), ('', 'x'), ('x', ''), ('a', 'b'), ('foo bar', 'foo baz bar'),
             ('foo baz bar', 'foo bar'), ('abc', 'abc'), ('aaaa', 'aa'), ('ab', 'ba'),
             ('a b c', 'a x b y c'), ('a\nb', 'a b'), ('Ａbc', 'Abc'), ('Á', 'Á'),
             ('😀A', 'A😀'), ('\ud83d\ude00A', 'A\ud83d\ude00'), ('\ud800A', 'A\ud800'),
             ('x\u00a0y', 'x y'), ('abaaba', 'baabaa'), ('  Foo  Bar ', 'Foo Bar')]
    maps = []
    for before, after in pairs:
        for engine in ('dmp', 'builtin'):
            capture(before, after, engine)
    capture('x', 'xy', 'supplied', [('=', 0), ('=', 0), ('+', 1), ('=', 1)])
    capture('x', 'x', 'supplied', [('-', 0), ('=', 1)])
    markup_values = ['<i>Foo</i> v. <em>Bar</em> 1 U.S. 1', '<i>Foo v. Bar</i>, 1 U.S. 1',
                     '<em>In re Smith</em>, 1 U.S. 1', '<I>Foo</I> v. Bar, 1 U.S. 1',
                     '<i>Foo <em>Bar</em></i>, 1 U.S. 1', '<em>Foo\nBar</em>, 1 U.S. 1',
                     '<i class="a>b">Foo</i>, 1 U.S. 1', '<i>Foo</em>, 1 U.S. 1',
                     '<em>😀 v. Bar</em>, 1 U.S. 1', '<i>Foo &amp; Bar</i>, 1 U.S. 1',
                     '<i></i> 1 U.S. 1', '<i>Foo</i><i>Bar</i> 1 U.S. 1',
                     'plain 1 U.S. 1', '<script>hidden</script><i>Foo</i> 1 U.S. 1',
                     '<em id="Foo">Foo</em> v. Bar 1 U.S. 1',
                     '<em title="😀">Foo</em> v. Bar 1 U.S. 1']
    documents = []
    for markup in markup_values:
        document = models.Document(markup_text=markup, clean_steps=['html'])
        placeholder = utils.placeholder_markup(markup)
        forward = capture(document.plain_text, placeholder, 'dmp')
        backward = capture(markup, document.plain_text, 'dmp')
        assert maps[forward]['entries'] == entries(document.plain_to_markup)
        assert maps[backward]['entries'] == entries(document.markup_to_plain)
        tags = lambda values: [{'text': native(text), 'start': start, 'end': end} for text, start, end in values]
        queries = [{'position': position, 'tags': tags(helpers.find_html_tags_at_position(document, position))}
                   for position in range(-2, len(document.plain_text) + 3)]
        conversions = []
        conversion_tags = list(document.emphasis_tags)
        if markup == '<em id="Foo">Foo</em> v. Bar 1 U.S. 1':
            # The public helper accepts supplied tuples. These attribute bounds
            # map to Foo only through the actual original-markup backward map.
            conversion_tags.append(('', 8, 11))
        for tag in conversion_tags:
            text, start, end = helpers.convert_html_to_plain_text_and_loc(document, [tag])
            conversions.append({'tag': tags([tag])[0], 'text': native(text), 'start': start, 'end': end})
        documents.append({'markup': native(markup), 'placeholder': native(placeholder), 'plain': native(document.plain_text),
                          'forwardMap': forward, 'backwardMap': backward, 'tags': tags(document.emphasis_tags),
                          'queries': queries, 'conversions': conversions})
    out = {'schemaVersion': 'citation-span-offsets/v1', 'oracleCommit': pin, 'oracleTree': tree,
           'python': '3.11.15', 'dmp': '2.0.1', 'producerSha256': sha(Path(__file__).read_bytes()),
           'annotateSha256': sha((root / 'eyecite/annotate.py').read_bytes()),
           'dmpModuleSha256': sha(Path(fast_diff_match_patch.__file__).read_bytes()), 'maps': maps, 'documents': documents}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'maps': len(maps), 'constructionErrors': sum(row['error'] is not None for row in maps),
                      'lookups': sum(len(row['queries']) for row in maps), 'documents': len(documents),
                      'tagQueries': sum(len(row['queries']) for row in documents),
                      'conversions': sum(len(row['conversions']) for row in documents)}))


if __name__ == '__main__':
    main()
