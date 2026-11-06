#!/usr/bin/env python3
"""Capture original named/markup reference generation and dynamic source patterns."""
import argparse
import copy
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import re
from re import _parser
import subprocess
import sys
from unittest.mock import patch


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {'width':width,'bytes':b''.join(ord(c).to_bytes(width,'little') for c in text).hex()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    root=args.oracle_root.resolve()
    git=lambda *xs:subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain'))==('04d82c032ad5fd0f9ab72a61c87110c46ee8f52e','a35a58fac03400f71a93a93485b77f1d56f2b02f','')
    assert sys.version_info[:3]==(3,11,15)
    sys.path.insert(0,str(root))
    from eyecite import find, models, tokenizers, utils
    sha=lambda raw:hashlib.sha256(raw).hexdigest()
    ops=Path(__file__).resolve().parent
    spec=importlib.util.spec_from_file_location('verbose_profile',ops/'probe-regex-verbose.py')
    profile=importlib.util.module_from_spec(spec);spec.loader.exec_module(profile)
    names=['Roe','Wade','State','United States','state','Co.','AB','123','Éclair','Σigma','𐐀Name','A😀B','A\ud83d\ude00B','A+B','A#B','A(B)','A|B','A\\B','A B','Commissioner','Akerman','commissionerAkerman','',None]
    names+=utils.DISALLOWED_NAMES
    validity=[{'name':native(name),'valid':utils.is_valid_name(name)} for name in names]
    definitions=[]
    prefix='Roe v. Wade, 410 U.S. 113 (1973). '
    for field in models.ReferenceCitation.name_fields:
        for name in names[:24]:
            definitions.append({'mode':'pin','plain':prefix+str(name)+' at 120.','metadata':{field:name}})
    definitions.extend([
        {'mode':'pin','plain':prefix+'Roe at 120; Wade at 121. Roe at 122.','metadata':{'plaintiff':'Roe','defendant':'Wade'}},
        {'mode':'pin','plain':prefix+'Roe at 120.','metadata':dict.fromkeys(models.ReferenceCitation.name_fields,'Roe')},
        {'mode':'pin','plain':prefix+'Roe at 120suffix; Roe at 121. Roe at ١٢٢.','metadata':{'plaintiff':'Roe'}},
        {'mode':'pin','plain':prefix+'Roe at 120.','metadata':{}},
        {'mode':'combined','plain':prefix+'Roe at 120.','metadata':{'plaintiff':'Roe'}},
        {'mode':'combined','plain':'35 U.S.C. § 101. Roe at 120.','kind':'law','metadata':{}},
    ])
    markup_prefix='<p><i>Roe</i> v. Wade, 410 U.S. 113 (1973). '
    for body in ['<em>Roe</em>','<i>Roe</i>','<em>Roe</i>','<EM>Roe</EM>','<i class="x">Roe</i>',
                 '<em> Roe ,; </em>','<em>Roe</em> v. Other','<em>Roe</em> vs Other','<em>Roe</em> supra Other',
                 '<em>Roe</em> v Other','<em>Roe</em> at 120.','<em>Wade</em> then <i>Roe</i>',
                 '<em>Roe\nWade</em>','<em>Roe&nbsp;Wade</em>','<em>Roe <b>Wade</b></em>']:
        definitions.append({'mode':'combined','markup':markup_prefix+body+'</p>','metadata':{'plaintiff':'Roe','defendant':'Wade'}})
    definitions.extend([
        {'mode':'markup','markup':markup_prefix+'<em>Roe\n Wade</em></p>','metadata':{'resolved_case_name':'Roe Wade'}},
        {'mode':'markup','markup':markup_prefix+'<em>Roe</em></p>','metadata':{'plaintiff':'Roe'},'missingGeometry':True},
        {'mode':'combined','plain':prefix,'metadata':{}},
        {'mode':'pin','plain':prefix+'Roe at 120.','metadata':{'plaintiff':'Roe'},'spanEnd':1000},
    ])
    saved={name:getattr(re,name) for name in ['compile','finditer','match']}
    patterns={}
    cases=[]
    def project(c):
        return {'kind':type(c).__name__,'index':c.index,'tokenKind':type(c.token).__name__,'token':native(c.token.data),
                'tokenStart':c.token.start,'tokenEnd':c.token.end,'spanStart':c.span_start,'spanEnd':c.span_end,
                'fullSpanStart':c.full_span_start,'fullSpanEnd':c.full_span_end,'span':list(c.span()),'fullSpan':list(c.full_span()),
                'metadata':{key:native(value) if isinstance(value,str) else value for key,value in vars(c.metadata).items()},
                'documentAttached':c.document is not None}
    def match_snapshot(match):
        if match is None:return None
        return {'spans':[list(match.span(i)) for i in range(len(match.groups())+1)],
                'groups':[native(match.group(i)) for i in range(len(match.groups())+1)],
                'names':{key:native(value) for key,value in match.groupdict().items()}}
    for definition in definitions:
        document=models.Document(markup_text=definition['markup'],clean_steps=['html']) if 'markup' in definition else models.Document(plain_text=definition['plain'])
        document.tokenize(tokenizers.default_tokenizer)
        index,token=next((i,t) for i,t in document.citation_tokens if type(t) is models.CitationToken and not t.short)
        citation=find._extract_full_citation(document,index)
        for field in models.ReferenceCitation.name_fields:
            if hasattr(citation.metadata,field):setattr(citation.metadata,field,definition['metadata'].get(field))
        if 'spanEnd' in definition:citation.span_end=definition['spanEnd']
        if definition.get('missingGeometry'):document.plain_to_markup=None
        before=project(citation)
        calls=[]
        def identity(pattern,flags):
            word=native(pattern);key=sha(bytes([word['width']])+bytes.fromhex(word['bytes']))+':'+str(int(flags))
            patterns[key]=(pattern,int(flags));return key
        def iterator(pattern,subject,flags,iterator):
            event={'operation':'finditer','pattern':identity(pattern,flags),'subject':native(subject),'matches':[]};calls.append(event)
            for match in iterator:event['matches'].append(match_snapshot(match));yield match
        class Compiled:
            def __init__(self,pattern,flags):self.pattern,self.flags,self.compiled=pattern,flags,saved['compile'](pattern,flags)
            def finditer(self,subject):return iterator(self.pattern,subject,self.flags,self.compiled.finditer(subject))
        def observed_finditer(pattern,subject,flags=0):return iterator(pattern,subject,flags,saved['finditer'](pattern,subject,flags))
        def observed_match(pattern,subject,flags=0):
            match=saved['match'](pattern,subject,flags)
            calls.append({'operation':'match','pattern':identity(pattern,flags),'subject':native(subject),'matches':[] if match is None else [match_snapshot(match)]})
            return match
        with patch.object(re,'compile',Compiled),patch.object(re,'finditer',observed_finditer),patch.object(re,'match',observed_match):
            if definition['mode']=='pin':found=find.extract_pincited_reference_citations(citation,document.plain_text)
            elif definition['mode']=='markup':found=find.find_reference_citations_from_markup(document,[citation])
            else:found=find.extract_reference_citations(citation,document)
        assert before==project(citation)
        cases.append({'id':len(cases),'mode':definition['mode'],'plain':native(document.plain_text),'markup':native(document.markup_text),
                      'missingGeometry':bool(definition.get('missingGeometry')),'citation':before,'calls':calls,'expected':[project(c) for c in found]})
    bindings=[]
    for identity,(pattern,flags) in sorted(patterns.items()):
        compiled=saved['compile'](pattern,flags)
        width,repeated,nullable=profile.cpython_profile(_parser.parse(pattern,flags))
        bindings.append({'id':identity,'engine':'python-re','pattern':native(pattern),'patternSha256':identity.split(':')[0],'flags':flags,
                         'profile':{'groups':compiled.groups,'names':dict(compiled.groupindex),'minimumWidthFloor':width,'repeatedCaptures':repeated,'nullableMultiRepeat':nullable}})
    repo=ops.parents[2]
    output={'schemaVersion':'citation-generated-references/v1','oracleCommit':git('rev-parse','HEAD'),'oracleTree':git('rev-parse','HEAD^{tree}'),
            'producerSha256':sha(Path(__file__).read_bytes()),'profileProducerSha256':sha((ops/'probe-regex-verbose.py').read_bytes()),
            'licenseSha256':sha((root/'LICENSE').read_bytes()),'lockSha256':sha((root/'uv.lock').read_bytes()),'python':'3.11.15',
            'sources':{name:sha((root/'eyecite'/name).read_bytes()) for name in ['find.py','helpers.py','models.py','utils.py','regexes.py']},
            'versions':{name:importlib.metadata.version(name) for name in ['eyecite','regex','lxml','reporters-db','courts-db']},
            'nameFields':models.ReferenceCitation.name_fields,'validity':validity,'disallowedNames':utils.DISALLOWED_NAMES,
            'patterns':bindings,'cases':cases,'scope':'Actual original named/markup generation with controlled built-in metadata; dynamic source profiles are observations, not runtime execution authority or target proof.'}
    formatter=['bunx','--no-install','biome'];output['formatter']=subprocess.check_output(formatter+['--version'],cwd=repo,text=True).strip()
    fixture=repo/'packages/law-practice/use-cases/test/fixtures/eyecite/generated-references.json'
    formatted=subprocess.run(formatter+['format','--stdin-file-path='+str(fixture)],input=json.dumps(output,ensure_ascii=True,sort_keys=True,indent=2)+'\n',cwd=repo,text=True,capture_output=True,check=True)
    args.output.write_text(formatted.stdout)
    assert git('status','--porcelain')==''
    print(json.dumps({'cases':len(cases),'patterns':len(bindings),'references':sum(len(c['expected']) for c in cases),'calls':sum(len(c['calls']) for c in cases),'validity':len(validity)}))


if __name__=='__main__':main()
