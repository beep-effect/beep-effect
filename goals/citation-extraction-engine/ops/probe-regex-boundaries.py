#!/usr/bin/env python3
"""Observe word-boundary grammar and all matching modes in both pinned engines."""
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

PIN='04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE='a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    width=1 if max(map(ord,text),default=0)<=255 else 2 if max(map(ord,text),default=0)<=65535 else 4
    return {'width':width,'bytes':b''.join(ord(c).to_bytes(width,'little')for c in text).hex()}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root',required=True,type=Path);p.add_argument('--output',required=True,type=Path)
    args=p.parse_args();root=args.oracle_root.resolve()
    git=lambda *xs:subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain'))==(PIN,TREE,'')
    assert sys.version_info[:3]==(3,11,15)
    import regex
    from regex import _regex_core as core
    assert importlib.metadata.version('regex')=='2023.12.25'and regex.DEFAULT_VERSION==regex.V0
    spec=importlib.util.spec_from_file_location('verbose',Path(__file__).with_name('probe-regex-verbose.py'))
    verbose=importlib.util.module_from_spec(spec);spec.loader.exec_module(verbose)
    def profile(node,repeated=False):
        if isinstance(node,core.Group):
            width,_,repeat,nullable=profile(node.subpattern,repeated);return width,True,repeated or repeat,nullable
        if isinstance(node,core.LookAround):
            assert not node.behind and node.positive
            _,captures,repeat,nullable=profile(node.subpattern,repeated);return 0,captures,repeat,nullable
        if isinstance(node,(core.GreedyRepeat,core.LazyRepeat)):
            multiple=node.max_count is None or node.max_count>1
            width,captures,repeat,nullable=profile(node.subpattern,repeated or multiple)
            return width*node.min_count,captures,repeat,nullable or (multiple and width==0)
        if isinstance(node,(core.Sequence,core.Branch)):
            rows=[profile(x,repeated)for x in (node.items if isinstance(node,core.Sequence)else node.branches)]
            width=sum(r[0]for r in rows)if isinstance(node,core.Sequence)else min(r[0]for r in rows)
            return width,*(any(r[i]for r in rows)for i in range(1,4))
        return (0 if node.is_empty()else node.max_width()),False,False,False
    texts=['','a',' ','a ',' a','word','word\n','a\n\n','Á','éA','Aé','Ⅰ','𑽑','١٢','😀','\ud801\udc28','𐐨','The Foo','theory','Thé foo','123\n','_A','A_','A-Case','\b']
    definitions=[(r'\b',0,True),(r'\B',0,True),(r'\bword\b',0,True),(r'\b([A-Z][a-zA-Z0-9]*)\b.*',0,True),(r'^(of|the|an|and)\b',2,True),(r'\b\d+\b$',0,True),(r'\b\w+\b',0,True),(r'[\b]',0,True),(r'[\B]',0,False),(r'\b+',0,False),(r'\B*',0,False),(r'(\b)*',0,False),(r'(?=(\b))a',0,True),(r'(\B)a?',0,True),(r'\b{0}',0,True),(r'a\b',0,True),(r'a\B',0,True)]
    sha=lambda b:hashlib.sha256(b).hexdigest();rows=[]
    for ordinal,(pattern,flags,smoke)in enumerate(definitions):
        word=native(pattern);row={'id':ordinal,'pattern':word,'flags':flags,'smoke':smoke,'patternSha256':sha(bytes([word['width']])+bytes.fromhex(word['bytes'])),'engines':{}}
        for name,engine in [('python-re',re),('python-regex-v0',regex)]:
            try:compiled=engine.compile(pattern,flags)
            except(re.error,regex.error):row['engines'][name]={'kind':'source-error','profile':None,'cases':[]};continue
            if name=='python-re':width,repeated,nullable=verbose.cpython_profile(_parser.parse(pattern,flags))
            else:
                source=core.Source(pattern);info=core.Info(flags|core.UNICODE|core.VERSION0)
                width,_,repeated,nullable=profile(core._parse_pattern(source,info))
            descriptor={'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}
            cases=[]
            witness={r'\bword\b':'word',r'\b([A-Z][a-zA-Z0-9]*)\b.*':' A-Case',r'^(of|the|an|and)\b':'The Foo',r'\b\d+\b$':'x ١٢\n',r'\b\w+\b':'Á',r'[\b]':'\b',r'a\b':'á',r'a\B':'á',r'(?=(\b))a':'a'}.get(pattern,'')
            ordered=[witness]+[text for text in texts if text!=witness]
            for text in ordered:
                modes={}
                for mode in('search','match','finditer'):
                    matches=list(compiled.finditer(text))if mode=='finditer'else[getattr(compiled,mode)(text)]
                    modes[mode]=[[list(m.span(g))for g in range(compiled.groups+1)]for m in matches if m is not None]
                cases.append({'source':native(text),'modes':modes})
            row['engines'][name]={'kind':'parser-only'if repeated or nullable else'single-match','profile':descriptor,'cases':cases}
        rows.append(row)
    out={'schemaVersion':'citation-regex-boundaries/v1','oracleCommit':PIN,'oracleTree':TREE,'python':'3.11.15','regex':'2023.12.25','producerSha256':sha(Path(__file__).read_bytes()),'profileReaderSha256':sha(Path(verbose.__file__).read_bytes()),'patterns':rows}
    args.output.write_text(json.dumps(out,sort_keys=True,indent=2)+'\n')
    counts={name:{str(full):sum((2 if r['engines'][name]['profile']['minimumWidthFloor']==0 else 3)*(len(r['engines'][name]['cases'])if full else 1)for r in rows if r['engines'][name]['kind']=='single-match'and(full or r['smoke']))for full in(False,True)}for name in('python-re','python-regex-v0')}
    print(json.dumps({'patterns':len(rows),'outcomes':2*len(rows),'observations':sum(3*len(e['cases'])for r in rows for e in r['engines'].values()),'counts':counts}))


if __name__=='__main__':main()
