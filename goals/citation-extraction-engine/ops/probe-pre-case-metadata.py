#!/usr/bin/env python3
"""Execute pinned add_pre_citation, retaining skip/no-match and every field update."""
import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
from re import _parser
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import patch

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
LAW = '098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea'


def native(text):
    if text is None: return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {'width': width, 'bytes': b''.join(ord(c).to_bytes(width, 'little') for c in text).hex()}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root', required=True, type=Path)
    p.add_argument('--fixture-root', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git','-C',str(root),*xs], text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain')) == (PIN,TREE,'')
    assert sys.version_info[:3] == (3,11,15)
    sys.path.insert(0,str(root))
    import regex
    from eyecite import helpers,models,regexes
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    sha = lambda b: hashlib.sha256(b).hexdigest()
    spec = importlib.util.spec_from_file_location('verbose',Path(__file__).with_name('probe-regex-verbose.py'))
    verbose = importlib.util.module_from_spec(spec); spec.loader.exec_module(verbose)
    pattern = regexes.PRE_FULL_CITATION_REGEX
    bindings = []
    for raw in (f'^(?:{pattern})',f'(?:{pattern})$'):
        compiled = regex.compile(raw,64)
        tree = _parser.parse(raw,64)
        assert compiled.groups == 2 and dict(compiled.groupindex) == tree.state.groupdict
        width,repeated,nullable = verbose.cpython_profile(tree)
        word = native(raw)
        bindings.append({'patternSha256':sha(bytes([word['width']])+bytes.fromhex(word['bytes'])),'flags':64,'profile':{'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}})
    law_bytes = (args.fixture_root/'law-metadata.json').read_bytes(); assert sha(law_bytes)==LAW
    law = json.loads(law_bytes)['configuration']
    texts = ['', 'Nobelman at 332, ', 'Johnson, ', ' Foo ', 'Johnson, at 42, ', 'Johnson ', 'McDonald ', 'v. ', 'Éclair ', 'Nobelman', 'Alpha. at 2, ', 'Smith, 12-14, ', 'Smith, ¶ 12, ', 'Smith, 12:24-25, ', 'Smith, ١٢, ', 'Smith, 𑽐, ', 'Smith, at 2x ', 'Prefix Smith ', 'x'*299+'Smith, ', 'Smith, '+ ' '*301, 'x😀 Smith, ', 'x\ud83d\ude00 Smith, ']
    vectors = [[('Text',t)] for t in texts]
    vectors += [[('Text','Smith, '),('ParagraphToken','\n\n')],[('ParagraphToken','\n\n'),('Text','Smith, ')],[('Text','Smith '),('Text','at 12, ')],[('Text','Smith, '),('IdToken','Id.')],[('Token',None)]]
    original = helpers.re.search
    calls=[]
    def search(raw,text,flags=0):
        assert raw==f'(?:{pattern})$' and flags==64
        calls.append(native(text))
        return original(raw,text,flags=flags)
    rows=[]
    for vector_id,vector in enumerate(vectors):
        for state,(plaintiff,defendant) in enumerate(((None,None),('',None),(None,''),('KNOWN',None),(None,'KNOWN'))):
            for span_start in (0,20):
                for prior in (None,7):
                    token=models.CitationToken('1 X 1',20,25,{'volume':'1','reporter':'X','page':'1'})
                    words=[t if k=='Text' else getattr(models,k)(t,0,0) for k,t in vector]+[token]
                    cite=models.FullCaseCitation(token,len(vector),span_start=span_start,full_span_start=888,full_span_end=777,year=1998,metadata={'plaintiff':plaintiff,'defendant':defendant,'pin_cite':'SEED','antecedent_guess':'SEED','pin_cite_span_start':prior,'year':'KEEP'})
                    calls.clear()
                    with patch.object(helpers.re,'search',search): assert helpers.add_pre_citation(cite,SimpleNamespace(words=words)) is None
                    assert cite.year==1998 and cite.metadata.year=='KEEP' and cite.full_span_end==777
                    assert (cite.metadata.plaintiff,cite.metadata.defendant)==(plaintiff,defendant)
                    observed=None if cite.full_span_start==888 else {'fullSpanStart':cite.full_span_start,'metadata':{'pinCite':native(cite.metadata.pin_cite),'antecedentGuess':native(cite.metadata.antecedent_guess),'pinCiteSpanStart':cite.metadata.pin_cite_span_start}}
                    rows.append({'id':len(rows),'smoke':prior==7 and ((span_start==20 and ((state==0 and vector_id in (0,1,2,7,12,14,18,21,22,24)) or (state in (1,2,3) and vector_id==1))) or (span_start==0 and state==0 and vector_id in (1,2))), 'request':{'words':[{'kind':k,'data':native(t)} for k,t in vector]+[{'kind':'CitationToken','data':native(token.data)}],'index':len(vector),'spanStart':span_start,'plaintiff':native(plaintiff),'defendant':native(defendant),'pinCiteSpanStart':prior},'patch':observed,'calls':len(calls)})
    word=native(pattern)
    out={'schemaVersion':'citation-pre-case-metadata/v1','oracleCommit':PIN,'oracleTree':TREE,'python':'3.11.15','regex':'2023.12.25','producerSha256':sha(Path(__file__).read_bytes()),'profileReaderSha256':sha(Path(verbose.__file__).read_bytes()),'lawCorpusSha256':LAW,'patternSha256':sha(bytes([word['width']])+bytes.fromhex(word['bytes'])),'configuration':{'pattern':word,'bindings':bindings,**{k:law[k] for k in ('yearPattern','yearBindings','highestValidYear')}},'cases':rows}
    args.output.write_text(json.dumps(out,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'cases':len(rows),'calls':sum(r['calls'] for r in rows),'smokeCases':sum(r['smoke'] for r in rows),'smokeCalls':sum(r['calls'] for r in rows if r['smoke']),'patternSha256':out['patternSha256']}))


if __name__=='__main__': main()
