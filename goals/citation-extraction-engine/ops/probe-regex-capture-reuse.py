#!/usr/bin/env python3
"""Capture V0 logical capture reuse and the exact full-case/supra source patterns."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
from re import _parser
import subprocess
import sys

PIN='04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE='a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    largest=max(map(ord,text),default=0)
    width=1 if largest<=255 else 2 if largest<=65535 else 4
    return {'width':width,'bytes':b''.join(ord(c).to_bytes(width,'little') for c in text).hex()}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    args=p.parse_args(); root=args.oracle_root.resolve()
    git=lambda *xs:subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain'))==(PIN,TREE,'')
    assert sys.version_info[:3]==(3,11,15)
    sys.path.insert(0,str(root))
    import regex
    from regex import _regex_core as core
    from eyecite import regexes
    assert importlib.metadata.version('regex')=='2023.12.25' and regex.DEFAULT_VERSION==regex.V0
    sha=lambda b:hashlib.sha256(b).hexdigest()
    def capture_plan(tree,info=None):
        physical=0
        closing=[]
        def walk(node):
            nonlocal physical
            if info is not None:
                if isinstance(node,core.Group):
                    physical+=1; current=physical
                    logical=info.private_groups.get(node.group,node.group)
                    walk(node.subpattern); closing.append([current,logical])
                elif isinstance(node,(core.LookAround,core.GreedyRepeat,core.LazyRepeat)): walk(node.subpattern)
                elif isinstance(node,(core.Sequence,core.Branch)):
                    for item in (node.items if isinstance(node,core.Sequence) else node.branches): walk(item)
            else:
                for op,value in node:
                    name=str(op)
                    if name=='SUBPATTERN':
                        physical+=1; current=physical
                        walk(value[3]); closing.append([current,value[0]])
                    elif name=='ASSERT': walk(value[1])
                    elif name=='BRANCH':
                        for branch in value[1]: walk(branch)
                    elif name in ('MAX_REPEAT','MIN_REPEAT'): walk(value[2])
        walk(tree)
        return {'physicalGroups':physical,'logicalGroups':len(set(row[1] for row in closing)),'closingOrder':closing}
    def v0_walk(node,repeated=False):
        if isinstance(node,core.Group):
            width,_,repeat,nullable=v0_walk(node.subpattern,repeated)
            return width,True,repeated or repeat,nullable
        if isinstance(node,core.LookAround):
            assert not node.behind and node.positive
            _,captures,repeat,nullable=v0_walk(node.subpattern,repeated)
            return 0,captures,repeat,nullable
        if isinstance(node,(core.GreedyRepeat,core.LazyRepeat)):
            multiple=node.max_count is None or node.max_count>1
            width,captures,repeat,nullable=v0_walk(node.subpattern,repeated or multiple)
            return width*node.min_count,captures,repeat,nullable or (multiple and width==0)
        if isinstance(node,(core.Sequence,core.Branch)):
            rows=[v0_walk(x,repeated) for x in (node.items if isinstance(node,core.Sequence) else node.branches)]
            width=sum(r[0] for r in rows) if isinstance(node,core.Sequence) else min(r[0] for r in rows)
            return width,*(any(r[i] for r in rows) for i in range(1,4))
        assert type(node).__name__ in ('Character','String','Property','Range','SetUnion','Any','StartOfString','EndOfString','EndOfStringLine'),type(node).__name__
        return (0 if node.is_empty() else node.max_width()),False,False,False
    controls=[
        ('(?P<x>a)(?P<x>b)','ab'),('(?P<x>a(?P<x>b))','ab'),('(?P<x>(?P<x>a)b)','ab'),
        ('(?:(?P<x>a)|(?P<x>b))','b'),('(?P<x>a)(?P<x>b)?','a'),('(?P<x>a)(?P<x>b?)','a'),
        ('(?P<x>a)?(?P<x>b)','b'),('(?=(?P<x>ab))(?P<x>a)','ab'),('(?P<x>a)(?=(?P<x>b))','ab'),
        ('(?P<x>(?P<x>a))','a'),('(?P<x>a(?P<y>b))(?P<x>c)','abc'),
        ('(?P<x>a)(b)(?P<x>c)(d)(?P<y>e)','abcde'),('(?P<x>a)|(?P<x>b)|(?P<x>c)','c'),
        ('(?P<x>a)(?:(?P<x>b)|(?P<x>c))?','ac'),('(?P<x>a)(?P<x>)','a'),
        ('(?P<x>a)(?P<x>)?','a'),('(?P<x>)(?P<x>a)?','b'),
        ('(?P<x>😀)|(?P<x>\ud83d\ude00)','\ud83d\ude00'),
        ('(?P<x>a)+(?P<x>b)','aab'),('(?:(?P<x>a)|(?P<x>b))+','aba'),
        ('(?=(?P<x>a))(?P<y>a)','a'),('(?P<x>a)(b)(?P<y>c)','abc'),
    ]
    definitions=[(pattern,[witness,'','a','ab','ac','abc','abcde','b','c','zab','aaa','abb','😀','\ud83d\ude00','a\n'],0,True) for pattern,witness in controls]
    full=regexes.POST_FULL_CITATION_REGEX
    tails=[', 4-5, 2 S. Ct. 2, 6-7 (4th Cir. Jan. 1, 2012) (overruling foo)', ' (1999)',' (2d Cir. 2020)',' (Jan. 2020)',', 42','', ' (2020) (note)', ' [4th Cir. Jan. 1, 2012]', ' (2001-02)', ' (bad)', ' (𑽐𑽐𑽐𑽐)']
    definitions += [(full,tails,64,False),(f'^(?:{full})',tails,64,True),(f'(?:{full})$',tails,64,False)]
    supra=regexes.SUPRA_ANTECEDENT_REGEX
    texts=['Adarand, 515 ','515 ','Adarand, ','','Éclair, 42 ','\ud835\udfce, ']
    definitions += [(supra,texts,64,True),(f'(?:{supra})$',texts,64,False)]
    rows=[]
    for index,(pattern,texts,flags,smoke) in enumerate(definitions):
        word=native(pattern)
        record={'id':index,'pattern':word,'flags':flags,'smoke':smoke,'patternSha256':sha(bytes([word['width']])+bytes.fromhex(word['bytes'])),'engines':{},'capturePlans':{}}
        for name,engine in [('python-re',re),('python-regex-v0',regex)]:
            try: compiled=engine.compile(pattern,flags)
            except (re.error,regex.error):
                record['engines'][name]={'kind':'source-error','profile':None,'cases':[]};continue
            if name=='python-regex-v0':
                source=core.Source(pattern);source.ignore_space=bool(flags&regex.X)
                info=core.Info(flags|core.UNICODE|core.VERSION0)
                tree=core._parse_pattern(source,info)
                width,_,repeated,nullable=v0_walk(tree)
            else:
                # The two non-reuse CPython controls have no repetition.
                tree=_parser.parse(pattern,flags);width=tree.getwidth()[0];repeated=nullable=False
            plan=capture_plan(tree,info if name=='python-regex-v0' else None)
            assert plan['logicalGroups']==compiled.groups
            record['capturePlans'][name]=plan
            profile={'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}
            cases=[]
            for text in texts:
                modes={}
                for mode in ('search','match','finditer'):
                    matches=list(compiled.finditer(text)) if mode=='finditer' else [getattr(compiled,mode)(text)]
                    modes[mode]=[[list(m.span(g)) for g in range(compiled.groups+1)] for m in matches if m is not None]
                cases.append({'source':native(text),'modes':modes})
            record['engines'][name]={'kind':'parser-only' if repeated or nullable else 'single-match','profile':profile,'cases':cases}
        rows.append(record)
    out={'schemaVersion':'citation-regex-capture-reuse/v1','oracleCommit':PIN,'oracleTree':TREE,'python':'3.11.15','regex':'2023.12.25','producerSha256':sha(Path(__file__).read_bytes()),'patterns':rows}
    args.output.write_text(json.dumps(out,sort_keys=True,indent=2)+'\n')
    counts={name:{str(full):sum((2 if r['engines'][name]['profile']['minimumWidthFloor']==0 else 3)*(len(r['engines'][name]['cases']) if full else 1) for r in rows if r['engines'][name]['kind']=='single-match' and (full or r['smoke'])) for full in (False,True)} for name in ('python-re','python-regex-v0')}
    print(json.dumps({'patterns':len(rows),'sourceCalls':sum(3*len(e['cases']) for r in rows for e in r['engines'].values()),'runtimeCalls':counts}))


if __name__=='__main__':main()
