#!/usr/bin/env python3
"""Validate semantic mutation and unresolved mutable-key source evidence."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES=["full-rename-current","rename-prior-in-supra","page-prior-in-id","volume-prior-in-short",
       "current-id-pin","current-supra-antecedent","retained-metadata-from-full","detached-alias-metadata",
       "default-page-before-insertion","default-page-after-insertion","default-page-after-insertion-two"]
MEMBERS=[[[0,1]],[[0,1]],[[0]],[[0,1]],[[0]],[[0]],[[0,1,2,3]],[[0],[1,2]],[[0,1]],[[0],[1,2]],[[0,1,2]]]


def check(data):
    assert data["schemaVersion"]=="citation-model-mutation-observations/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["pythonVersion"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["exporterSha256"] == hashlib.sha256(Path(__file__).with_name("probe-model-mutations.py").read_bytes()).hexdigest()
    assert [row["name"] for row in data["cases"]]==NAMES
    assert [row["family"] for row in data["cases"]]==["semantic"]*8+["mutable-key"]*3
    assert sum(len(row["events"]) for row in data["cases"])==27
    for index,row in enumerate(data["cases"]):
        assert len(row["events"])==len(row["kinds"])
        for key in ("initialObjects","objects"):
            assert len(row[key])==len(row["kinds"])
            assert [value["reference"] for value in row[key]]==[{"kind":"input","index":i} for i in range(len(row["kinds"]))]
        assert row["outcome"]["status"]=="value"
        assert [[item["index"] for item in group["members"]] for group in row["outcome"]["groups"]]==MEMBERS[index]
        for mention,event in enumerate(row["events"]):
            assert event["mention"]==mention
            assert event["slot"]==("full" if row["kinds"][mention]=="case" else row["kinds"][mention])
        assert len(row["detachedObjects"])==(1 if index==7 else 0)
    assert data["cases"][0]["objects"][0]["metadata"]["plaintiff"]=="Changed"
    assert data["cases"][1]["objects"][0]["metadata"]["plaintiff"]=="Changed"
    assert data["cases"][2]["objects"][0]["groups"]["page"]=="20"
    assert data["cases"][3]["objects"][0]["groups"]["volume"]=="2"
    assert data["cases"][4]["objects"][1]["metadata"]["pin_cite"]=="200"
    assert data["cases"][5]["objects"][1]["metadata"]["antecedent_guess"]=="Missing"
    assert data["cases"][6]["objects"][0]["metadata"]["plaintiff"]=="Changed"
    assert data["cases"][7]["detachedObjects"][0]["metadata"]["plaintiff"]=="Changed"
    before=data["cases"][8]["outcome"]["groups"]
    after=data["cases"][9]["outcome"]["groups"]
    assert before[0]["resource"]["kind"]=="default" and before[0]["resource"]["citation"]["groups"]["page"]=="2"
    assert len(after)==2 and after[0]["resource"]==after[1]["resource"]
    assert after[0]["resource"]["slot"]==0 and after[0]["resource"]["citation"]["groups"]["page"]=="20"
    other=data["cases"][10]["outcome"]["groups"]
    assert len(other)==1 and other[0]["resource"]["slot"]==0 and other[0]["resource"]["citation"]["groups"]["page"]=="2"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root",type=Path)
    args=parser.parse_args()
    repo=Path(__file__).resolve().parents[3]
    fixture=repo/"packages/law-practice/use-cases/test/fixtures/eyecite/model-mutation-observations.json"
    data=json.loads(fixture.read_bytes())
    check(data)
    mutations=[lambda x:x["cases"].pop(),lambda x:x["cases"].append(copy.deepcopy(x["cases"][0])),
               lambda x:x.update(license="unknown"),lambda x:x["cases"][0]["events"].pop(),
               lambda x:x["cases"][9]["outcome"]["groups"].pop(),
               lambda x:x["cases"][9]["outcome"]["groups"][1]["resource"].update(slot=1),
               lambda x:x["cases"][0]["objects"][0]["metadata"].update(plaintiff="Smith"),
               lambda x:x["cases"][0]["initialObjects"][0]["reference"].update(index=999)]
    for mutate in mutations:
        broken=copy.deepcopy(data);mutate(broken)
        try:check(broken)
        except AssertionError:continue
        raise AssertionError("corruption accepted")
    if args.oracle_root:
        for name,digest in data["sources"].items():
            assert hashlib.sha256((args.oracle_root/"eyecite"/name).read_bytes()).hexdigest()==digest
        with tempfile.TemporaryDirectory(prefix="citation-model-mutation-") as directory:
            output=Path(directory)/"observations.json"
            subprocess.run([sys.executable,str(Path(__file__).with_name("probe-model-mutations.py")),"--oracle-root",str(args.oracle_root),"--output",str(output)],env={**os.environ,"PYTHONHASHSEED":"0"},check=True)
            assert json.loads(output.read_bytes())==data
    print("PASS 11 model mutation source scenes and 8 corruption controls; target callback execution is checked separately")


if __name__=="__main__":main()
