#!/usr/bin/env python3
"""Observe original case-name processing and ordered stop-word substitutions.

Free Law Project eyecite behavior, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
This producer is source evidence, not a target implementation or parity claim.
"""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import sys
from unittest.mock import patch

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
SCAN = '9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553'


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def restore(value):
    if value is None:
        return None
    width, data = value['width'], bytes.fromhex(value['bytes'])
    return ''.join(chr(int.from_bytes(data[i:i + width], 'little')) for i in range(0, len(data), width))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--fixture-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    import regex
    from eyecite import helpers, models, regexes
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    sha = lambda b: hashlib.sha256(b).hexdigest()
    scan_bytes = args.fixture_root.joinpath('case-name-scan.json').read_bytes()
    assert sha(scan_bytes) == SCAN
    scan = json.loads(scan_bytes)
    patterns = {'stopWords': regexes.STOP_WORD_REGEX, 'leadingIn': r'^(?i)In\s+',
                'splitV': r'\s+v\.?\s+', 'lowercase': r'\b[a-z]\w*\b'}
    pattern_names = {text: name for name, text in patterns.items()}
    grammar = []
    for name, text in patterns.items():
        for flags in ((0, 2) if name == 'stopWords' else (0,)):
            for engine_name, engine in (('python-re', re), ('python-regex-v0', regex)):
                outcome = {'pattern': name, 'flags': flags, 'engine': engine_name}
                try:
                    compiled = engine.compile(text, flags)
                    outcome.update(error=None, groups=compiled.groups, names=dict(compiled.groupindex),
                                   effectiveFlags=int(compiled.flags))
                except (re.error, regex.error) as exc:
                    outcome['error'] = type(exc).__name__
                grammar.append(outcome)
    calls = []
    original_sub, original_split = helpers.re.sub, helpers.re.split

    def sub(pattern, replacement, source, count=0, flags=0):
        row = {'operation': 'sub', 'pattern': pattern_names[pattern], 'replacement': native(replacement),
               'source': native(source), 'count': count, 'flags': int(flags)}
        calls.append(row)
        result = original_sub(pattern, replacement, source, count=count, flags=flags)
        row['result'] = native(result)
        return result

    def split(pattern, source, maxsplit=0, flags=0):
        row = {'operation': 'split', 'pattern': pattern_names[pattern], 'source': native(source),
               'maxsplit': maxsplit, 'flags': int(flags)}
        calls.append(row)
        result = original_split(pattern, source, maxsplit=maxsplit, flags=flags)
        row['result'] = [native(value) for value in result]
        return result

    # Preserve consumed whitespace, punctuation, alternation order, Unicode case
    # equivalence, semicolon selection and unpaired versus paired surrogates.
    texts = ['', ' ', 'In Smith', 'IN Smith', 'in Smith', 'In\nSmith', 'İn Smith', 'ın Smith',
             '(Smith)', '((Smith))', 'Smith;Jones;Third', ';Jones', 'Smith;', ';;',
             ', (Smith), ', 'Smith v Jones', 'v v Smith', 'see see Smith', 'see also Smith',
             '😀', '\ud83d\ude00', '\ud800', 'e\u0301', '\u200b Smith \u200b']
    for word in regexes.STOP_WORDS:
        texts.extend([word, word.upper(), word + ' Smith', word.upper() + ' Smith',
                      'Smith ' + word, '(' + word + '), Smith', word + ' ' + word + ' Smith',
                      'X' + word + ' Smith'])
    texts.extend(space + 'In' + space + 'Smith' + space for space in map(chr, range(0x110000)) if space.isspace())
    texts = list(dict.fromkeys(texts))
    strips = []
    for text in texts:
        calls.clear()
        with patch.object(helpers.re, 'sub', sub):
            result = helpers.strip_stop_words(text)
        assert len(calls) == 3
        strips.append({'id': len(strips), 'source': native(text), 'result': native(result), 'calls': list(calls)})

    def observe(cite):
        return {'metadata': {key: native(value) if isinstance(value, str) else value
                             for key, value in vars(cite.metadata).items()},
                'year': cite.year, 'fullSpanStart': cite.full_span_start,
                'fullSpanEnd': cite.full_span_end, 'span': list(cite.span()), 'fullSpan': list(cite.full_span())}

    def process(words, index, state, short, seeded, span_start, scan_id=None):
        token = models.CitationToken('1 X 1', 100, 105, {'volume': '1', 'reporter': 'X', 'page': '1'})
        cls = models.ShortCaseCitation if short else models.FullCaseCitation
        metadata = {'year': 'PRIOR-Y'} if seeded else {}
        if seeded and short:
            metadata['antecedent_guess'] = 'PRIOR-A'
        cite = cls(token, index, span_start=span_start, full_span_start=777 if seeded else None,
                   full_span_end=888 if seeded else None, year=1998 if seeded else None, metadata=metadata)
        if seeded:
            cite.metadata.plaintiff = 'PRIOR-P'
            cite.metadata.defendant = 'PRIOR-D'
        document = models.Document(plain_text=''.join(str(word) for word in words) or ' ', words=words)
        before = observe(cite)
        calls.clear()
        error = None
        with patch.object(helpers.re, 'sub', sub), patch.object(helpers.re, 'split', split):
            try:
                assert helpers._process_case_name(cite, document, state, short) is None
            except (TypeError, ValueError, AttributeError, KeyError, IndexError) as exc:
                error = type(exc).__name__
        rows.append({'id': len(rows), 'scanCase': scan_id, 'short': short, 'seeded': seeded,
                     'index': index, 'spanStart': span_start,
                     'words': [native(str(word)) for word in words],
                     'state': {'candidateCaseName': native(state['candidate_case_name']),
                               'hasV': bool(state['v_token']), 'startIndex': state['start_index'],
                               'preCiteYear': native(state['pre_cite_year'])},
                     'before': before, 'after': observe(cite), 'error': error, 'calls': list(calls)})

    rows = []
    for case in scan['cases']:
        if case['error'] is not None:
            continue  # A failed scan never reaches processing in this source path.
        request, state = case['request'], case['state']
        words = [restore(word['data']) if word['kind'] == 'Text' else
                 getattr(models, word['kind'])(restore(word['data']), 0, 0,
                                              groups={k: restore(v) for k, v in word['groups'].items()})
                 for word in request['words']]
        source_state = {'candidate_case_name': restore(state['candidateCaseName']),
                        'v_token': None if state['vTokenIndex'] is None else words[state['vTokenIndex']],
                        'start_index': state['startIndex'], 'pre_cite_year': restore(state['preCiteYear'])}
        for short in (False, True):
            for seeded in (False, True):
                process(words, request['index'], source_state, short, seeded, 0 if seeded else None, case['id'])

    # These states exercise the helper's built-in dict interface independently
    # of reachability through the default scanner. Keep that distinction explicit.
    candidates = [None, '', 'Foo v. Bar', 'lower Foo v lower Bar', 'Foo V. Bar',
                  'Foo v. Bar v. Baz', 'Foo\u00a0v.\nBar', 'In re Smith', 'see',
                  '((Foo)), v Bar;Tail;Last', '😀 v \ud83d\ude00', '\ud800 v Foo']
    years = [None, '', '0000', '١٩٩٩', '𑽑𑽒𑽓𑽔', '  +1999 ', 'not-a-year']
    for candidate in candidates:
        for has_v in (False, True):
            for short in (False, True):
                state = {'candidate_case_name': candidate, 'v_token': object() if has_v else None,
                         'start_index': -2, 'pre_cite_year': None}
                process(['😀', models.Token(None, 0, 0), ' ', '1 X 1'], 3, state, short, True, 0)
    for year in years:
        for short in (False, True):
            for start_index in (None, -10, 0, 99):
                state = {'candidate_case_name': 'Foo v. Bar', 'v_token': object(),
                         'start_index': start_index, 'pre_cite_year': year}
                process(['Foo', ' ', 'v.', ' ', 'Bar', ' ', '1 X 1'], 6, state, short, True, None)

    out = {'schemaVersion': 'citation-case-name-process/v1', 'oracleCommit': PIN, 'oracleTree': TREE,
           'python': '3.11.15', 'regex': '2023.12.25', 'producerSha256': sha(Path(__file__).read_bytes()),
           'helpersSha256': sha((root / 'eyecite/helpers.py').read_bytes()),
           'regexesSha256': sha((root / 'eyecite/regexes.py').read_bytes()), 'scanCorpusSha256': SCAN,
           'stopWords': [native(word) for word in regexes.STOP_WORDS],
           'patterns': {name: native(text) for name, text in patterns.items()}, 'grammar': grammar,
           'strips': strips, 'cases': rows}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'strips': len(strips), 'cases': len(rows),
                      'errors': {kind: sum(row['error'] == kind for row in rows)
                                 for kind in sorted({r['error'] for r in rows if r['error']})},
                      'regexCalls': sum(len(row['calls']) for row in strips + rows)}))


if __name__ == '__main__':
    main()
