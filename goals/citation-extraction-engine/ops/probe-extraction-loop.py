#!/usr/bin/env python3
"""Observe actual pinned get_citations, preserving Document and original model identities."""
import argparse
import hashlib
import importlib.metadata
import importlib.util
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
    from eyecite import find, helpers, models, tokenizers
    ops = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location('operations', ops / 'export-operations.py')
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normalize, _ = operations.make_normalizer(root)
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    refs = {id(e): normalize(e)['artifactSha256'] for extractor in tokenizers.EXTRACTORS
            for key in ['exact_editions', 'variation_editions'] for e in extractor.extra.get(key, [])}
    reference = lambda e: None if e is None else refs[id(e)]
    used = {}
    def token_snapshot(token):
        exact = getattr(token, 'exact_editions', [])
        variation = getattr(token, 'variation_editions', [])
        for e in exact + variation:
            used[reference(e)] = e.reporter.source
        return {'kind': type(token).__name__, 'data': native(token.data), 'start': token.start, 'end': token.end,
                'groups': {k: native(v) for k, v in token.groups.items()},
                'exact': [reference(e) for e in exact], 'variation': [reference(e) for e in variation],
                'short': getattr(token, 'short', False)}
    def snapshot(citation):
        return {'kind': type(citation).__name__, 'index': citation.index, 'token': token_snapshot(citation.token),
                'metadata': {k: native(v) if isinstance(v, str) else v for k, v in vars(citation.metadata).items()},
                'span': list(citation.span()), 'fullSpanStart': citation.full_span_start,
                'fullSpanEnd': citation.full_span_end, 'fullSpan': list(citation.full_span()),
                'year': getattr(citation, 'year', None), 'editionGuess': reference(getattr(citation, 'edition_guess', None)),
                'documentAttached': citation.document is not None}
    texts = [
        'No legal citations here.',
        'Foo v. Bar, 1 U.S. 1 (2000)',
        'Foo v. Bar, 1 U.S. 1 (2000). Id. at 2.',
        'Foo v. Bar, 1 U.S. 1 (2000). Foo at 2.',
        'Foo v. Bar, 1 U.S. 1 (2000). Bar at 2. Foo at 3.',
        'Foo v. Bar, 1 U.S. 1, 2 F.2d 3 (2000). Id.',
        'Foo v. Bar, 1 U.S. 1 (2000); Baz v. Qux, 2 U.S. 3 (2001). Baz at 4.',
        'Foo v. Bar, 1 U.S. 1 (2000). Foo, 1 U.S., at 2.',
        'Foo v. Bar, 1 U.S. 1 (2000). Foo, supra, at 2.',
        'Id. at 2. Ibid. Foo, supra, at 3. § 12.',
        '35 U.S.C. § 101 (2018); 37 C.F.R. § 1.1 (2020). Id.',
        '1 Harv. L. Rev. 1, 2 (2000) (note).',
        '1 Cranch 1 (1801). 1 F. 1.',
        'é界😀 v. Bar, 1 U.S. 1 (2000). Bar at 2.',
        'Foo v. Bar, 1 U.S. 1 (2000) (note). Id. at 2 (other).',
        '1 U.S. 1; 1 U.S. 1; 1 U.S. 1.',
    ]
    definitions = [{'plain_text': text, 'remove_ambiguous': remove} for text in texts for remove in [False, True]]
    for body in ['<em>Foo</em> at 2.', '<i>Bar</i> then <em>Foo</em>.', '<em>Foo</em> v. Other', '<em>Foo</i> at 2.']:
        definitions.append({'markup_text': '<p><i>Foo</i> v. Bar, 1 U.S. 1 (2000). '+body+'</p>', 'clean_steps': ['html'], 'remove_ambiguous': False})
    rows = []
    original_tokenize, original_filter = models.Document.tokenize, find.filter_citations
    for definition in definitions:
        documents, before, selected, warnings = [], [], [], []
        def tokenize(document, *args, **kwargs):
            result = original_tokenize(document, *args, **kwargs)
            documents.append(document)
            return result
        def filter_citations(citations):
            before.extend(citations)
            result = original_filter(citations)
            selected.extend(next(i for i, original in enumerate(citations) if original is item) for item in result)
            return result
        def warning(message, last, current):
            assert message == 'Unknown overlap case. Last cite: %s. Current: %s'
            warnings.append([next(i for i, item in enumerate(before) if item is last), next(i for i, item in enumerate(before) if item is current)])
        with patch.object(models.Document, 'tokenize', tokenize), patch.object(find, 'filter_citations', filter_citations), patch.object(helpers.logger, 'warning', warning):
            result = find.get_citations(**definition)
        assert len(documents) == 1
        document = documents[0]
        tokens = [{'index': i, 'token': token_snapshot(token)} for i, token in document.citation_tokens]
        rows.append({'id': len(rows), 'plain': native(document.plain_text), 'markup': native(document.markup_text or ''),
                     'removeAmbiguous': definition['remove_ambiguous'],
                     'words': [{'kind': 'Text' if isinstance(w, str) else type(w).__name__, 'data': native(str(w)),
                                'start': getattr(w, 'start', None), 'groups': {k: native(v) for k, v in getattr(w, 'groups', {}).items()}} for w in document.words],
                     'tokens': tokens, 'before': [snapshot(c) for c in before], 'selected': selected,
                     'returned': [next(i for i, original in enumerate(before) if original is item) for item in result],
                     'warnings': warnings, 'expected': [snapshot(c) for c in result]})
    bindings = [{'id': i, 'ref': ref, 'source': used[ref]} for i, ref in enumerate(sorted(used))]
    ids = {b['ref']: b['id'] for b in bindings}
    for row in rows:
        for token in [x['token'] for x in row['tokens']] + [x['token'] for field in ['before', 'expected'] for x in row[field]]:
            for key in ['exact', 'variation']:
                token[key] = [ids[ref] for ref in token[key]]
    output = {'schemaVersion': 'citation-extraction-loop/v1', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'),
              'producerSha256': sha(Path(__file__).read_bytes()), 'normalizerSha256': sha((ops / 'export-operations.py').read_bytes()),
              'sources': {name: sha((root / 'eyecite' / name).read_bytes()) for name in ['find.py', 'models.py', 'helpers.py', 'tokenizers.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'lockSha256': sha((root / 'uv.lock').read_bytes()),
              'python': '3.11.15', 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'regex', 'lxml', 'reporters-db', 'courts-db']},
              'bindings': bindings, 'cases': rows,
              'scope': 'Actual builtin get_citations loop; prepared Document/token inputs for target replay. Joke shortcut, custom hosts/tokenizers, normalization and broad API acceptance remain separate.'}
    repo = ops.parents[2]
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/extraction-loop.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path='+str(fixture)], input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2)+'\n', cwd=repo, text=True, capture_output=True, check=True).stdout
    args.output.write_text(formatted)
    print(json.dumps({'cases': len(rows), 'bindings': len(bindings), 'before': sum(len(r['before']) for r in rows), 'returned': sum(len(r['expected']) for r in rows)}))


if __name__ == '__main__':
    main()
