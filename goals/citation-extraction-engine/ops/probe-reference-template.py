#!/usr/bin/env python3
"""Capture literal insertion boundaries and escaping from original reference code."""
import argparse
import ast
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from re import _parser
import subprocess
import sys
from unittest.mock import patch


def native(text):
    width=1 if max(map(ord,text),default=0)<=255 else 2 if max(map(ord,text),default=0)<=65535 else 4
    return {'width':width,'bytes':b''.join(ord(c).to_bytes(width,'little') for c in text).hex()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();root=args.oracle_root.resolve()
    git=lambda *xs:subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain'))==('04d82c032ad5fd0f9ab72a61c87110c46ee8f52e','a35a58fac03400f71a93a93485b77f1d56f2b02f','')
    assert sys.version_info[:3]==(3,11,15)
    sys.path.insert(0,str(root))
    from eyecite import find,models,regexes,tokenizers
    ops=Path(__file__).resolve().parent
    spec=importlib.util.spec_from_file_location('profile',ops/'probe-regex-verbose.py');profile=importlib.util.module_from_spec(spec);spec.loader.exec_module(profile)
    sentinel='CITATIONLITERALINSERTION'
    pin=regexes.reference_pin_cite_re([f'(?P<plaintiff>{sentinel})'])
    document=models.Document(markup_text=f'<p>Roe v. Wade, 410 U.S. 113. <i>{sentinel}</i></p>',clean_steps=['html'])
    document.tokenize(tokenizers.default_tokenizer)
    index,_=next((i,t) for i,t in document.citation_tokens if type(t) is models.CitationToken and not t.short)
    cite=find._extract_full_citation(document,index)
    for field in models.ReferenceCitation.name_fields:setattr(cite.metadata,field,None)
    cite.metadata.plaintiff=sentinel
    observed=[];original_finditer=re.finditer
    def spy(pattern,source,flags=0):
        observed.append(pattern);return original_finditer(pattern,source,flags)
    with patch.object(re,'finditer',spy):find.find_reference_citations_from_markup(document,[cite])
    assert len(observed)==1
    markup=observed[0]
    marker=f'(?P<plaintiff>{sentinel})'
    patterns={}
    for name,text in [('pin',pin),('markup',markup)]:
        parts=text.split(marker);assert len(parts)==2
        patterns[name+'Prefix'],patterns[name+'Suffix']=map(native,parts)
    tree=ast.parse((root/'eyecite/find.py').read_text())
    function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='find_reference_citations_from_markup')
    rejection=next(n.args[0].value for n in ast.walk(function) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='match' and isinstance(n.args[0],ast.Constant))
    patterns['rejection']=native(rejection)
    sha=lambda raw:hashlib.sha256(raw).hexdigest()
    fingerprints={key:sha(bytes([value['width']])+bytes.fromhex(value['bytes'])) for key,value in patterns.items()}
    facts={}
    for mode,text,flags in [('pin',pin,64),('markup',markup,0),('rejection',rejection,0)]:
        compiled=re.compile(text,flags);width,repeated,nullable=profile.cpython_profile(_parser.parse(text,flags))
        facts[mode]={'flags':flags,'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,
                     'literalPoints':0 if mode=='rejection' else len(sentinel),'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}
    escape=[];checks=hashlib.sha256()
    for point in range(0x110000):
        char=chr(point);escaped=re.escape(char)
        if escaped!=char:
            assert escaped=='\\'+char;escape.append(point)
        checks.update(point.to_bytes(4,'little'));checks.update(escaped.encode('utf-32-le','surrogatepass'))
    literal_cases=[]
    original_compile=re.compile
    def observe_compile(pattern,flags=0):
        observed.append(pattern);return original_compile(pattern,flags)
    names=['A'+chr(point)+'Z' for point in list(range(128))+[0x85,0xa0,0x2003,0xd800,0xdc00,0x10000,0x10ffff]]
    names+=['A \t  Z','A \u00a0 Z','A. ','A\ud800\udc00Z']
    for value in names:
        cite.metadata.plaintiff=value
        for mode,flags in [('pin',64),('markup',0)]:
            observed.clear()
            if mode=='pin':
                with patch.object(re,'compile',observe_compile):find.extract_pincited_reference_citations(cite,'')
            else:
                with patch.object(re,'finditer',spy):find.find_reference_citations_from_markup(document,[cite])
            assert len(observed)==1,(mode,repr(value),observed)
            raw=observed[0];compiled=original_compile(raw,flags)
            width,repeated,nullable=profile.cpython_profile(_parser.parse(raw,flags))
            literal_cases.append({'mode':mode,'name':native(value),'pattern':native(raw),'flags':flags,
                                  'profile':{'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}})
    repo=ops.parents[2]
    result={'schemaVersion':'citation-reference-template/v1','oracleCommit':git('rev-parse','HEAD'),'oracleTree':git('rev-parse','HEAD^{tree}'),
            'python':'3.11.15','producerSha256':sha(Path(__file__).read_bytes()),'profileProducerSha256':sha((ops/'probe-regex-verbose.py').read_bytes()),
            'sources':{name:sha((root/'eyecite'/name).read_bytes()) for name in ['find.py','models.py','regexes.py']},
            'licenseSha256':sha((root/'LICENSE').read_bytes()),'lockSha256':sha((root/'uv.lock').read_bytes()),
            'literalCases':literal_cases,'patterns':patterns,'fingerprints':fingerprints,'profiles':facts,'escapePoints':escape,'escapeDomain':0x110000,'escapeObservationSha256':checks.hexdigest(),
            'scope':'Actual source insertion boundaries and exhaustive one-point stdlib escaping; parameterized rendering/profile proof remains target work.'}
    formatter=['bunx','--no-install','biome'];result['formatter']=subprocess.check_output(formatter+['--version'],cwd=repo,text=True).strip()
    fixture=repo/'packages/law-practice/use-cases/test/fixtures/eyecite/reference-template.json'
    formatted=subprocess.run(formatter+['format','--stdin-file-path='+str(fixture)],input=json.dumps(result,sort_keys=True,indent=2)+'\n',cwd=repo,text=True,capture_output=True,check=True)
    args.output.write_text(formatted.stdout)
    print(json.dumps({'fingerprints':fingerprints,'profiles':facts,'escapePoints':escape,'escapeDomain':0x110000,'literalCases':len(literal_cases)}))


if __name__=='__main__':main()
