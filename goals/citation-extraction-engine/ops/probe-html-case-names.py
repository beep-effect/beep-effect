#!/usr/bin/env python3
"""Observe original HTML case-name mutation, helper order and geometry calls.

Free Law Project eyecite, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
This producer calls the pinned implementation; it supplies no target algorithm.
"""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(value):
    if value is None:
        return None
    width = 1 if max(map(ord, value), default=0) <= 255 else 2 if max(map(ord, value), default=0) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in value).hex()}


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
    from eyecite import helpers, models, tokenizers
    versions = {name: importlib.metadata.version(name) for name in ['eyecite', 'lxml', 'regex', 'fast-diff-match-patch']}
    assert versions == {'eyecite': '2.7.6', 'lxml': '5.1.0', 'regex': '2023.12.25', 'fast-diff-match-patch': '2.0.1'}
    sha = lambda data: hashlib.sha256(data).hexdigest()
    original_find = helpers.find_html_tags_at_position
    original_convert = helpers.convert_html_to_plain_text_and_loc
    original_clean = helpers.strip_stop_words
    branches = ['_extract_short_citation_name', '_extract_plaintiff_defendant_from_versus',
                '_extract_from_single_html_element', '_extract_from_separate_html_elements',
                '_extract_defendant_after_stopword']
    originals = {name: getattr(helpers, name) for name in branches}
    calls = []

    def tags(values):
        return [{'text': native(text), 'start': start, 'end': end} for text, start, end in values]

    def find(document, position):
        row = {'operation': 'find', 'position': position}
        calls.append(row)
        result = original_find(document, position)
        row['tags'] = tags(result)
        return result

    def convert(document, values):
        row = {'operation': 'convert', 'tags': tags(values)}
        calls.append(row)
        result = original_convert(document, values)
        row['result'] = {'text': native(result[0]), 'start': result[1], 'end': result[2]}
        return result

    def clean(value):
        row = {'operation': 'clean', 'source': native(value)}
        calls.append(row)
        result = original_clean(value)
        row['result'] = native(result)
        return result

    def branch(name):
        def invoke(*values, **kwargs):
            calls.append({'operation': 'branch', 'name': name})
            return originals[name](*values, **kwargs)
        return invoke

    def snapshot(citation):
        return {'metadata': {key: native(value) if isinstance(value, str) else value
                             for key, value in vars(citation.metadata).items()},
                'fullSpanStart': citation.full_span_start, 'fullSpanEnd': citation.full_span_end,
                'span': list(citation.span()), 'fullSpan': list(citation.full_span())}

    citation_text = '1 U.S. 1'
    templates = [
        '<em>Foo v. Bar</em>, {cite}', '<em>Foo</em> v. <i>Bar</i>, {cite}',
        'Foo v. Bar, {cite}', '<em>Foo</em> v. Bar, {cite}', 'Foo v. <em>Bar</em>, {cite}',
        '<em>In Foo v. Bar</em>, {cite}', '<em>((Foo), v. Bar),</em>, {cite}',
        '<em>Foo vs Bar</em>, {cite}', '<em>Foo V. Bar</em>, {cite}',
        'In re <em>Foo</em>, {cite}', 'see <em>Foo</em>, {cite}', 'ex rel. <em>Foo</em>, {cite}',
        '<em>Foo</em>, {cite}', '<em>Foo, {cite}</em>', '<em>Foo</em> {cite} <i>Later</i>',
        '<em><i>Foo</i> v. Bar</em>, {cite}', '<i>Foo <em>v.</em> Bar</i>, {cite}',
        '<em title="Foo">Foo v. Bar</em>, {cite}', '<em title="😀">Foo v. Bar</em>, {cite}',
        '<EM>Foo v. Bar</EM>, {cite}', '<em>Éclair v. 𐐀abc</em>, {cite}',
        '<em>Foo\n v.\tBar</em>, {cite}', '<em>Foo; Second v. Bar</em>, {cite}',
        '<em>Foo &amp; Co. v. Bar</em>, {cite}', '<em></em> {cite}',
        '<em>Foo</em>\t{cite}', '<em>Foo</em>,, {cite}', 'v. <em>Bar</em>, {cite}',
        '<em>Foo v. Bar, {cite}</em>', '<em>In re Foo, {cite}</em>',
        '<em>Foo</em>' + ' X' * 15 + ' {cite}',
        '<em>Foo</em>' + ' X' * 14 + ' {cite}',
    ]
    rows = []
    for template in templates:
        markup = template.format(cite=citation_text)
        for short in [False, True]:
            for seeded in [False, True]:
                document = models.Document(markup_text=markup, clean_steps=['html'])
                document.tokenize(tokenizers.default_tokenizer)
                candidates = [(index, token) for index, token in document.citation_tokens
                              if isinstance(token, models.CitationToken) and str(token) == citation_text]
                assert len(candidates) == 1, (markup, candidates)
                index, token = candidates[0]
                cls = models.ShortCaseCitation if short else models.FullCaseCitation
                citation = cls(token, index, full_span_start=777 if seeded else None,
                               full_span_end=888 if seeded else None)
                if seeded:
                    citation.metadata.plaintiff = 'PRIOR-P'
                    citation.metadata.defendant = 'PRIOR-D'
                    if short:
                        citation.metadata.antecedent_guess = 'PRIOR-A'
                before = snapshot(citation)
                calls.clear()
                error = None
                with patch.object(helpers, 'find_html_tags_at_position', find), \
                     patch.object(helpers, 'convert_html_to_plain_text_and_loc', convert), \
                     patch.object(helpers, 'strip_stop_words', clean):
                    patches = [patch.object(helpers, name, branch(name)) for name in branches]
                    for current in patches:
                        current.start()
                    try:
                        assert helpers.find_case_name_in_html(citation, document, short) is None
                    except (TypeError, ValueError, IndexError, AttributeError, KeyError) as exc:
                        error = type(exc).__name__
                    finally:
                        for current in reversed(patches):
                            current.stop()
                rows.append({'id': len(rows), 'markup': native(markup), 'plain': native(document.plain_text),
                             'tags': tags(document.emphasis_tags), 'short': short, 'seeded': seeded,
                             'index': index, 'words': [{'kind': type(word).__name__, 'text': native(str(word)),
                                                       'start': getattr(word, 'start', None), 'end': getattr(word, 'end', None),
                                                       'groups': {key: native(value) for key, value in getattr(word, 'groups', {}).items()}}
                                                      for word in document.words],
                             'before': before, 'after': snapshot(citation), 'error': error, 'calls': list(calls)})
    reached = {call['name'] for row in rows for call in row['calls'] if call['operation'] == 'branch'}
    assert reached == set(branches), reached
    repo_root = Path(__file__).resolve().parents[3]
    formatter = ['bunx', '--no-install', 'biome']
    output = {'schemaVersion': 'citation-html-case-names/v1', 'oracleCommit': PIN, 'oracleTree': TREE,
              'producerSha256': sha(Path(__file__).read_bytes()), 'python': sys.version.split()[0], 'versions': versions,
              'formatter': subprocess.check_output(formatter + ['--version'], text=True, cwd=repo_root).strip(),
              'sources': {name: sha((root / 'eyecite' / name).read_bytes())
                          for name in ['helpers.py', 'models.py', 'tokenizers.py', 'utils.py', 'annotate.py', 'clean.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'cases': rows,
              'scope': 'Original built-in HTML helper observations; target composition, general host protocols and exhaustive engine parity remain unproved.'}
    fixture = repo_root / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-case-names.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path=' + str(fixture)],
                               input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n',
                               text=True, capture_output=True, check=True, cwd=repo_root).stdout
    args.output.write_text(formatted)
    print(f'Captured {len(rows)} original HTML case-name calls; {len(reached)} extraction branches; no target proof')


if __name__ == '__main__':
    main()
