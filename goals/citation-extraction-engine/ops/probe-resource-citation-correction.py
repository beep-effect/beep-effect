#!/usr/bin/env python3
"""Observe original ResourceCitation.corrected_citation and native str.replace."""
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
    from eyecite import models
    from eyecite.tokenizers import EXTRACTORS
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
    ordinary = next((ref, e) for ref, e in ordered if e.short_name == 'U.S.')
    outputs = []
    output_indices = {}
    def output(text):
        if text not in output_indices:
            output_indices[text] = len(outputs)
            outputs.append(native(text))
        return output_indices[text]
    def citation(text, groups, edition):
        return models.ResourceCitation(models.CitationToken(text, 0, len(text), groups), 0, edition_guess=edition)
    def observe(text, groups, edition):
        try: return [output(citation(text, groups, edition).corrected_citation()), None]
        except TypeError: return [None, 'invalid-reporter-replacement']
    canonical = []
    for ref, edition in ordered:
        canonical.append([ref, *observe('X 1[U][A] X', {'reporter': 'X', 'page': '1[U][A]'}, edition)])
    missing = object()
    reporters = [missing, None, '', 'X', 'Misc. 3d', 'NY Slip Op', 'misc. 3d', 'NY Slip Op ', 'é', '😀', '\ud835\udfce']
    pages = [missing, None, '', '1', '1[U]', '[A][U][A]', '[u]', '[[U]]', '[U[A]', '😀[U]', '\ud835\udfce[A]', '$&[A]']
    texts = ['', 'X 1[U][A] X 1[U][A]', '$&[A] X 😀[U] \ud835\udfce[A]', 'Misc. 3d NY Slip Op X é 😀 \ud835\udfce']
    refs = [None, special[0], ordinary[0]]
    selected = [None, special[1], ordinary[1]]
    groups = []
    controls = []
    for reporter, page in itertools.product(reporters, pages):
        group = {}
        if reporter is not missing: group['reporter'] = reporter
        if page is not missing: group['page'] = page
        index = len(groups)
        groups.append({k: native(v) for k, v in group.items()})
        for edition_index, text_index in itertools.product(range(3), range(4)):
            controls.append([index, edition_index, text_index, *observe(texts[text_index], group, selected[edition_index])])
    words = ['', 'a', 'aa', 'aaa', 'aaaa', 'ababa', 'b', '$&', '$`', "\\1", 'é', '😀', '\ud835', '\udfce', '\ud835\udfce', '\U0001d7ce', 'x\ud835\udfcex', 'x\U0001d7cex']
    replacements = []
    for source, old, new in itertools.product(range(len(words)), range(len(words)), [0, 1, 7, 9, 10, 11, 14, 15]):
        replacements.append([source, old, new, output(words[source].replace(words[old], words[new]))])
    out = {'schemaVersion': 'citation-resource-citation-correction/v1', 'oracleCommit': PIN, 'oracleTree': TREE, 'python': '3.11.15', 'producerSha256': sha(Path(__file__).read_bytes()), 'modelsSha256': sha((root/'eyecite/models.py').read_bytes()), 'groups': groups, 'editions': refs, 'texts': list(map(native, texts)), 'controls': controls, 'canonical': canonical, 'replacementWords': list(map(native, words)), 'replacements': replacements, 'outputs': outputs}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2)+'\n')
    print(json.dumps({'controls': len(controls), 'canonical': len(canonical), 'replacements': len(replacements), 'outputs': len(outputs)}))


if __name__ == '__main__': main()
