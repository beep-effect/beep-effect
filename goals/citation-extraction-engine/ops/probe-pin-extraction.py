#!/usr/bin/env python3
"""Observe original extract_pin_cite, source indexing, prefixes and pin-span ends."""
import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
from re import _parser
import subprocess
import sys
from unittest.mock import patch

PIN = '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE = 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
LAW = '098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea'


def native(text):
    if text is None: return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {'width':width, 'bytes':b''.join(ord(c).to_bytes(width,'little') for c in text).hex()}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root', required=True, type=Path)
    p.add_argument('--fixture-root', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain')) == (PIN,TREE,'')
    assert sys.version_info[:3] == (3,11,15)
    sys.path.insert(0,str(root))
    import regex
    from eyecite import helpers, models, regexes
    assert importlib.metadata.version('regex') == '2023.12.25' and regex.DEFAULT_VERSION == regex.V0
    sha = lambda b: hashlib.sha256(b).hexdigest()
    spec = importlib.util.spec_from_file_location('verbose',Path(__file__).with_name('probe-regex-verbose.py'))
    verbose = importlib.util.module_from_spec(spec); spec.loader.exec_module(verbose)
    pattern = regexes.POST_SHORT_CITATION_REGEX
    bindings = []
    for raw in (f'^(?:{pattern})',f'(?:{pattern})$'):
        compiled = regex.compile(raw,64)
        tree = _parser.parse(raw,64)
        assert compiled.groups == 2 and dict(compiled.groupindex) == tree.state.groupdict
        width,repeated,nullable = verbose.cpython_profile(tree)
        word = native(raw)
        bindings.append({'patternSha256':sha(bytes([word['width']])+bytes.fromhex(word['bytes'])),'flags':64,'profile':{'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}})
    raw_law = (args.fixture_root/'law-metadata.json').read_bytes(); assert sha(raw_law)==LAW
    law = json.loads(raw_law)['configuration']
    original_search,original_match = helpers.re.search,helpers.re.match
    calls=[]
    def search(raw,text,flags=0):
        assert raw==f'^(?:{pattern})' and flags==64
        calls.append('post'); return original_search(raw,text,flags=flags)
    def match(raw,text,flags=0):
        assert raw==regexes.YEAR_REGEX and flags==64
        calls.append('year'); return original_match(raw,text,flags=flags)
    rows=[]
    def observe(vector,index,end,prefix,smoke=False):
        words=[text if kind=='Text' else getattr(models,kind)(text,0,end) for kind,text in vector]
        calls.clear()
        result=error=None
        with patch.object(helpers.re,'search',search),patch.object(helpers.re,'match',match):
            try:
                pin,span,parenthetical=helpers.extract_pin_cite(words,index,prefix)
                result={'pinCite':native(pin),'pinCiteSpanEnd':span,'parenthetical':native(parenthetical)}
            except IndexError: error='index-out-of-range'
            except AttributeError: error='invalid-token'
        rows.append({'id':len(rows),'smoke':smoke,'request':{'words':[{'kind':k,'data':native(t)} for k,t in vector],'index':index,'tokenEnd':end,'prefix':native(prefix)},'result':result,'error':error,'calls':len(calls)})
    tails=['',' at 42',', 42, ',' 12-14 (note)',' (2020)',' (note) (extra)',' (note (nested) text)',' ()',' (note) trailing)','x',',¶12',' 12:24-124:25',' n. 2, 3',' ١٢',' 𑽐',' 😀','\ud835\udfce',' 42\n',' 42\n(note)',' (é😀)',' (é\ud800)']
    prefixes=['','at ',', 12, ','😀','\ud835\udfce']
    for tail_id,tail in enumerate(tails):
        for prefix_id,prefix in enumerate(prefixes):
            for end in (-7,17):
                for negative in (False,True):
                    vector=[('Text',tail),('IdToken','Id.')] if negative else [('IdToken','Id.'),('Text',tail)]
                    smoke=end==17 and ((not negative and prefix_id==0 and tail_id in (0,1,4,5,7,13,14,19)) or (tail_id==0 and not negative and prefix_id in (2,3,4)) or (negative and tail_id==1 and prefix_id==0))
                    observe(vector,-1 if negative else 0,end,prefix,smoke)
    controls=[([('IdToken','Id.'),('Text',' at 42'),('ParagraphToken','\n'),('Text',' (note)')],0,''),([('IdToken','Id.'),('IdToken','Id.'),('Text',' at 42')],0,''),([('IdToken','Id.'),('Text',' at 42'),('IdToken','Id.'),('Text',' (note)')],0,''),([('Token',None),('Text',' at 42')],0,''),([('IdToken','Id.'),('Text','9'*301)],0,''),([('IdToken','Id.')],0,'9'*301),([('Text','Id.'),('Text',' (note)')],0,''),([('Text','Id.'),('Text',' at 42')],-1,''),([],0,''),([], -1,''),([('IdToken','Id.')],2,''),([('IdToken','Id.')],-2,'')]
    for vector,index,prefix in controls: observe(vector,index,17,prefix,True)
    detail_words=[None,'',', ',' , 12 , ','\t,12,\t',',  ,','😀, ','\ud835\udfce, ', ' at 42, ']
    details=[{'source':native(word),'pinCite':native(helpers.clean_pin_cite(word)),'trailingEnd':0 if word is None else len(word.rstrip(', '))} for word in detail_words]
    word=native(pattern)
    out={'schemaVersion':'citation-pin-extraction/v1','oracleCommit':PIN,'oracleTree':TREE,'python':'3.11.15','regex':'2023.12.25','producerSha256':sha(Path(__file__).read_bytes()),'patternSha256':sha(bytes([word['width']])+bytes.fromhex(word['bytes'])),'configuration':{'pattern':word,'bindings':bindings,**{k:law[k] for k in ('yearPattern','yearBindings','highestValidYear')}},'details':details,'cases':rows}
    args.output.write_text(json.dumps(out,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'cases':len(rows),'calls':sum(r['calls'] for r in rows),'smokeCases':sum(r['smoke'] for r in rows),'smokeCalls':sum(r['calls'] for r in rows if r['smoke']),'patternSha256':out['patternSha256']}))


if __name__=='__main__': main()
