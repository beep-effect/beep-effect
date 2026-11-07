#!/usr/bin/env python3
"""Observe actual full/short callers selecting HTML names and plain fallback."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

HTML_SHA = 'e6231633d7a3d4115295517539aecda42045ce2a8253f565f9db86dacfcf1670'


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def restore(value):
    data, width = bytes.fromhex(value['bytes']), value['width']
    return ''.join(chr(int.from_bytes(data[index:index + width], 'little')) for index in range(0, len(data), width))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (
        '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e', 'a35a58fac03400f71a93a93485b77f1d56f2b02f', '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import clean, find, helpers, models, tokenizers
    sha = lambda data: hashlib.sha256(data).hexdigest()
    repo = Path(__file__).resolve().parents[3]
    dependency = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-case-names.json'
    assert sha(dependency.read_bytes()) == HTML_SHA
    html = json.loads(dependency.read_bytes())
    templates = [restore(row['markup']).replace('1 U.S. 1', '{cite}') for row in html['cases'][::4]]
    templates.extend(['<em>Foo v. see</em>, {cite}', '<em>see</em>, {cite}'])
    original_html, original_plain = helpers.find_case_name_in_html, helpers.find_case_name
    regex_originals = {name: getattr(helpers.re, name) for name in ['search', 'match', 'sub', 'split']}
    before_names = after_names = None
    trace, calls = [], []
    active = False

    def snapshot(citation):
        return {'metadata': {key: native(value) if isinstance(value, str) else value for key, value in vars(citation.metadata).items()},
                'year': citation.year, 'span': list(citation.span()), 'fullSpanStart': citation.full_span_start,
                'fullSpanEnd': citation.full_span_end, 'fullSpan': list(citation.full_span())}

    def name_helper(name, original):
        def invoke(citation, document, *values, **kwargs):
            nonlocal before_names, after_names, active
            if before_names is None:
                before_names = snapshot(citation)
            trace.append(name)
            active = True
            try:
                return original(citation, document, *values, **kwargs)
            finally:
                active = False
                after_names = snapshot(citation)
        return invoke

    def regex_call(name):
        def invoke(*values, **kwargs):
            if active:
                calls.append(name)
            return regex_originals[name](*values, **kwargs)
        return invoke

    rows, documents, document_ids = [], [], {}
    for vector, template in enumerate(templates):
        for short in [False, True]:
            text = '1 U.S., at 2' if short else '1 U.S. 1'
            markup = template.format(cite=text)
            for has_markup in [False, True]:
                for prior in ([None] if short else [None, '', 'PRIOR-D']):
                    document = models.Document(markup_text=markup, clean_steps=['html']) if has_markup else models.Document(plain_text=clean.clean_text(markup, ['html']))
                    document.tokenize(tokenizers.default_tokenizer)
                    candidates = [(index, token) for index, token in document.citation_tokens
                                  if isinstance(token, models.CitationToken) and str(token) == text and token.short == short]
                    assert len(candidates) == 1, (markup, candidates)
                    index, token = candidates[0]
                    source = {'vector': vector, 'short': short, 'markup': native(markup), 'plain': native(document.plain_text),
                              'index': index, 'words': [{'kind': type(word).__name__, 'data': native(str(word)), 'start': getattr(word, 'start', None),
                                                       'groups': {key: native(value) for key, value in getattr(word, 'groups', {}).items()}}
                                                      for word in document.words]}
                    key = (vector, short)
                    if key not in document_ids:
                        document_ids[key] = len(documents)
                        documents.append(source)
                    else:
                        assert source == documents[document_ids[key]]
                    before_names = after_names = None
                    trace.clear()
                    calls.clear()
                    patches = [patch.object(module, name, name_helper(label, original))
                               for module in [helpers, find]
                               for name, label, original in [('find_case_name_in_html', 'html', original_html), ('find_case_name', 'plain', original_plain)]]
                    patches.extend(patch.object(helpers.re, name, regex_call(name)) for name in regex_originals)
                    for current in patches:
                        current.start()
                    try:
                        if short:
                            citation = find._extract_shortform_citation(document, index)
                        else:
                            citation = models.FullCaseCitation(token, index, exact_editions=token.exact_editions,
                                                              variation_editions=token.variation_editions,
                                                              metadata={'plaintiff': 'PRIOR-P', 'defendant': prior}, year=1998)
                            citation.add_metadata(document)
                    finally:
                        for current in reversed(patches):
                            current.stop()
                    assert before_names is not None and after_names is not None
                    rows.append({'id': len(rows), 'document': document_ids[key], 'mode': 'Short' if short else 'Full',
                                 'hasMarkup': has_markup, 'before': before_names, 'after': after_names,
                                 'final': snapshot(citation), 'trace': list(trace), 'regexCalls': list(calls)})
    versions = {name: importlib.metadata.version(name) for name in ['eyecite', 'lxml', 'regex', 'fast-diff-match-patch', 'reporters-db', 'courts-db']}
    assert {name: versions[name] for name in ['eyecite', 'lxml', 'regex', 'fast-diff-match-patch']} == {
        'eyecite': '2.7.6', 'lxml': '5.1.0', 'regex': '2023.12.25', 'fast-diff-match-patch': '2.0.1'}
    output = {'schemaVersion': 'citation-case-name-selection/v1', 'oracleCommit': html['oracleCommit'], 'oracleTree': html['oracleTree'],
              'producerSha256': sha(Path(__file__).read_bytes()), 'htmlSha256': HTML_SHA, 'python': '3.11.15', 'versions': versions,
              'sources': {name: sha((root / 'eyecite' / name).read_bytes()) for name in ['models.py', 'find.py', 'helpers.py', 'tokenizers.py', 'clean.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'lockSha256': sha((root / 'uv.lock').read_bytes()),
              'documents': documents, 'cases': rows, 'scope': 'Original built-in callers; only name-phase snapshots qualify the target selector. Final metadata phases and general host mutation remain separate.'}
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/case-name-selection.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path=' + str(fixture)], input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n', cwd=repo, text=True, capture_output=True, check=True).stdout
    args.output.write_text(formatted)
    print(json.dumps({'cases': len(rows), 'documents': len(documents), 'html': sum('html' in row['trace'] for row in rows),
                      'plain': sum('plain' in row['trace'] for row in rows), 'regexCalls': sum(len(row['regexCalls']) for row in rows)}))


if __name__ == '__main__':
    main()
