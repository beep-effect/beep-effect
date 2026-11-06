#!/usr/bin/env python3
"""Execute initialized source case-name boundary scans and retain complete state."""
import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import re
from re import _parser
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import patch

PIN='04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE='a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    if text is None:return None
    width=1 if max(map(ord,text),default=0)<=255 else 2 if max(map(ord,text),default=0)<=65535 else 4
    return {'width':width,'bytes':b''.join(ord(char).to_bytes(width,'little') for char in text).hex()}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    args=p.parse_args();root=args.oracle_root.resolve()
    git=lambda *xs:subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain'))==(PIN,TREE,'')
    assert sys.version_info[:3]==(3,11,15)
    sys.path.insert(0,str(root))
    import regex
    from eyecite import helpers,models
    assert importlib.metadata.version('regex')=='2023.12.25' and regex.DEFAULT_VERSION==regex.V0
    assert helpers.BACKWARD_SEEK==28
    sha=lambda b:hashlib.sha256(b).hexdigest()
    spec=importlib.util.spec_from_file_location('verbose',Path(__file__).with_name('probe-regex-verbose.py'))
    verbose=importlib.util.module_from_spec(spec);spec.loader.exec_module(verbose)
    patterns={'year':r'\(\d{4}\)','connectorSpace':r'^(of|the|an|and)\s+','capitalized':r'\b([A-Z][a-zA-Z0-9]*)\b.*','connectorBoundary':r'^(of|the|an|and)\b','trailingDigits':r'\b\d+\b$'}
    bindings=[];fingerprints={}
    for name,text in patterns.items():
        flags=2 if name=='connectorBoundary' else 0
        compiled=regex.compile(text,flags);tree=_parser.parse(text,flags)
        assert compiled.groups==re.compile(text,flags).groups
        width,repeated,nullable=verbose.cpython_profile(tree)
        word=native(text);fingerprint=sha(bytes([word['width']])+bytes.fromhex(word['bytes']))
        fingerprints[name]=fingerprint
        bindings.append({'patternSha256':fingerprint,'flags':flags,'profile':{'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}})
    token=lambda kind,data,groups=None:(kind,data,groups or {})
    v=token('StopWordToken','v.',{'stop_word':'v'})
    vectors=[[],['Foo',' '],['the',' ','Foo',' '],['The',' ','Foo',' '],['theory',' ','Foo',' '],['of',' ','Foo',' '],['Nobelman',' ','123',' '],['Nobelman',' ','١٢٣',' '],['Nobelman',' ','123\n',' '],['Nobelman',' ','123\r\n',' '],['lower',' ','Á',' ','Case',' '],['See',' ','Foo',' ',v,' ','Bar',',',' '],['lower',' ','the',' ','Foo',' ',v,' ','Bar',' '],['Prior.',' ','Foo',' ',v,' ','Bar',' '],[';',' ','Foo',' '],['”',' ','Foo',' '],['"',' ','Foo',' '],['(1999)',' ','Foo',' '],['(١٩٩٩)',' ','Foo',' '],['(𑽑𑽒𑽓𑽔)tail',' ','Foo',' '],['(',' ','A',' ','B',' '],['(alpha',' ','A',' ','B',' '],['(ǅ',' ','A',' ','B',' '],['(\ud800',' ','A',' ','B',' '],['ex',' ','Relator',' '],['rel.',' ','Relator',' '],['Foo',' ',token('SupraToken','supra'),' '],[token('PlaceholderCitationToken','xxx'),' ','Foo',' '],[token('CitationToken','1 X 1'),' ','Foo',' '],['Foo',token('ParagraphToken','\n\n'),'Bar',' '],[v,' ','Bar',' '],[token('StopWordToken','',{'stop_word':'v'}),' ','Bar',' '],[token('StopWordToken','See',{'stop_word':'see'}),' ','Foo',' '],[token('StopWordToken','See'),' ','Foo',' '],[''],[token('Token',None)],[token('CitationToken','')],['Foo',','],[token('Token',','),' ','Foo',' '],['𐐀ab.',' ','Foo',' ',v,' ','Bar',' '],['𐐀abc.',' ','Foo',' ',v,' ','Bar',' '],['Éclair',' ','Foo',' '],['\ud83d\ude00',' ','Foo',' '],['😀',' ','Foo',' '],['A',' ']*14,['A',' ']*13+[v,' '],['A',' ']*13+[token('CitationToken','1 X 1'),' ']]
    vectors += [['(𐐨',' ','A',' ','B',' '],['(\ud801\udc28',' ','A',' ','B',' ']]
    original={name:getattr(helpers.re,name) for name in ('search','match','sub')};calls=[]
    by_pattern={text:name for name,text in patterns.items()}
    def record(kind,pattern,text,flags):
        assert pattern in by_pattern
        name=by_pattern[pattern];assert flags==(2 if name=='connectorBoundary' else 0)
        calls.append({'pattern':name,'mode':kind,'source':native(text)})
    def search(pattern,text,flags=0):record('search',pattern,text,flags);return original['search'](pattern,text,flags=flags)
    def match(pattern,text,flags=0):record('match',pattern,text,flags);return original['match'](pattern,text,flags=flags)
    def sub(pattern,replacement,text,count=0,flags=0):
        assert replacement=='' and count==0
        record('sub',pattern,text,flags);return original['sub'](pattern,replacement,text,count=count,flags=flags)
    rows=[]
    for vector_id,vector in enumerate(vectors):
        specs=[('Text',x,{}) if isinstance(x,str) else x for x in vector]
        specs.append(('CitationToken','1 X 1',{}))
        words=[text if kind=='Text' else getattr(models,kind)(text,0,0,groups=groups) for kind,text,groups in specs]
        indices=[len(vector)]
        if vector_id in (0,11,33,34,35):indices += [-1,0,len(words)+1]
        for index in indices:
            cite=SimpleNamespace(index=index)
            state=helpers._initialize_search_state(cite);calls.clear();error=None
            with patch.object(helpers.re,'search',search),patch.object(helpers.re,'match',match),patch.object(helpers.re,'sub',sub):
                try:assert helpers._scan_for_case_boundaries(SimpleNamespace(words=words),cite,state) is state
                except (IndexError,TypeError,KeyError) as exc:error=type(exc).__name__
            v_index=None if state['v_token'] is None else next(i for i,w in enumerate(words) if w is state['v_token'])
            result={out:state[key] for out,key in [('offset','offset'),('startIndex','start_index'),('titleStartingIndex','title_starting_index'),('caseNameLength','case_name_length'),('plaintiffLength','plaintiff_length')]}
            result.update(vTokenIndex=v_index,candidateCaseName=native(state['candidate_case_name']),preCiteYear=native(state['pre_cite_year']))
            request={'words':[{'kind':kind,'data':native(text),'groups':{k:native(v) for k,v in groups.items()}} for kind,text,groups in specs],'index':index}
            rows.append({'id':len(rows),'smoke':index==len(vector) and vector_id in (1,30,33,34,35,47,48),'request':request,'state':result,'error':error,'calls':list(calls)})
    out={'schemaVersion':'citation-case-name-scan/v1','oracleCommit':PIN,'oracleTree':TREE,'python':'3.11.15','regex':'2023.12.25','producerSha256':sha(Path(__file__).read_bytes()),'profileReaderSha256':sha(Path(verbose.__file__).read_bytes()),'helpersSha256':sha((root/'eyecite/helpers.py').read_bytes()),'fingerprints':fingerprints,'configuration':{'patterns':{k:native(v) for k,v in patterns.items()},'bindings':bindings},'cases':rows}
    args.output.write_text(json.dumps(out,ensure_ascii=True,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'cases':len(rows),'calls':sum(len(r['calls']) for r in rows),'smokeCases':sum(r['smoke'] for r in rows),'smokeCalls':sum(len(r['calls']) for r in rows if r['smoke']),'errors':sum(r['error'] is not None for r in rows),'fingerprints':fingerprints}))


if __name__=='__main__':main()
