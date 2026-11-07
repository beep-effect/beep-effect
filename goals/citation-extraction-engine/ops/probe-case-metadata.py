#!/usr/bin/env python3
"""Observe original FullCaseCitation metadata phase order and model transitions."""
import argparse
from datetime import datetime
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import clean, helpers, models, tokenizers
    ops = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location('operations', ops / 'export-operations.py')
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normalize, _ = operations.make_normalizer(root)
    edition_refs = {id(edition): normalize(edition)['artifactSha256']
                    for extractor in tokenizers.EXTRACTORS for key in ['exact_editions', 'variation_editions']
                    for edition in extractor.extra.get(key, [])}
    ref = lambda edition: None if edition is None else edition_refs[id(edition)]
    sha = lambda data: hashlib.sha256(data).hexdigest()
    repo = ops.parents[2]
    vectors = [
        '<em>Foo v. Bar</em>, 1 U.S. 1',
        '<em>Foo v. Bar</em>, 1 U.S. 1, 2 (2000)',
        '<em>Foo v. Bar</em>, 1 U.S. 1 (2d Cir. 2000) (note)',
        '<em>Foo v. Bar</em>, 1 U.S. 1 (1993-94) (2021 note)',
        '<em>Foo v. see</em>, 1 U.S. 1',
        '<em>see</em>, 1 U.S. 1',
        'Foo v. Bar, 1 F.2d 1 (2d Cir. 2000)',
        'Foo v. Bar, 1 F.2d 1 (1900)',
        'Foo v. Bar, 1 F.2d 1 (2028)',
        'Foo v. Bar, 1 F.2d 1 (1599)',
        'Foo v. Bar, 1 F.2d 1 (٢٠٢٠)',
        'Foo v. Bar, 1 F.2d 1 (January 2, 2000)',
        'Foo at 2, 1 U.S. 1',
        '1 U.S. 1',
        'Foo (2000) 1 U.S. 1',
        'Foo v. Bar, 1 Cranch 1 (1801)',
        '<i>é界😀 v. Bar</i>, 1 U.S. 1 (2000) (é界😀)',
        '<em>Foo</em> v. <em>Bar</em>, 1 U.S. 1, 2 (2000)',
        '<em>Foo v. Bar</em>, 1 U.S. 1 (1600)',
        '<em>Foo v. Bar</em>, 1 U.S. 1 (2027)',
    ]
    snapshots, snapshot_ids, documents, rows = [], {}, [], []
    trace, regex_calls, clock_reads = [], [], []
    active = None

    def snapshot(citation):
        state = {'metadata': {key: native(value) if isinstance(value, str) else value for key, value in vars(citation.metadata).items()},
                 'year': citation.year, 'span': list(citation.span()), 'fullSpanStart': citation.full_span_start,
                 'fullSpanEnd': citation.full_span_end, 'fullSpan': list(citation.full_span()),
                 'exact': [ref(e) for e in citation.exact_editions], 'variation': [ref(e) for e in citation.variation_editions],
                 'allEditions': [ref(e) for e in citation.all_editions], 'editionGuess': ref(citation.edition_guess)}
        key = json.dumps(state, sort_keys=True)
        if key not in snapshot_ids:
            snapshot_ids[key] = len(snapshots)
            snapshots.append(state)
        return snapshot_ids[key]

    def phase(name, original):
        def invoke(citation, *values, **kwargs):
            nonlocal active
            before = snapshot(citation)
            prior, active = active, name
            try:
                return original(citation, *values, **kwargs)
            finally:
                trace.append({'phase': name, 'before': before, 'after': snapshot(citation)})
                active = prior
        return invoke

    regex_originals = {name: getattr(helpers.re, name) for name in ['search', 'match', 'sub', 'split']}
    def regex_call(name):
        def invoke(*values, **kwargs):
            if active is not None:
                if regex_calls and (regex_calls[-1]['phase'], regex_calls[-1]['method']) == (active, name):
                    regex_calls[-1]['count'] += 1
                else:
                    regex_calls.append({'phase': active, 'method': name, 'count': 1})
            return regex_originals[name](*values, **kwargs)
        return invoke

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            clock_reads.append(active)
            return datetime(2026, 11, 6)

    patches = [patch.object(helpers, name, phase(label, getattr(helpers, name))) for name, label in [
        ('add_post_citation', 'Post'), ('find_case_name_in_html', 'HtmlName'), ('find_case_name', 'PlainName'), ('add_pre_citation', 'Pre')]]
    patches.extend([patch.object(models.CaseCitation, 'guess_court', phase('Court', models.CaseCitation.guess_court)),
                    patch.object(models.ResourceCitation, 'guess_edition', phase('Edition', models.ResourceCitation.guess_edition)),
                    patch.object(models, 'datetime', FrozenDateTime), patch.object(helpers, '_highest_valid_year', 2027)])
    patches.extend(patch.object(helpers.re, name, regex_call(name)) for name in regex_originals)
    for current in patches:
        current.start()
    try:
        for vector, markup in enumerate(vectors):
            for has_markup in [False, True]:
                document = models.Document(markup_text=markup, clean_steps=['html']) if has_markup else models.Document(plain_text=clean.clean_text(markup, ['html']))
                document.tokenize(tokenizers.default_tokenizer)
                candidates = [(index, token) for index, token in document.citation_tokens if isinstance(token, models.CitationToken) and not token.short]
                assert len(candidates) == 1, (vector, candidates)
                index, token = candidates[0]
                documents.append({'vector': vector, 'hasMarkup': has_markup, 'markup': native(markup), 'plain': native(document.plain_text), 'index': index,
                                  'words': [{'kind': type(word).__name__, 'data': native(str(word)), 'start': getattr(word, 'start', None),
                                             'groups': {key: native(value) for key, value in getattr(word, 'groups', {}).items()}} for word in document.words]})
                for seeded in [False, True]:
                    citation = models.FullCaseCitation(token, index, exact_editions=token.exact_editions, variation_editions=token.variation_editions,
                        year=1998 if seeded else None, full_span_start=777 if seeded else None, full_span_end=888 if seeded else None,
                        metadata={'plaintiff': 'PRIOR-P', 'defendant': '', 'antecedent_guess': 'PRIOR-A', 'pin_cite': 'PRIOR-PIN',
                                  'court': 'PRIOR-COURT', 'year': 'PRIOR-Y', 'pin_cite_span_start': 11, 'pin_cite_span_end': 12} if seeded else {})
                    initial = snapshot(citation)
                    trace.clear()
                    regex_calls.clear()
                    clock_reads.clear()
                    assert citation.add_metadata(document) is None
                    rows.append({'id': len(rows), 'document': len(documents) - 1, 'seeded': seeded, 'initial': initial,
                                 'final': snapshot(citation), 'trace': list(trace), 'regexCalls': list(regex_calls), 'clockReads': list(clock_reads)})
    finally:
        for current in reversed(patches):
            current.stop()
    versions = {name: importlib.metadata.version(name) for name in ['eyecite', 'regex', 'lxml', 'fast-diff-match-patch', 'reporters-db', 'courts-db']}
    assert {name: versions[name] for name in ['eyecite', 'regex', 'lxml', 'fast-diff-match-patch']} == {'eyecite': '2.7.6', 'regex': '2023.12.25', 'lxml': '5.1.0', 'fast-diff-match-patch': '2.0.1'}
    output = {'schemaVersion': 'citation-case-metadata/v1', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'versions': versions,
              'producerSha256': sha(Path(__file__).read_bytes()), 'normalizerSha256': sha((ops / 'export-operations.py').read_bytes()),
              'sources': {name: sha((root / 'eyecite' / name).read_bytes()) for name in ['models.py', 'helpers.py', 'tokenizers.py', 'clean.py']},
              'licenseSha256': sha((root / 'LICENSE').read_bytes()), 'lockSha256': sha((root / 'uv.lock').read_bytes()),
              'highestValidYear': 2027, 'currentDate': '2026-11-06', 'documents': documents, 'snapshots': snapshots, 'cases': rows,
              'scope': 'Actual built-in FullCaseCitation.add_metadata and all five phase families; no target parity claim or general host/alias qualification.'}
    formatter = ['bunx', '--no-install', 'biome']
    output['formatter'] = subprocess.check_output(formatter + ['--version'], cwd=repo, text=True).strip()
    fixture = repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/case-metadata.json'
    formatted = subprocess.run(formatter + ['format', '--stdin-file-path=' + str(fixture)], input=json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + '\n', cwd=repo, text=True, capture_output=True, check=True).stdout
    args.output.write_text(formatted)
    print(json.dumps({'cases': len(rows), 'documents': len(documents), 'snapshots': len(snapshots), 'regexCalls': sum(call['count'] for row in rows for call in row['regexCalls']),
                      'phaseCounts': {name: sum(item['phase'] == name for row in rows for item in row['trace']) for name in ['Post', 'HtmlName', 'PlainName', 'Pre', 'Court', 'Edition']}}))


if __name__ == '__main__':
    main()
