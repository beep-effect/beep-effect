#!/usr/bin/env python3
"""Seal original generated-reference observations without granting regex authority."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

CORPUS_SHA='a741045d3c71ca4437c54e3af1781063c5ec66c091bfdfc4a4dbb2abce5d4006'
PRODUCER_SHA='214c134e99b8900920aa600fa976bae213da2f6d415909b0dde4f933864fb296'
PROFILE_SHA='c86c958858149b6b74f8b8b594e72123e65da2b1a71eeaac1ab8a806452834a1'


def points(value):
    width=value['width'];raw=bytes.fromhex(value['bytes'])
    assert width in [1,2,4] and len(raw)%width==0
    values=[int.from_bytes(raw[i:i+width],'little') for i in range(0,len(raw),width)]
    maximum=max(values,default=0)
    assert maximum<=0x10ffff and width==(1 if maximum<=255 else 2 if maximum<=65535 else 4)
    return values


def validate(data):
    assert data['schemaVersion']=='citation-generated-references/v1'
    assert data['oracleCommit']=='04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree']=='a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['producerSha256']==PRODUCER_SHA and data['profileProducerSha256']==PROFILE_SHA
    assert data['python']=='3.11.15'
    assert data['nameFields']==['plaintiff','defendant','resolved_case_name_short','resolved_case_name']
    assert len(data['validity'])==117
    patterns={row['id']:row for row in data['patterns']}
    assert len(patterns)==len(data['patterns'])==65
    for row in patterns.values():
        points(row['pattern'])
        digest=hashlib.sha256(bytes([row['pattern']['width']])+bytes.fromhex(row['pattern']['bytes'])).hexdigest()
        assert digest==row['patternSha256'] and row['id']==digest+':'+str(row['flags'])
        assert row['engine']=='python-re' and row['flags'] in [0,64]
        profile=row['profile']
        assert not profile['repeatedCaptures'] and not profile['nullableMultiRepeat']
        assert len(profile['names'])<=profile['groups'] and all(0<n<=profile['groups'] for n in profile['names'].values())
    cases=data['cases']
    assert len(cases)==121 and [r['id'] for r in cases]==list(range(121))
    assert sum(len(r['expected']) for r in cases)==77 and sum(len(r['calls']) for r in cases)==108
    referenced=set()
    for row in cases:
        plain=points(row['plain'])
        for call in row['calls']:
            referenced.add(call['pattern'])
            binding=patterns[call['pattern']]
            source=points(call['subject'])
            for match in call['matches']:
                assert len(match['spans'])==len(match['groups'])==binding['profile']['groups']+1
                assert set(match['names'])==set(binding['profile']['names'])
                for span,value in zip(match['spans'],match['groups']):
                    if value is None:assert span==[-1,-1]
                    else:assert 0<=span[0]<=span[1]<=len(source) and source[span[0]:span[1]]==points(value)
        for result in row['expected']:
            assert result['kind']=='ReferenceCitation' and result['tokenKind']=='CaseReferenceToken'
            assert result['index']==0 and result['documentAttached'] is False
            assert result['span']==[result['tokenStart'],result['tokenEnd']]==[result['spanStart'],result['spanEnd']]
            assert result['fullSpan']==[result['fullSpanStart'],result['fullSpanEnd']]
            start,end=result['span']
            assert plain[start:end]==points(result['token'])
    assert referenced==set(patterns)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--oracle-root',type=Path)
    args=parser.parse_args()
    ops=Path(__file__).resolve().parent
    fixture=ops.parents[2]/'packages/law-practice/use-cases/test/fixtures/eyecite/generated-references.json'
    raw=fixture.read_bytes();sha=lambda value:hashlib.sha256(value).hexdigest()
    assert sha(raw)==CORPUS_SHA and sha((ops/'probe-generated-references.py').read_bytes())==PRODUCER_SHA
    assert sha((ops/'probe-regex-verbose.py').read_bytes())==PROFILE_SHA
    data=json.loads(raw);validate(data)
    controls=0
    if args.self_test:
        mutations=[]
        for key in ['producerSha256','oracleCommit','profileProducerSha256']:
            item=copy.deepcopy(data);item[key]='0'*len(item[key]);mutations.append(item)
        item=copy.deepcopy(data);item['cases'].pop();mutations.append(item)
        item=copy.deepcopy(data);item['patterns'][0]['patternSha256']='0'*64;mutations.append(item)
        item=copy.deepcopy(data);item['patterns'][0]['engine']='python-regex-v0';mutations.append(item)
        item=copy.deepcopy(data);item['patterns'][0]['profile']['repeatedCaptures']=True;mutations.append(item)
        item=copy.deepcopy(data);next(r for r in item['cases'] if r['expected'])['expected'][0]['tokenEnd']+=1;mutations.append(item)
        item=copy.deepcopy(data);item['nameFields'].reverse();mutations.append(item)
        for item in mutations:
            try:validate(item)
            except (AssertionError,KeyError):controls+=1;continue
            raise AssertionError('structurally corrupted generated-reference evidence accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-generated-') as scratch:
            output=Path(scratch)/'generated.json'
            subprocess.run([str(args.oracle_root/'.venv/bin/python'),str(ops/'probe-generated-references.py'),'--oracle-root',str(args.oracle_root),'--output',str(output)],check=True,capture_output=True)
            assert output.read_bytes()==raw
    print(json.dumps({'sourceEvidenceOnly':True,'cases':121,'patterns':65,'references':77,'controls':controls,'oracleReplayed':args.oracle_root is not None}))


if __name__=='__main__':main()
