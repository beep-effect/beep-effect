#!/usr/bin/env python3
"""Capture actual _extract_full_citation over default-tokenized case/law/journal Documents."""
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
    sha = lambda data: hashlib.sha256(data).hexdigest()
    refs = {id(e): normalize(e)['artifactSha256'] for extractor in tokenizers.EXTRACTORS
            for key in ['exact_editions', 'variation_editions'] for e in extractor.extra.get(key, [])}
    reference = lambda e: None if e is None else refs[id(e)]
    texts = [
        'Foo v. Bar, 1 U.S. 1', 'Foo v. Bar, 1 U.S. 1, 2 (2000)',
        'Foo v. Bar, 1 F.2d 1 (2d Cir. 2000)', 'Foo (2000) 1 U.S. 1',
        '1 U.S. 1', '1 Cranch 1 (1801)',
        '35 U.S.C. § 101', '35 U.S.C. § 101 (2018)',
        '35 U.S.C. § 101(a)(1) (West 2020)', '37 C.F.R. § 1.1 (2020)',
        '42 U.S.C. § 1983 (West 2020) (note)',
        '1 Harv. L. Rev. 1', '1 Harv. L. Rev. 1 (1887)',
        '1 Harv. L. Rev. 1, 2 (2000) (note)',
        'é界😀 v. Bar, 1 U.S. 1 (2000)',
    ]
    rows, used = [], {}
    original_regex = {name: getattr(helpers.re, name) for name in ['search', 'match', 'sub', 'split']}
    original_court = helpers.get_court_by_paren
    calls = []
    in_court = False
    court_calls = 0
    def record(name):
        def invoke(*values, **kwargs):
            nonlocal court_calls
            if in_court:
                court_calls += 1
            else:
                calls.append(name)
            return original_regex[name](*values, **kwargs)
        return invoke
    def court(*values, **kwargs):
        nonlocal in_court
        in_court = True
        try:
            return original_court(*values, **kwargs)
        finally:
            in_court = False
    for text in texts:
        document = models.Document(plain_text=text)
        document.tokenize(tokenizers.default_tokenizer)
        candidates = [(i, t) for i, t in document.citation_tokens if type(t) is models.CitationToken and not t.short]
        assert len(candidates) == 1, (text, candidates)
        index, token = candidates[0]
        exact, variation = [reference(e) for e in token.exact_editions], [reference(e) for e in token.variation_editions]
        for e in token.exact_editions + token.variation_editions:
            used[reference(e)] = e.reporter.source
        calls.clear()
        court_calls = 0
        observers = [patch.object(helpers.re, name, record(name)) for name in original_regex]
        observers.append(patch.object(helpers, 'get_court_by_paren', court))
        for observer in observers:
            observer.start()
        try:
            citation = find._extract_full_citation(document, index)
        finally:
            for observer in reversed(observers):
                observer.stop()
        rows.append({'id': len(rows), 'source': native(text), 'index': index, 'calls': list(calls), 'courtRegexCalls': court_calls,
                     'words': [{'kind': 'Text' if isinstance(w, str) else type(w).__name__, 'data': native(str(w)),
                                'start': getattr(w, 'start', None), 'groups': {k: native(v) for k, v in getattr(w, 'groups', {}).items()}} for w in document.words],
                     'token': {'kind': type(token).__name__, 'data': native(token.data), 'start': token.start, 'end': token.end,
                               'groups': {k: native(v) for k, v in token.groups.items()}, 'exact': exact, 'variation': variation, 'short': token.short},
                     'expected': {'kind': type(citation).__name__, 'metadata': {k: native(v) if isinstance(v, str) else v for k, v in vars(citation.metadata).items()},
                                  'year': citation.year, 'span': list(citation.span()), 'fullSpanStart': citation.full_span_start, 'fullSpanEnd': citation.full_span_end,
                                  'fullSpan': list(citation.full_span()), 'editionGuess': reference(citation.edition_guess)}})
    bindings = [{'id': i, 'ref': ref, 'source': used[ref]} for i, ref in enumerate(sorted(used))]
    ids = {b['ref']: b['id'] for b in bindings}
    for row in rows:
        for field in ['exact', 'variation']:
            row['token'][field] = [ids[ref] for ref in row['token'][field]]
    repo = ops.parents[2]
    output = {'schemaVersion': 'citation-full-extraction/v1', 'oracleCommit': git('rev-parse', 'HEAD'), 'oracleTree': git('rev-parse', 'HEAD^{tree}'),
              'producerSha256': sha(Path(__file__).read_bytes()), 'normalizerSha256': sha((ops / 'export-operations.py').read_bytes()),
              'sources': {name: sha((root / 'eyecite' / name).read_bytes()) for name in ['find.py', 'models.py', 'helpers.py', 'tokenizers.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'lockSha256': sha((root / 'uv.lock').read_bytes()),
              'python': '3.11.15', 'versions': {name: importlib.metadata.version(name) for name in ['eyecite', 'regex', 'lxml', 'reporters-db', 'courts-db']},
              'bindings': bindings, 'cases': rows, 'scope': 'Actual built-in full-citation constructor; no whole get_citations or mutable-host parity claim.'}
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/full-extraction.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path=' + str(fixture)], input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n', cwd=repo, text=True, capture_output=True, check=True).stdout
    args.output.write_text(formatted)
    print(json.dumps({'cases': len(rows), 'bindings': len(bindings), 'calls': sum(len(r['calls']) for r in rows), 'families': {name: sum(r['expected']['kind'] == name for r in rows) for name in ['FullCaseCitation', 'FullLawCitation', 'FullJournalCitation']}}))


if __name__ == '__main__':
    main()
