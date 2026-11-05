#!/usr/bin/env python3
"""Capture original resource reporter/page methods with exact native source words."""
import argparse
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def native(text):
    if text is None: return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


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
    from eyecite import models, utils
    from eyecite.tokenizers import EXTRACTORS
    assert utils.REPORTERS_THAT_NEED_PAGE_CORRECTION == {'NY Slip Op', 'Misc. 3d'}
    spec = importlib.util.spec_from_file_location('operations', Path(__file__).with_name('export-operations.py'))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normalize, _ = operations.make_normalizer(root)
    sha = lambda b: hashlib.sha256(b).hexdigest()
    editions = {}
    for extractor in EXTRACTORS:
        for key in ('exact_editions', 'variation_editions'):
            for e in extractor.extra.get(key, []): editions[normalize(e)['artifactSha256']] = e
    ordered = sorted(editions.items())
    assert len(ordered) == 2533
    special = next((ref, e) for ref, e in ordered if e.short_name == 'NY Slip Op')
    ordinary = next((ref, e) for ref, e in ordered if e.short_name not in utils.REPORTERS_THAT_NEED_PAGE_CORRECTION)
    def citation(groups, edition):
        return models.ResourceCitation(models.CitationToken('1 X 1', 0, 5, groups), 0, edition_guess=edition)
    canonical = []
    for ref, e in ordered:
        c = citation({'reporter': 'X', 'page': '1[U][A]'}, e)
        canonical.append([ref, native(c.corrected_reporter()), native(c.corrected_page())])
    missing = object()
    reporters = [missing, None, '', 'X', 'Misc. 3d', 'NY Slip Op', 'misc. 3d', 'NY Slip Op ', 'é', '😀', '\ud835\udfce']
    pages = [missing, None, '', '1', '1[U]', '[A][U][A]', '[u]', '[[U]]', '[U[A]', '😀[U]', '\ud835\udfce[A]', '$&[A]']
    cases = []
    for reporter, page, selected in itertools.product(reporters, pages, (None, special, ordinary)):
        groups = {}
        if reporter is not missing: groups['reporter'] = reporter
        if page is not missing: groups['page'] = page
        ref, edition = (None, None) if selected is None else selected
        c = citation(groups, edition)
        try: result = c.corrected_reporter(); failure = False
        except KeyError: result = None; failure = True
        cases.append({'request': {**{k: native(v) for k, v in groups.items()}, 'editionGuess': ref}, 'reporter': native(result), 'missingReporter': failure, 'page': native(c.corrected_page())})
    out = {'schemaVersion': 'citation-resource-correction/v1', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()), 'modelsSha256': sha((root/'eyecite/models.py').read_bytes()), 'utilsSha256': sha((root/'eyecite/utils.py').read_bytes()), 'cases': cases, 'canonical': canonical}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2)+'\n')
    print(json.dumps({'controls': len(cases), 'canonical': len(canonical), 'sourceCalls': 2*(len(cases)+len(canonical))}))


if __name__ == '__main__': main()
