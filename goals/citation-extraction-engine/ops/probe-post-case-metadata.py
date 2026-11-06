#!/usr/bin/env python3
"""Execute original add_post_citation with complete built-in metadata states."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN='04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE='a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    if text is None:return None
    width=1 if max(map(ord,text),default=0)<=255 else 2 if max(map(ord,text),default=0)<=65535 else 4
    return {'width':width,'bytes':b''.join(ord(c).to_bytes(width,'little') for c in text).hex()}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root',required=True,type=Path)
    p.add_argument('--fixture-root',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    args=p.parse_args();root=args.oracle_root.resolve()
    git=lambda *xs:subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain'))==(PIN,TREE,'')
    assert sys.version_info[:3]==(3,11,15)
    sys.path.insert(0,str(root))
    import regex
    from eyecite import helpers,models,regexes
    assert importlib.metadata.version('regex')=='2023.12.25' and regex.DEFAULT_VERSION==regex.V0
    sha=lambda b:hashlib.sha256(b).hexdigest()
    load=lambda name:args.fixture_root.joinpath(name).read_bytes()
    capture=load('regex-capture-reuse.json')
    assert sha(capture)=='b16b30ea812b82e4a1b7b6d2ab832014546cec43189f4cad4d829df77eedbe0c'
    profiles={r['patternSha256']:r for r in json.loads(capture)['patterns']}
    pattern=regexes.POST_FULL_CITATION_REGEX
    bindings=[]
    for raw in (f'^(?:{pattern})',f'(?:{pattern})$'):
        word=native(raw);fingerprint=sha(bytes([word['width']])+bytes.fromhex(word['bytes']))
        row=profiles[fingerprint];profile=row['engines']['python-regex-v0']['profile']
        compiled=regex.compile(raw,64)
        assert compiled.groups==profile['groups'] and dict(compiled.groupindex)==profile['names']
        assert not profile['repeatedCaptures'] and not profile['nullableMultiRepeat']
        bindings.append({'patternSha256':fingerprint,'flags':64,'profile':profile})
    law=load('law-metadata.json')
    assert sha(law)=='098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea'
    years=json.loads(law)['configuration']
    court=load('court-table.json')
    assert sha(court)=='2a0ee8d810577297440ff5a52da8b479a265953262ea1fb479005ef95ae6054c'
    court_payload=json.loads(court)['payload']
    tails=['', ' ', 'plain prose', ', 42', ', at 42', ', 42, ', ', 42-44', ', ¶ 12', ', 12:24-25', ', ١٢', ', 𑽐', ' (1999)', ' (2020)', ' (9999)', ' (0000)', ' (2d Cir. 2020)', ' (4TH CIR 2020)', ' (S.C. 1999)', ' (not-a-court 1999)', ' (Jan. 2020)', ' (Jan. 1, 2020)', ' [4th Cir. Jan. 1, 2012]', ' (2001-02)', ' (bad)', ' (𑽐𑽐𑽐𑽐)', ' (2020) (note)', ' (2020) (note) (other)', ' (2020) (2021)', ' (2020) ()', ' (2020) (nested (inner) text)', ' (2020) (😀 note)', ' (2020) (\ud83d\ude00 note)', ' (2020) (\ud800)', ', 4-5, 2 S. Ct. 2, 6-7 (4th Cir. Jan. 1, 2012) (overruling foo)', ', 42, 44, 50 (2d Cir. 2020)', ', 2 S. Ct. 2 (2020)', ',\u00a0 42 (1999)', ', 42'+ ' '*299+' (2020)', ' (2020) ('+'x'*301+')']
    vectors=[[('Text',text)] for text in tails]
    vectors += [[],[('ParagraphToken','\n\n'),('Text',' (2020)')],[('Text',' (2020)'),('ParagraphToken','\n\n'),('Text',' (other)')],[('Text',' (2d '),('IdToken','Cir.'),('Text',' 2020)')],[('Token',None),('Text',' (2020)')],[('Text',' (2020) '),('Token','(note)')],[('Text',', 42'),('Text',' (1999)')]]
    helpers._highest_valid_year=2027
    original_search,original_match=helpers.re.search,helpers.re.match
    calls=[]
    def search(raw,text,flags=0):
        assert raw==f'^(?:{pattern})' and flags==64
        calls.append('post');return original_search(raw,text,flags=flags)
    def match(raw,text,flags=0):
        assert raw==regexes.YEAR_REGEX and flags==64
        calls.append('year');return original_match(raw,text,flags=flags)
    rows=[]
    for vector_id,vector in enumerate(vectors):
        for span_end in (0,25):
            for state,(prior_year,prior_pin,prior_court) in enumerate(((None,None,None),(1998,7,'SEED'))):
                token=models.CitationToken('1 X 1',20,25,{'volume':'1','reporter':'X','page':'1'})
                words=[token]+[text if kind=='Text' else getattr(models,kind)(text,0,0) for kind,text in vector]
                cite=models.FullCaseCitation(token,0,span_end=span_end,full_span_end=777,year=prior_year,metadata={'pin_cite':'SEED','pin_cite_span_end':prior_pin,'extra':'SEED','parenthetical':'SEED','year':'SEED','month':'SEED','day':'SEED','court':prior_court})
                calls.clear()
                with patch.object(helpers.re,'search',search),patch.object(helpers.re,'match',match):
                    assert helpers.add_post_citation(cite,words) is None
                observed={'fullSpanEnd':cite.full_span_end,'year':cite.year,'pinCiteSpanEnd':cite.metadata.pin_cite_span_end,'court':cite.metadata.court,'metadata':{out:native(getattr(cite.metadata,name)) for out,name in [('pinCite','pin_cite'),('extra','extra'),('parenthetical','parenthetical'),('year','year'),('month','month'),('day','day')]}}
                rows.append({'id':len(rows),'smoke':span_end==25 and state==1 and vector_id in (0,3,15,17,19,25,26,27,30,31,33,40,42,43,44,45),'request':{'words':[{'kind':'CitationToken','data':native(token.data)}]+[{'kind':kind,'data':native(text)} for kind,text in vector],'index':0,'spanEnd':span_end,'year':prior_year,'pinCiteSpanEnd':prior_pin,'court':native(prior_court)},'observed':observed,'calls':len(calls)})
    word=native(pattern)
    config={'pattern':word,'bindings':bindings,'courtTable':court_payload,**{key:years[key] for key in ('yearPattern','yearBindings','highestValidYear')}}
    strip_values=[None,'',' \t ','SEED','\u200b X \u200b','\ud83d\ude00','😀','\ud800']+[chr(point)+'X'+chr(point) for point in range(0x110000) if chr(point).isspace()]
    strips=[{'source':native(text),'result':native(None if text is None else text.strip() or None)} for text in strip_values]
    out={'strips':strips,'schemaVersion':'citation-post-case-metadata/v1','oracleCommit':PIN,'oracleTree':TREE,'python':'3.11.15','regex':'2023.12.25','producerSha256':sha(Path(__file__).read_bytes()),'captureCorpusSha256':sha(capture),'courtCorpusSha256':sha(court),'patternSha256':sha(bytes([word['width']])+bytes.fromhex(word['bytes'])),'configuration':config,'cases':rows}
    args.output.write_text(json.dumps(out,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'cases':len(rows),'calls':sum(r['calls'] for r in rows),'smokeCases':sum(r['smoke'] for r in rows),'smokeCalls':sum(r['calls'] for r in rows if r['smoke']),'patternSha256':out['patternSha256']}))


if __name__=='__main__':main()
