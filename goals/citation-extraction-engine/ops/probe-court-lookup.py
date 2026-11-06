#!/usr/bin/env python3
"""Capture original court lookup, complete frozen order and normalization facts."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys

PIN='04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
TREE='a35a58fac03400f71a93a93485b77f1d56f2b02f'


def native(text):
    largest=max(map(ord,text),default=0)
    width=1 if largest<=255 else 2 if largest<=65535 else 4
    return [width,b''.join(ord(c).to_bytes(width,'little') for c in text).hex()]


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle-root',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--table-output',required=True,type=Path)
    p.add_argument('--words-output',required=True,type=Path)
    args=p.parse_args();root=args.oracle_root.resolve()
    git=lambda *xs:subprocess.check_output(['git','-C',str(root),*xs],text=True).strip()
    assert (git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}'),git('status','--porcelain'))==(PIN,TREE,'')
    assert sys.version_info[:3]==(3,11,15)
    sys.path.insert(0,str(root))
    import regex,courts_db
    from eyecite import helpers
    assert importlib.metadata.version('courts-db')=='0.10.22'
    assert importlib.metadata.version('regex')=='2023.12.25' and regex.DEFAULT_VERSION==regex.V0
    sha=lambda b:hashlib.sha256(b).hexdigest()
    strip=regex.compile(r'[^\w]')
    normalize=lambda text:strip.sub('',text).lower()
    entries=[[str(c['id']),normalize(c['citation_string'])] for c in courts_db.courts]
    assert len(entries)==2798 and len({c[0] for c in entries})==2798
    assert all(key.isascii() for _,key in entries)
    payload=json.dumps(entries,ensure_ascii=False,separators=(',',':'))
    assert sha(payload.encode())=='22a917e998d65b6e4edf7990ef79dd2f2affa74702c9be1068b7f30f33ce2831'
    header={'oracleCommit':PIN,'oracleTree':TREE,'python':'3.11.15','regex':'2023.12.25','courtsDb':'0.10.22','producerSha256':sha(Path(__file__).read_bytes())}
    args.table_output.write_text(json.dumps({'schemaVersion':'citation-court-table/v1',**header,'payload':payload,'payloadSha256':sha(payload.encode())},sort_keys=True,indent=2)+'\n')
    queries=[c['citation_string'] for c in courts_db.courts]
    prefix_queries=sorted({key[:n] for _,key in entries for n in range(1,len(key)+1)})
    queries+=prefix_queries
    controls=['',' ','...','SC','S.C.','Pa.Super.','2d Cir.','4TH CIR','scotus','not-a-court','\ud835\udfce','\U0001d7ce','\ud800','İ','I.','K','K.','ΟΣ.Α','ΟΣ.','ΟΣ\u0301.Α','S\u200dC','\u0345SC','S𑽐C','𐐀','é',' 2d\tCir.\n','N.D. Cal.','U.S.','C.A.','F.','_' , '😀SC','S\ud800C']
    control_start=len(queries);queries+=controls
    words=[];word_indices={};keys=[];key_indices={};rows=[]
    def intern(value,values,indices,encode):
        if value not in indices:indices[value]=len(values);values.append(encode(value))
        return indices[value]
    for index,text in enumerate(queries):
        key=normalize(text)
        assert all(not 0xd800<=ord(c)<=0xdfff for c in key)
        # The original helper executes directly, with its real ordered courts
        # list and regex functions; no expected-output/memoization stub.
        result=helpers.get_court_by_paren(text)
        rows.append([intern(text,words,word_indices,native),intern(key,keys,key_indices,lambda x:x),result])
        if index and index%2000==0:print(json.dumps({'captured':index}),flush=True)
    word_points=0;normal_points=0;digest=hashlib.sha256()
    for point in range(0x110000):
        text=chr(point)
        if regex.fullmatch(r'\w',text):
            word_points+=1
            lowered=text.lower()
            assert all(not 0xd800<=ord(c)<=0xdfff for c in lowered)
            normal_points+=len(lowered)
            digest.update(point.to_bytes(4,'little'))
            digest.update(len(lowered).to_bytes(1,'little'))
            for char in lowered:digest.update(ord(char).to_bytes(4,'little'))
    word_payload=json.dumps(words,ensure_ascii=True,separators=(',',':'))
    args.words_output.write_text(json.dumps({'schemaVersion':'citation-court-words/v1',**header,'payload':word_payload,'payloadSha256':sha(word_payload.encode())},sort_keys=True,indent=2)+'\n')
    out={'schemaVersion':'citation-court-lookup/v1',**header,'tablePayloadSha256':sha(payload.encode()),'originalCourtRows':2798,'prefixRows':len(prefix_queries),'controlStart':control_start,'wordsPayloadSha256':sha(word_payload.encode()),'keys':json.dumps(keys,ensure_ascii=True,separators=(',',':')),'cases':json.dumps(rows,ensure_ascii=True,separators=(',',':')),'scalarLaw':{'scanned':0x110000,'wordPoints':word_points,'loweredPoints':normal_points,'digest':digest.hexdigest()}}
    args.output.write_text(json.dumps(out,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'cases':len(rows),'words':len(words),'keys':len(keys),'prefixRows':len(prefix_queries),'controlStart':control_start,'scalarLaw':out['scalarLaw']}))


if __name__=='__main__':main()
