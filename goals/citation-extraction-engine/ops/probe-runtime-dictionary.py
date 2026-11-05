#!/usr/bin/env python3
"""Observe frozen CPython general-key dictionary behavior for citation runtime keys.

Maintainer-only table evidence, not complete host-key or engine parity.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys

PIN="04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE="a35a58fac03400f71a93a93485b77f1d56f2b02f"
DICT_SHA="474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8"
LICENSE_SHA="3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root",type=Path,required=True)
    parser.add_argument("--cpython-root",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    if (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}")) != (PIN, TREE) or git("status", "--porcelain"):
        raise SystemExit("oracle provenance mismatch")
    if sys.version_info[:3] != (3, 11, 15) or os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization:
        raise SystemExit("frozen runtime mismatch")
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    if versions != {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}:
        raise SystemExit("frozen dependency mismatch")
    sys.path.insert(0, str(root))
    import eyecite.models as models
    import eyecite.resolve as resolve

    assert hashlib.sha256((args.cpython_root/"dictobject.c").read_bytes()).hexdigest()==DICT_SHA
    assert hashlib.sha256((args.cpython_root/"LICENSE").read_bytes()).hexdigest()==LICENSE_SHA
    assert sys.hash_info.width==64 and sys.implementation.name=="cpython"
    citation=models.FullCaseCitation(models.CitationToken("x",0,1,{"volume":"1","reporter":"U.S.","page":"1"}),index=0,groups={"volume":"1","reporter":"U.S.","page":"1"})
    resource=models.Resource(citation)
    hashes={}
    for page in ("1","2","20"):
        citation.groups["page"]=page
        hashes[page]=hash(resource)
    assert hashes=={"1":1986750081022884797,"2":1465210507262904853,"20":1226098292844416122}
    def key(h,t="same",mode="token"):
        return {"hash":str(h),"token":t,"mode":mode,"error":False}
    def op(kind,index=None,value=None):
        data={"kind":kind}
        if index is not None:data["key"]=index
        if value is not None:data["value"]=value
        return data
    scenes=[
        ("same-bucket-pointer",[key(hashes["1"],mode="hash")],[op("set",0,0),op("hash",0,str(hashes["2"])),op("get",0),op("set",0,1)]),
        ("changed-bucket-duplicate",[key(hashes["1"],mode="hash")],[op("set",0,0),op("hash",0,str(hashes["20"])),op("get",0),op("set",0,1),op("get",0)]),
        ("cached-hash-current-equality",[key(7,mode="hash"),key(7,mode="hash")],[op("set",0,0),op("hash",0,"15"),op("get",1),op("set",1,1),op("get",0)]),
        ("collision-perturb-growth",[key(17,str(i)) for i in range(9)],
         [op("set",i,i) for i in range(6)]+[op("remove",2),op("set",6,6),op("get",4),op("get",2),op("set",7,7),op("set",8,8)]),
        ("resize-retains-cached-hash",[key(5,"zero")]+[key(i,str(i)) for i in (1,2,3,4,6)],
         [op("set",0,0),op("hash",0,"10")]+[op("set",i,i) for i in range(1,6)]+[op("get",0),op("set",0,9)]),
        ("delete-dummy-order-clear",[key(1,str(i)) for i in range(3)],
         [op("set",0,0),op("set",1,1),op("remove",0),op("get",1),op("set",2,2),op("set",0,3),op("clear"),op("set",1,4)]),
        ("comparison-error-atomic",[key(1,"left"),key(1,"right")],
         [op("set",0,0),op("error",0,True),op("get",1),op("set",1,1),op("error",0,False),op("get",1),op("set",1,1)]),
        ("signed-wide-hashes",[key(h,str(i)) for i,h in enumerate((-1,-2,-9223372036854775808,9223372036854775807,0))],
         [op("set",i,i) for i in range(5)]+[op("get",i) for i in range(5)]+[op("remove",2),op("get",2)]),
    ]
    rows=[]
    for name,configs,operations in scenes:
        class Key:
            def __init__(self,index,data):self.index=index;self.raw=int(data["hash"]);self.token=data["token"];self.mode=data["mode"];self.error=data["error"]
            def __hash__(self):return self.raw
            def __eq__(self,other):
                comparisons.append([self.index,other.index])
                if self.error:raise ValueError("synthetic comparison failure")
                return hash(self)==hash(other) if self.mode=="hash" else self.token==other.token
        keys=[Key(index,data) for index,data in enumerate(configs)]
        table={}
        events=[]
        def key_views():return [{"objectId":key.index,"hash":str(hash(key)),"token":key.token,"mode":key.mode,"error":key.error} for key in keys]
        for operation in operations:
            comparisons=[]
            kind=operation["kind"]
            if kind=="hash":keys[operation["key"]].raw=int(operation["value"])
            if kind=="error":keys[operation["key"]].error=operation["value"]
            event={"operation":operation,"keys":key_views()}
            try:
                if kind=="set":table[keys[operation["key"]]]=operation["value"];result=None
                elif kind=="get":result=table.get(keys[operation["key"]])
                elif kind=="remove":result=table.pop(keys[operation["key"]],None)
                elif kind=="clear":table.clear();result=None
                else:result=None
                event["outcome"]={"status":"value","result":result}
            except Exception as error:event["outcome"]={"status":"error","kind":type(error).__name__}
            event["comparisons"]=list(comparisons)
            event["entries"]=[{"objectId":key.index,"value":value} for key,value in table.items()]
            events.append(event)
        rows.append({"name":name,"events":events})
    payload={"schemaVersion":"citation-runtime-dictionary-observations/v1","oracleCommit":PIN,"oracleTree":TREE,"pythonVersion":"3.11.15","pythonHashSeed":"0","versions":versions,"license":"BSD-2-Clause","licenseSha256":hashlib.sha256((root/"LICENSE").read_bytes()).hexdigest(),"cpythonVersion":"3.11.15","hashWidth":64,"hashModulus":str(sys.hash_info.modulus),"dictionaryKind":"combined-general","dictionarySourceSha256":DICT_SHA,"cpythonLicenseSha256":LICENSE_SHA,"canonicalResourceHashes":{page:str(value) for page,value in hashes.items()},"exporterSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"sources":{name:hashlib.sha256((root/"eyecite"/name).read_bytes()).hexdigest() for name in ("models.py","utils.py")},"cases":rows}
    args.output.write_text(json.dumps(payload,indent=2)+"\n")
    print(f"Captured {len(rows)} dictionary scenes / {sum(len(row['events']) for row in rows)} events")


if __name__=="__main__":main()
