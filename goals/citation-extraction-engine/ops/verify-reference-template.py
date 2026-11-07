#!/usr/bin/env python3
"""Seal original reference-template boundaries and exhaustive escape observations."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

CORPUS_SHA='25b2e91fac26f724a24f9822d299169cdc2dde8cd55cb91f1210b01f97ff9e68'
PRODUCER_SHA='5dcc9681b7e99c839d5c91c5c04bd447ac582bb40d6d6ea500480734a5ec1f57'
PROFILE_SHA='c86c958858149b6b74f8b8b594e72123e65da2b1a71eeaac1ab8a806452834a1'


def text(value):
    width=value['width'];raw=bytes.fromhex(value['bytes'])
    assert width in [1,2,4] and len(raw)%width==0
    values=[int.from_bytes(raw[i:i+width],'little') for i in range(0,len(raw),width)]
    largest=max(values,default=0)
    assert largest<=0x10ffff and width==(1 if largest<=255 else 2 if largest<=65535 else 4)
    return ''.join(map(chr,values))


def validate(data):
    assert data['schemaVersion']=='citation-reference-template/v1'
    assert data['oracleCommit']=='04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree']=='a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['producerSha256']==PRODUCER_SHA and data['profileProducerSha256']==PROFILE_SHA
    assert data['python']=='3.11.15'
    assert data['escapeDomain']==0x110000
    assert data['escapeObservationSha256']=='932c4be4946c3fbcdf01c738013a5c4cb6841a2ec5194f16a28c7a83ff174a04'
    assert data['escapePoints']==[9,10,11,12,13,32,35,36,38,40,41,42,43,45,46,63,91,92,93,94,123,124,125,126]
    assert set(data['patterns'])==set(data['fingerprints'])=={'pinPrefix','pinSuffix','markupPrefix','markupSuffix','rejection'}
    for key,value in data['patterns'].items():
        text(value)
        assert hashlib.sha256(bytes([value['width']])+bytes.fromhex(value['bytes'])).hexdigest()==data['fingerprints'][key]
    assert data['profiles']['pin']['minimumWidthFloor']-data['profiles']['pin']['literalPoints']==2
    assert data['profiles']['markup']['minimumWidthFloor']-data['profiles']['markup']['literalPoints']==7
    rows=data['literalCases'];assert len(rows)==278
    assert {r['mode'] for r in rows}=={'pin','markup'}
    for row in rows:
        name=text(row['name']);text(row['pattern']);profile=row['profile']
        markup=row['mode']=='markup'
        assert row['flags']==(0 if markup else 64) and profile['groups']==2
        assert profile['names']==({'plaintiff':2} if markup else {'plaintiff':1,'pin_cite':2})
        assert not profile['repeatedCaptures'] and not profile['nullableMultiRepeat']
        words=name.strip().split()
        minimum=sum(map(len,words))+len(words)-1+7 if markup else len(name)+2
        assert profile['minimumWidthFloor']==minimum
    assert all(any(text(r['name'])=='A'+chr(point)+'Z' and r['mode']==mode for r in rows) for point in range(128) for mode in ['pin','markup'])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--oracle-root',type=Path)
    args=parser.parse_args();ops=Path(__file__).resolve().parent
    fixture=ops.parents[2]/'packages/law-practice/use-cases/test/fixtures/eyecite/reference-template.json'
    raw=fixture.read_bytes();sha=lambda data:hashlib.sha256(data).hexdigest()
    assert sha(raw)==CORPUS_SHA and sha((ops/'probe-reference-template.py').read_bytes())==PRODUCER_SHA
    assert sha((ops/'probe-regex-verbose.py').read_bytes())==PROFILE_SHA
    data=json.loads(raw);validate(data);controls=0
    if args.self_test:
        mutations=[]
        for key in ['oracleCommit','producerSha256','profileProducerSha256']:
            changed=copy.deepcopy(data);changed[key]='0'*len(changed[key]);mutations.append(changed)
        changed=copy.deepcopy(data);changed['escapePoints'].pop();mutations.append(changed)
        changed=copy.deepcopy(data);changed['escapeDomain']-=1;mutations.append(changed)
        changed=copy.deepcopy(data);changed['fingerprints']['pinPrefix']='0'*64;mutations.append(changed)
        changed=copy.deepcopy(data);changed['literalCases'][0]['profile']['minimumWidthFloor']+=1;mutations.append(changed)
        changed=copy.deepcopy(data);changed['literalCases'].pop();mutations.append(changed)
        changed=copy.deepcopy(data);changed['literalCases'][0]['profile']['repeatedCaptures']=True;mutations.append(changed)
        for changed in mutations:
            try:validate(changed)
            except AssertionError:controls+=1;continue
            raise AssertionError('changed literal-template source evidence accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-literal-') as scratch:
            output=Path(scratch)/'template.json'
            subprocess.run([str(args.oracle_root/'.venv/bin/python'),str(ops/'probe-reference-template.py'),'--oracle-root',str(args.oracle_root),'--output',str(output)],check=True,capture_output=True)
            assert output.read_bytes()==raw
    print(json.dumps({'sourceEvidenceOnly':True,'literalCases':278,'escapeDomain':0x110000,'controls':controls,'oracleReplayed':args.oracle_root is not None}))


if __name__=='__main__':main()
