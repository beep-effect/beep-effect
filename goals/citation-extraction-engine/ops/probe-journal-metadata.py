#!/usr/bin/env python3
"""Execute original full journal metadata with shared authenticated source vectors."""
import argparse
from datetime import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import patch

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
LAW = '098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea'
FULL = 'e899dae1c175c26a70fc15baa916596b7f63ed5967ef79a028a62083f64d9784'
LOOK = '7fd24d7ff71257d1a563cb02aca1275337b08a52e327ce138cbe35c72908a971'


def native(text):
    if text is None: return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def decode(word):
    if word is None: return None
    b, w = bytes.fromhex(word['bytes']), word['width']
    return ''.join(chr(int.from_bytes(b[i:i+w], 'little')) for i in range(0, len(b), w))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root', required=True, type=Path)
    p.add_argument('--fixture-root', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import helpers, models, regexes
    from eyecite.tokenizers import EXTRACTORS
    spec = importlib.util.spec_from_file_location('operations', Path(__file__).with_name('export-operations.py'))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normalize, _ = operations.make_normalizer(root)
    sha = lambda b: hashlib.sha256(b).hexdigest()
    def load(name, expected):
        b = (args.fixture_root/name).read_bytes()
        assert sha(b) == expected
        return json.loads(b)
    law, full, look = load('law-metadata.json', LAW), load('full-law-metadata.json', FULL), load('regex-lookahead.json', LOOK)
    journal, forward, backward = look['patterns'][14:17]
    assert journal['pattern'] == native(regexes.POST_JOURNAL_CITATION_REGEX)
    controls = [{k: r[k] for k in ('exact', 'variation', 'prior')} for r in full['cases'][:6]]
    editions = {}
    for extractor in EXTRACTORS:
        for key in ('exact_editions', 'variation_editions'):
            for e in extractor.extra.get(key, []): editions[normalize(e)['artifactSha256']] = e
    identities = {id(e): ref for ref, e in editions.items()}
    inputs = [{'request': r['request'], 'smoke': r['smoke']} for r in law['cases']]
    tails = [', 123', ', at 123', ', 123-124', ', 12:24-25', ', 12, 13', ', 123x', ', 123 next', ', 123;', ', ¶ 12 (2020)', ', **12 (٢٠٢٠)', ' (1599)', ' (2027)', ' (2028)', ', 42 (2020) (note)', ', 42 (2020) (2021 note)', ', 42 (2020) (\ud835\udfce)']
    for vector, tail in enumerate(tails):
        for year in (None, 1998):
            for span in (5, 37):
                inputs.append({'request': {'words': [{'kind': 'CitationToken', 'data': native('1 X 1')}, {'kind': 'Text', 'data': native(tail)}], 'index': 0, 'spanEnd': span, 'year': year}, 'smoke': year == 1998 and span == 37 and vector in (0, 5, 8, 13, 14, 15)})
    helpers._highest_valid_year = 2027
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None): return datetime(2026, 11, 3)
    checks, calls = [], []
    year_original, search_original, match_original = models.Edition.includes_year, helpers.re.search, helpers.re.match
    def includes(e, year):
        checks.append(identities[id(e)])
        return year_original(e, year)
    def search(pattern, text, flags=0):
        calls.append('journal')
        return search_original(pattern, text, flags=flags)
    def match(pattern, text, flags=0):
        calls.append('parenthetical-year')
        return match_original(pattern, text, flags=flags)
    rows = []
    with patch.object(models, 'datetime', FrozenDateTime), patch.object(models.Edition, 'includes_year', includes), patch.object(helpers.re, 'search', search), patch.object(helpers.re, 'match', match):
        for input_id, row in enumerate(inputs):
            r = row['request']
            for control_id, control in enumerate(controls):
                token = models.CitationToken('1 X 1', 0, 5, {'volume': '1', 'reporter': 'X', 'page': '1'})
                words = [token] + [decode(w['data']) if w['kind'] == 'Text' else getattr(models, w['kind'])(decode(w['data']), 0, 0) for w in r['words'][1:]]
                cite = models.FullJournalCitation(token, r['index'], span_end=r['spanEnd'], full_span_end=777, year=r['year'], exact_editions=[editions[e] for e in control['exact']], variation_editions=[editions[e] for e in control['variation']], edition_guess=None if control['prior'] is None else editions[control['prior']], metadata={'pin_cite': 'SEED', 'parenthetical': 'SEED', 'year': 'SEED', 'day': 'KEEP', 'month': 'KEEP', 'pin_cite_span_start': 11})
                calls.clear(); checks.clear()
                assert cite.add_metadata(SimpleNamespace(words=words)) is None
                assert cite.metadata.day == cite.metadata.month == 'KEEP' and cite.metadata.pin_cite_span_start == 11
                observed = {'fullSpanEnd': cite.full_span_end, 'year': cite.year, 'metadata': {'pinCite': native(cite.metadata.pin_cite), 'parenthetical': native(cite.metadata.parenthetical), 'year': native(cite.metadata.year)}}
                if control_id == 0: row.update(patch=observed, calls=list(calls))
                else: assert row['patch'] == observed and row['calls'] == calls
                rows.append([input_id, control_id, None if cite.edition_guess is None else identities[id(cite.edition_guess)], list(checks)])
    out = {'schemaVersion': 'citation-journal-metadata/v1', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'currentYear': 2026, 'producerSha256': sha(Path(__file__).read_bytes()), 'lawCorpusSha256': LAW, 'fullLawCorpusSha256': FULL, 'lookaheadCorpusSha256': LOOK, 'configuration': {**{k: law['configuration'][k] for k in ('yearPattern', 'yearBindings', 'highestValidYear')}, 'journalPattern': journal['pattern'], 'journalBindings': [{'patternSha256': r['patternSha256'], 'flags': r['flags'], 'profile': r['engines']['python-regex-v0']['profile']} for r in (forward, backward)]}, 'inputs': inputs, 'controls': controls, 'cases': rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2)+'\n')
    print(json.dumps({'inputs': len(inputs), 'cases': len(rows), 'searches': sum(len(inputs[r[0]]['calls']) for r in rows), 'editionChecks': sum(len(r[3]) for r in rows)}))


if __name__ == '__main__': main()
