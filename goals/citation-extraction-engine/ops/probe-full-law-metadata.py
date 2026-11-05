#!/usr/bin/env python3
"""Execute original FullLawCitation.add_metadata against authenticated law vectors."""
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

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
LAW = "098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--law-corpus", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import helpers, models
    from eyecite.tokenizers import EXTRACTORS
    spec = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normalize, _ = operations.make_normalizer(root)
    sha = lambda b: hashlib.sha256(b).hexdigest()
    raw = args.law_corpus.read_bytes()
    assert sha(raw) == LAW
    corpus = json.loads(raw)
    editions = {}
    for extractor in EXTRACTORS:
        for key in ("exact_editions", "variation_editions"):
            for edition in extractor.extra.get(key, []):
                editions[normalize(edition)["artifactSha256"]] = edition
    distinct = {}
    for ref, edition in sorted(editions.items()):
        bounds = (edition.start, edition.end)
        if bounds not in distinct:
            distinct[bounds] = (ref, edition)
    selected = list(distinct.values())[:5]
    assert len(selected) == 5
    refs, values = zip(*selected)
    identities = {id(e): ref for ref, e in selected}
    controls = [([], [], None), ([0], [1], None), ([0, 1], [2], 4), ([], [0, 1], 4), ([0, 0], [1], 4), ([2, 3], [0], 4)]
    decode = lambda v: None if v is None else ''.join(chr(int.from_bytes(bytes.fromhex(v['bytes'])[i:i+v['width']], 'little')) for i in range(0, len(bytes.fromhex(v['bytes'])), v['width']))
    def native(text):
        if text is None: return None
        largest = max(map(ord, text), default=0)
        width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
        return {"width": width, "bytes": b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}
    helpers._highest_valid_year = 2027
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None): return datetime(2026, 11, 3)
    rows = []
    original = models.Edition.includes_year
    trace = []
    def checked(edition, year):
        trace.append(identities[id(edition)])
        return original(edition, year)
    with patch.object(models, "datetime", FrozenDateTime), patch.object(models.Edition, "includes_year", checked):
        for law in corpus['cases']:
            request = law['request']
            for control_id, (exact, variation, prior) in enumerate(controls):
                token = models.CitationToken('1 X 1', 0, 5, {'volume': '1', 'reporter': 'X', 'page': '1'})
                words = [token] + [decode(w['data']) if w['kind'] == 'Text' else getattr(models, w['kind'])(decode(w['data']), 0, 0) for w in request['words'][1:]]
                cite = models.FullLawCitation(token, 0, span_end=request['spanEnd'], full_span_end=777, year=request['year'], exact_editions=[values[i] for i in exact], variation_editions=[values[i] for i in variation], edition_guess=None if prior is None else values[prior], metadata={k: 'SEED' for k in ('pin_cite', 'publisher', 'day', 'month', 'parenthetical', 'year')})
                trace.clear()
                assert cite.add_metadata(SimpleNamespace(words=words)) is None
                observed = {'fullSpanEnd': cite.full_span_end, 'year': cite.year, 'metadata': {out: native(getattr(cite.metadata, name)) for out, name in (('pinCite', 'pin_cite'), ('publisher', 'publisher'), ('day', 'day'), ('month', 'month'), ('parenthetical', 'parenthetical'), ('year', 'year'))}}
                assert observed == law['patch']
                rows.append({'lawCase': law['id'], 'control': control_id, 'exact': [refs[i] for i in exact], 'variation': [refs[i] for i in variation], 'prior': None if prior is None else refs[prior], 'guess': None if cite.edition_guess is None else identities[id(cite.edition_guess)], 'checks': list(trace)})
    out = {'schemaVersion': 'citation-full-law-metadata/v1', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'currentYear': 2026, 'producerSha256': sha(Path(__file__).read_bytes()), 'modelsSha256': sha((root/'eyecite/models.py').read_bytes()), 'lawCorpusSha256': LAW, 'cases': rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2)+'\n')
    print(json.dumps({'cases': len(rows), 'editionChecks': sum(len(r['checks']) for r in rows)}))


if __name__ == '__main__': main()
