#!/usr/bin/env python3
"""Verify sealed original final-selection evidence, controls and optional replay."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

CORPUS_SHA = '0b3f8384253f42427484e0ce7c92b9c659a69d2c18ab0cbaddac4ed4d6a85df4'
PRODUCER_SHA = 'b5ed0e1b3f65abc1e926d4c5e04c9c81ea791125e59ff4b59c1fa3ae4a5a3512'


def validate(corpus):
    assert corpus['schemaVersion'] == 'citation-extraction-selection/v1'
    assert corpus['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert corpus['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert corpus['producerSha256'] == PRODUCER_SHA
    assert corpus['python'] == '3.11.15'
    assert corpus['licenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    rows = corpus['cases']
    assert len(rows) == 148 and [r['id'] for r in rows] == list(range(148))
    assert len({r['name'] for r in rows}) == len(rows)
    assert sum(len(r['warnings']) for r in rows) == 56
    for row in rows:
        ids = [r['id'] for r in row['input']]
        assert ids == list(range(len(ids)))
        assert len(row['selected']) == len(set(row['selected'])) and set(row['selected']) <= set(ids)
        assert row['disambiguated'] == [i for i in row['selected'] if i in row['disambiguated']]
        assert all(len(pair) == 2 and set(pair) <= set(ids) for pair in row['warnings'])
        for item in row['input']:
            assert all(len(item[key]) == 2 and all(type(n) is int for n in item[key]) for key in ['span','fullSpan'])
            for value in [item['matched'],item['parenthetical']]:
                if value is None:
                    continue
                width = value['width']
                data = bytes.fromhex(value['bytes'])
                assert width in [1,2,4] and len(data) % width == 0
                points = [int.from_bytes(data[i:i+width],'little') for i in range(0,len(data),width)]
                maximum = max(points,default=0)
                assert maximum <= 0x10ffff and width == (1 if maximum <= 255 else 2 if maximum <= 65535 else 4)
    assert rows[0]['sameList'] is True and all(not r['sameList'] for r in rows[1:])
    assert len(corpus['parallel']) == 16
    for row in corpus['parallel']:
        expected = dict(row['before'])
        if row['previous']['fullSpanStart'] == row['before']['fullSpanStart']:
            for key in ['plaintiff','defendant','yearText','year']:
                expected[key] = row['previous'][key]
        assert row['after'] == expected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--oracle-root',type=Path)
    args=parser.parse_args()
    ops=Path(__file__).resolve().parent
    fixture=ops.parents[2]/'packages/law-practice/use-cases/test/fixtures/eyecite/extraction-selection.json'
    data=fixture.read_bytes()
    sha=lambda raw:hashlib.sha256(raw).hexdigest()
    assert sha(data)==CORPUS_SHA
    producer=ops/'probe-extraction-selection.py'
    assert sha(producer.read_bytes())==PRODUCER_SHA
    corpus=json.loads(data)
    validate(corpus)
    controls=0
    if args.self_test:
        changes=[]
        for key in ['oracleCommit','producerSha256','licenseSha256']:
            changed=copy.deepcopy(corpus);changed[key]='0'*len(changed[key]);changes.append(changed)
        changed=copy.deepcopy(corpus);changed['cases'].pop();changes.append(changed)
        changed=copy.deepcopy(corpus);changed['cases'][1]['input'][1]['id']=0;changes.append(changed)
        changed=copy.deepcopy(corpus);changed['cases'][1]['selected']=[999];changes.append(changed)
        changed=copy.deepcopy(corpus);changed['cases'][1]['disambiguated']=[999];changes.append(changed)
        changed=copy.deepcopy(corpus);changed['cases'][1]['warnings']=[[999,0]];changes.append(changed)
        changed=copy.deepcopy(corpus);changed['parallel'][0]['after']['year']=1;changes.append(changed)
        for changed in changes:
            try:validate(changed)
            except AssertionError:controls+=1;continue
            raise AssertionError('structurally corrupted selection evidence accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-selection-') as scratch:
            output=Path(scratch)/'selection.json'
            subprocess.run([str(args.oracle_root/'.venv/bin/python'),str(producer),'--oracle-root',str(args.oracle_root),'--output',str(output)],check=True,capture_output=True)
            assert output.read_bytes()==data
    print(json.dumps({'sourceEvidenceOnly':True,'cases':148,'parallel':16,'controls':controls,'oracleReplayed':args.oracle_root is not None}))


if __name__ == '__main__':
    main()
