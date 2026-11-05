#!/usr/bin/env python3
"""Validate general-key dictionary source observations, attribution and replay."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

DICT_SHA="474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8"
LICENSE_SHA="3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf"
NAMES=["same-bucket-pointer","changed-bucket-duplicate","cached-hash-current-equality","collision-perturb-growth",
       "resize-retains-cached-hash","delete-dummy-order-clear","comparison-error-atomic","signed-wide-hashes"]
FINAL=[[(0,1)],[(0,0),(0,1)],[(0,0),(1,1)],[(0,0),(1,1),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8)],
       [(0,0),(1,1),(2,2),(3,3),(4,4),(5,5),(0,9)],[(1,4)],[(0,0),(1,1)],[(0,0),(1,1),(3,3),(4,4)]]


def check(data):
    assert data["schemaVersion"]=="citation-runtime-dictionary-observations/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["pythonVersion"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["exporterSha256"] == hashlib.sha256(Path(__file__).with_name("probe-runtime-dictionary.py").read_bytes()).hexdigest()
    assert data["cpythonVersion"]=="3.11.15" and data["hashWidth"]==64
    assert data["hashModulus"]=="2305843009213693951" and data["dictionaryKind"]=="combined-general"
    assert data["dictionarySourceSha256"]==DICT_SHA and data["cpythonLicenseSha256"]==LICENSE_SHA
    assert data["canonicalResourceHashes"]=={"1":"1986750081022884797","2":"1465210507262904853","20":"1226098292844416122"}
    assert [row["name"] for row in data["cases"]]==NAMES
    assert [len(row["events"]) for row in data["cases"]]==[4,5,5,12,9,8,7,12]
    assert [sum(len(e["comparisons"]) for e in row["events"]) for row in data["cases"]]==[0,0,2,45,0,4,4,26]
    for index,row in enumerate(data["cases"]):
        assert [(entry["objectId"],entry["value"]) for entry in row["events"][-1]["entries"]]==FINAL[index]
        for event in row["events"]:
            ids=[key["objectId"] for key in event["keys"]]
            assert ids==list(range(len(ids)))
            for key in event["keys"]:
                value=int(key["hash"])
                assert str(value)==key["hash"] and -(2**63)<=value<2**63 and value!=-1
                assert key["mode"] in ("hash","token") and type(key["error"]) is bool
            assert all(entry["objectId"] in ids and type(entry["value"]) is int for entry in event["entries"])
            assert all(left in ids and right in ids for left,right in event["comparisons"])
            assert event["outcome"]["status"] in ("value","error")
            if event["outcome"]["status"]=="error":assert event["outcome"]["kind"]=="ValueError"
    assert data["cases"][0]["events"][2]["outcome"]=={"status":"value","result":0}
    assert data["cases"][1]["events"][2]["outcome"]=={"status":"value","result":None}
    assert data["cases"][2]["events"][2]["comparisons"]==[[0,1]]
    errors=data["cases"][6]["events"]
    assert errors[2]["outcome"]["status"]==errors[3]["outcome"]["status"]=="error"
    assert errors[2]["entries"]==errors[3]["entries"]==[{"objectId":0,"value":0}]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root",type=Path)
    parser.add_argument("--cpython-root",type=Path)
    args=parser.parse_args()
    repo=Path(__file__).resolve().parents[3]
    fixture=repo/"packages/law-practice/use-cases/test/fixtures/eyecite/runtime-dictionary-observations.json"
    data=json.loads(fixture.read_bytes());check(data)
    notice=(repo/"THIRD_PARTY_NOTICES.md").read_bytes()
    license=notice.split(b"<!-- cpython-3.11.15-license:begin -->\n\n```text\n",1)[1].split(b"```\n\n<!-- cpython-3.11.15-license:end -->",1)[0]
    assert hashlib.sha256(license).hexdigest()==LICENSE_SHA
    mutations=[lambda x:x["cases"].pop(),lambda x:x["cases"].append(copy.deepcopy(x["cases"][0])),
               lambda x:x.update(license="unknown"),lambda x:x.update(dictionarySourceSha256="0"*64),
               lambda x:x["cases"][0]["events"][2]["outcome"].update(result=None),
               lambda x:x["cases"][1]["events"][-1]["entries"].pop(),
               lambda x:x["cases"][2]["events"][2].update(comparisons=[]),
               lambda x:x["cases"][7]["events"][0]["keys"][0].update(hash="-1")]
    for mutate in mutations:
        broken=copy.deepcopy(data);mutate(broken)
        try:check(broken)
        except AssertionError:continue
        raise AssertionError("corruption accepted")
    if args.oracle_root or args.cpython_root:
        assert args.oracle_root and args.cpython_root,"replay requires both source roots"
        assert hashlib.sha256((args.cpython_root/"dictobject.c").read_bytes()).hexdigest()==DICT_SHA
        assert hashlib.sha256((args.cpython_root/"LICENSE").read_bytes()).hexdigest()==LICENSE_SHA
        for name,digest in data["sources"].items():assert hashlib.sha256((args.oracle_root/"eyecite"/name).read_bytes()).hexdigest()==digest
        with tempfile.TemporaryDirectory(prefix="citation-runtime-dictionary-") as directory:
            output=Path(directory)/"observations.json"
            subprocess.run([sys.executable,str(Path(__file__).with_name("probe-runtime-dictionary.py")),"--oracle-root",str(args.oracle_root),"--cpython-root",str(args.cpython_root),"--output",str(output)],env={**os.environ,"PYTHONHASHSEED":"0"},check=True)
            assert json.loads(output.read_bytes())==data
    print("PASS 8 dictionary source scenes / 62 events, 8 corruption controls and exact CPython license; live-owner integration remains open")


if __name__=="__main__":main()
