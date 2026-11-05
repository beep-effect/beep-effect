#!/usr/bin/env python3
"""Capture original built-in full rendering and Id./supra formatted methods."""
import argparse
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
import sys

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    if text is None: return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text)) <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


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
    selected = next(e for extractor in EXTRACTORS for e in extractor.extra.get('exact_editions', []) if e.short_name == 'NY Slip Op')
    ref = normalize(selected)['artifactSha256']
    source_bases = [('1 X [U]', {'reporter': 'X', 'page': '[U]'}, None), ('1 X [U]', {'reporter': 'X', 'page': '[U]'}, selected), ('<\ud835\udfce> 1 X 😀[A]', {'reporter': 'X', 'page': '😀[A]'}, None), ('1 X [U]', {'reporter': None, 'page': '[U]'}, selected), ('', {'reporter': '', 'page': None}, selected)]
    bases = [{ 'matchedText': native(text), **{k: native(v) for k, v in groups.items()}, 'editionGuess': None if edition is None else ref } for text, groups, edition in source_bases]
    definitions = [('matched', 'CitationBase', 'corrected_citation_full', []), ('law', 'FullLawCitation', 'corrected_citation_full', [('pinCite','pin_cite'), ('publisher','publisher'), ('month','month'), ('day','day'), ('year','year'), ('parenthetical','parenthetical')]), ('journal', 'FullJournalCitation', 'corrected_citation_full', [('pinCite','pin_cite'), ('year','year'), ('parenthetical','parenthetical')]), ('case', 'FullCaseCitation', 'corrected_citation_full', [('plaintiff','plaintiff'), ('defendant','defendant'), ('pinCite','pin_cite'), ('extra','extra'), ('court','court'), ('year','year'), ('parenthetical','parenthetical')]), ('short', 'ShortCaseCitation', 'corrected_citation_full', [('antecedentGuess','antecedent_guess')]), ('supra', 'SupraCitation', 'formatted', [('antecedentGuess','antecedent_guess'), ('volume','volume'), ('pinCite','pin_cite')]), ('id', 'IdCitation', 'formatted', [('pinCite','pin_cite')])]
    labels = {'pinCite':'p', 'publisher':'Q', 'month':'M', 'day':'d', 'year':'Y', 'parenthetical':'h', 'plaintiff':'P', 'defendant':'D', 'extra':'e', 'court':'C', 'antecedentGuess':'A', 'volume':'V'}
    outputs = []
    indices = {}
    def output(text):
        if text not in indices:
            indices[text] = len(outputs)
            outputs.append(native(text))
        return indices[text]
    def observe(class_name, method, base, metadata):
        text, groups, edition = source_bases[base]
        cls = getattr(models, class_name)
        kwargs = {'edition_guess': edition} if issubclass(cls, models.ResourceCitation) else {}
        citation = cls(models.CitationToken(text, 0, len(text), groups), 0, **kwargs)
        citation.metadata = cls.Metadata(**metadata)
        try: return output(getattr(citation, method)())
        except TypeError: return None
    modes = []
    for mode, class_name, method, fields in definitions:
        rows = []
        for states in itertools.product(range(3), repeat=len(fields)):
            metadata = {snake: [None, '', labels[camel]][state] for (camel, snake), state in zip(fields, states)}
            rows.append([observe(class_name, method, base, metadata) for base in range(len(bases))])
        modes.append({'mode': mode, 'sourceClass': class_name, 'sourceMethod': method, 'fields': [camel for camel, _ in fields], 'presentValues': [native(labels[camel]) for camel, _ in fields], 'observations': rows})
    inherited = []
    for class_name in ['CitationBase', 'ResourceCitation', 'FullCitation', 'CaseCitation', 'SupraCitation', 'IdCitation', 'ReferenceCitation', 'UnknownCitation']:
        inherited.append({'sourceClass': class_name, 'observations': [observe(class_name, 'corrected_citation_full', base, {'pin_cite':'IGNORED', 'parenthetical':'IGNORED'}) for base in range(len(bases))]})
    native_controls = []
    vectors = [('law','\ud835',{'pinCite':'\udfce'}), ('case','\ud835',{'extra':'\udfce'}), ('case','X',{'plaintiff':'\ud835','defendant':'\udfce'}), ('journal','X',{'parenthetical':'\ud835\udfce'}), ('supra','IGNORED',{'antecedentGuess':'\ud835\udfce','volume':'😀','pinCite':'$&\\1'}), ('id','IGNORED',{'pinCite':'\ud835\udfce'}), ('matched','\ud835\udfce',{}), ('law','X',{'publisher':' ','month':' ','day':' ','year':' ','pinCite':' ','parenthetical':' '}), ('case','X',{'plaintiff':' ','defendant':' ','pinCite':' ','extra':' ','court':' ','year':' ','parenthetical':' '})]
    for mode, text, overrides in vectors:
        _, class_name, method, fields = next(d for d in definitions if d[0] == mode)
        metadata = {camel: overrides.get(camel) for camel, _ in fields}
        cls = getattr(models, class_name)
        groups = {'reporter':'X', 'page':None}
        citation = cls(models.CitationToken(text, 0, len(text), groups), 0)
        citation.metadata = cls.Metadata(**{snake:metadata[camel] for camel, snake in fields})
        request = {'mode':mode, 'matchedText':native(text), 'reporter':native('X'), 'page':None, 'editionGuess':None, 'metadata':{k:native(v) for k,v in metadata.items()}}
        native_controls.append({'request':request, 'result':output(getattr(citation, method)())})
    out = {'schemaVersion':'citation-rendering/v1', 'oracleCommit':PIN, 'oracleTree':TREE, 'python':'3.11.15', 'producerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'modelsSha256':hashlib.sha256((root/'eyecite/models.py').read_bytes()).hexdigest(), 'bases':bases, 'modes':modes, 'inherited':inherited, 'nativeControls':native_controls, 'outputs':outputs}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2)+'\n')
    print(json.dumps({'observations':sum(len(m['observations'])*len(bases) for m in modes), 'inherited':len(inherited)*len(bases), 'nativeControls':len(native_controls), 'outputs':len(outputs)}))


if __name__ == '__main__': main()
