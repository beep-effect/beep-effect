#!/usr/bin/env python3
"""Observe unchanged original filtering, disambiguation and parallel inheritance."""
import argparse
import copy
import hashlib
import importlib.metadata
import itertools
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
    parser.add_argument('--oracle-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git', '-C', str(root), *xs], text=True).strip()
    assert (git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'), git('status', '--porcelain')) == (PIN, TREE, '')
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import get_citations, helpers, models
    sha = lambda data: hashlib.sha256(data).hexdigest()
    seeds = {}
    for text in ['1 U.S. 1', '35 U.S.C. § 101', '93 Harv. L. Rev. 518', 'Adarand, 515 U.S. at 241',
                 'Id. at 2', 'Smith, supra, at 2', '§ 2', 'Roe v. Wade, 410 U.S. 113 (1973). Roe at 120.']:
        for citation in get_citations(text):
            seeds[type(citation).__name__] = citation
    kinds = ['FullCaseCitation', 'FullLawCitation', 'FullJournalCitation', 'ShortCaseCitation', 'IdCitation',
             'SupraCitation', 'ReferenceCitation', 'UnknownCitation']
    assert set(seeds) == set(kinds)
    def make(kind, start, end, full_start=None, full_end=None, text='x', parenthetical=None, edition=True):
        citation = copy.deepcopy(seeds[kind])
        citation.token = models.Token(text, start, end, {})
        citation.span_start = citation.span_end = None
        citation.full_span_start, citation.full_span_end = full_start, full_end
        citation.metadata.parenthetical = parenthetical
        if isinstance(citation, models.ResourceCitation) and not edition:
            citation.edition_guess = None
        return citation
    def project(citation, identity):
        return {'id': identity, 'kind': type(citation).__name__, 'span': list(citation.span()),
                'fullSpan': list(citation.full_span()), 'matched': native(citation.matched_text()),
                'parenthetical': native(citation.metadata.parenthetical),
                'hasEdition': isinstance(citation, models.ResourceCitation) and bool(citation.edition_guess)}
    cases = []
    def observe(name, citations):
        ids = {id(c): i for i, c in enumerate(citations)}
        assert len(ids) == len(citations)
        rows = [project(c, ids[id(c)]) for c in citations]
        with patch.object(helpers.logger, 'warning') as warnings:
            filtered = helpers.filter_citations(citations)
        warning_pairs = [[ids[id(call.args[1])], ids[id(call.args[2])]] for call in warnings.call_args_list]
        assert rows == [project(c, ids[id(c)]) for c in citations]
        cases.append({'id': len(cases), 'name': name, 'input': rows, 'selected': [ids[id(c)] for c in filtered],
                      'disambiguated': [ids[id(c)] for c in helpers.disambiguate_reporters(filtered)],
                      'warnings': warning_pairs, 'sameList': filtered is citations})
    observe('empty', [])
    for left, right in itertools.product(kinds, repeat=2):
        observe(f'overlap:{left}:{right}', [make(left, 2, 4, 0, 8), make(right, 3, 6, 1, 9)])
    for left, right in itertools.product(kinds, repeat=2):
        observe(f'duplicate:{left}:{right}', [make(left, 2, 4, 0, 8), make(right, 2, 4, 1, 9)])
    for bounds in [(0, 2, 2, 4), (0, 0, 0, 0), (-2, 1, 0, 3), (4, 2, 1, 6), (0, 6, 2, 3)]:
        a,b,c,d = bounds
        observe(f'boundaries:{bounds}', [make('IdCitation', a, b), make('SupraCitation', c, d)])
    observe('stable-full-span-tie', [make('IdCitation', 3, 4, 0, 8), make('UnknownCitation', 1, 2, 0, 8)])
    observe('last-value-first-slot', [make('IdCitation', 1, 2, 0, 8), make('UnknownCitation', 3, 4, 0, 8), make('SupraCitation', 1, 2, 0, 8)])
    observe('reference-chain', [make('ReferenceCitation', 0, 2, 0, 8), make('ReferenceCitation', 2, 4, 1, 9), make('IdCitation', 4, 6, 2, 10)])
    observe('mixed-edition-presence', [make(k, i*4, i*4+2, edition=bool(i%2)) for i,k in enumerate(kinds)])
    for parenthetical, text in [(None,'x'), ('',''), ('x',''), ('contains x here','x'), ('no match','x'),
                                ('é界😀x','界😀'), ('😀','\ud83d\ude00'), ('\ud83d\ude00','😀'), ('\ud83d\ude00','\ud83d'), ('ababab','abab')]:
        observe(f'parenthetical:{len(cases)}', [make('IdCitation', 0, 2, 0, 9, parenthetical=parenthetical), make('SupraCitation', 3, 5, 1, 8, text=text)])
    parallel=[]
    for previous_start,current_start in itertools.product([None,0,1,-1],repeat=2):
        previous=make('FullCaseCitation',0,2,previous_start,9)
        current=make('FullCaseCitation',3,5,current_start,10)
        previous.metadata.plaintiff,previous.metadata.defendant,previous.metadata.year,previous.year='Prior','', '2000',2000
        current.metadata.plaintiff,current.metadata.defendant,current.metadata.year,current.year='Current','Def','1999',1999
        def state(c):
            return {'plaintiff':native(c.metadata.plaintiff),'defendant':native(c.metadata.defendant),
                    'yearText':native(c.metadata.year),'year':c.year,'fullSpanStart':c.full_span_start,'fullSpanEnd':c.full_span_end,
                    'editionPresent':bool(c.edition_guess)}
        before=state(current)
        previous_before=state(previous)
        returned=current.is_parallel_citation(previous)
        assert returned is None and state(previous)==previous_before
        parallel.append({'previous':previous_before,'before':before,'after':state(current)})
    repo=Path(__file__).resolve().parents[3]
    result={'schemaVersion':'citation-extraction-selection/v1','oracleCommit':PIN,'oracleTree':TREE,
            'python':'3.11.15','producerSha256':sha(Path(__file__).read_bytes()),
            'licenseSha256':sha((root/'LICENSE').read_bytes()),'lockSha256':sha((root/'uv.lock').read_bytes()),
            'sources':{name:sha((root/'eyecite'/name).read_bytes()) for name in ['helpers.py','models.py','find.py']},
            'versions':{name:importlib.metadata.version(name) for name in ['eyecite','regex','reporters-db','courts-db']},
            'scope':'Direct unchanged built-in filtering, disambiguation and parallel methods; projected selection facts retain original object IDs. No full engine or mutable-host proof.',
            'cases':cases,'parallel':parallel}
    formatter=['bunx','--no-install','biome']
    result['formatter']=subprocess.check_output(formatter+['--version'],cwd=repo,text=True).strip()
    fixture=repo/'packages/law-practice/use-cases/test/fixtures/eyecite/extraction-selection.json'
    formatted=subprocess.run(formatter+['format','--stdin-file-path='+str(fixture)],input=json.dumps(result,ensure_ascii=True,sort_keys=True,indent=2)+'\n',cwd=repo,text=True,capture_output=True,check=True)
    args.output.write_text(formatted.stdout)
    assert git('status','--porcelain')==''
    print(json.dumps({'cases':len(cases),'parallel':len(parallel),'warnings':sum(len(r['warnings']) for r in cases)}))


if __name__ == '__main__':
    main()
