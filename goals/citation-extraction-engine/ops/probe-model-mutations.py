#!/usr/bin/env python3
"""Capture semantic mutation and mutable default-resource key observations.

Maintainer-only pinned source evidence; hash-mutation scenes are not a waiver.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
SCENES = [
    ("full-rename-current", ["case", "supra"], "semantic"),
    ("rename-prior-in-supra", ["case", "supra"], "semantic"),
    ("page-prior-in-id", ["case", "id"], "semantic"),
    ("volume-prior-in-short", ["case", "short"], "semantic"),
    ("current-id-pin", ["case", "id"], "semantic"),
    ("current-supra-antecedent", ["case", "supra"], "semantic"),
    ("retained-metadata-from-full", ["case", "supra", "case", "supra"], "semantic"),
    ("detached-alias-metadata", ["case", "supra", "supra"], "semantic"),
    ("default-page-before-insertion", ["case", "id"], "mutable-key"),
    ("default-page-after-insertion", ["case", "supra", "id"], "mutable-key"),
    ("default-page-after-insertion-two", ["case", "supra", "id"], "mutable-key"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
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

    rows = []
    for action, kinds, family in SCENES:
        def citation(kind, index, detached=False):
            groups={"volume":"1", "reporter":"U.S.", "page":"1"}
            metadata={"plaintiff":"Detached" if detached else "Smith"} if kind=="case" else {}
            if kind=="supra": metadata["antecedent_guess"]="Smith"
            if kind=="short": metadata["antecedent_guess"]="Smith"
            if kind=="id": metadata["pin_cite"]="2"
            token=models.CitationToken(f"witness-{index}",index*11,index*11+9,groups)
            cls={"case":models.FullCaseCitation,"supra":models.SupraCitation,"short":models.ShortCaseCitation,"id":models.IdCitation}[kind]
            return cls(token,index=index,groups=groups,metadata=metadata)
        values=[citation(kind,index) for index,kind in enumerate(kinds)]
        if action in ("full-rename-current","rename-prior-in-supra"):
            values[1].metadata.antecedent_guess="Changed"
        if action=="retained-metadata-from-full": values[3].metadata.antecedent_guess="Changed"
        if action=="detached-alias-metadata":
            values[1].metadata.antecedent_guess="Detached"
            values[2].metadata.antecedent_guess="Changed"
        if action=="volume-prior-in-short":values[1].groups["volume"]="2"
        originals={id(value):index for index,value in enumerate(values)}
        detached=citation("case",99,True)
        resources=[]
        def ref(value):return {"kind":"input","index":originals[id(value)]} if id(value) in originals else {"kind":"detached","slot":0}
        def view(value):
            metadata=value.metadata
            return {"reference":ref(value),"groups":dict(value.groups),
                    "metadata":{field:getattr(metadata,field,None) for field in ("plaintiff","antecedent_guess","pin_cite")}}
        def resource(value):
            if isinstance(value,models.Resource):
                for index,existing in enumerate(resources):
                    if existing is value:return {"kind":"default","slot":index,"citation":view(value.citation)}
                resources.append(value)
                return {"kind":"default","slot":len(resources)-1,"citation":view(value.citation)}
            return {"kind":type(value).__name__,"value":value}
        initial_objects=[view(value) for value in values]
        events=[]
        retained=None
        def full(value):
            nonlocal retained
            before=[view(item) for item in values]
            result=resolve.resolve_full_citation(value) if family=="mutable-key" else "base"
            if action=="full-rename-current":value.metadata.plaintiff="Changed"
            if action=="retained-metadata-from-full" and retained is not None:retained.metadata.plaintiff="Changed"
            if action=="default-page-before-insertion":value.groups["page"]="2"
            events.append({"slot":"full","mention":originals[id(value)],"before":before,"after":[view(item) for item in values],"result":resource(result)})
            return result
        def contextual(value, fulls):
            nonlocal retained
            before=[view(item) for item,_ in fulls]
            if retained is None:retained=fulls[0][0]
            if action=="rename-prior-in-supra":fulls[0][0].metadata.plaintiff="Changed"
            if action=="volume-prior-in-short":fulls[0][0].groups["volume"]="2"
            if action=="current-supra-antecedent":value.metadata.antecedent_guess="Missing"
            if action in ("default-page-after-insertion","default-page-after-insertion-two"):fulls[0][0].groups["page"]="2" if action.endswith("-two") else "20"
            if action=="detached-alias-metadata":
                if len(fulls)==1:fulls.append((detached,"foreign"))
                else:fulls[1][0].metadata.plaintiff="Changed"
            helper=resolve._resolve_shortcase_citation if type(value) is models.ShortCaseCitation else resolve._resolve_supra_citation
            result=helper(value,fulls)
            events.append({"slot":kinds[originals[id(value)]],"mention":originals[id(value)],"before":before,"after":[view(item) for item,_ in fulls],"current":view(value),"result":resource(result)})
            return result
        def id_callback(value,last,groups):
            before=[view(item) for members in groups.values() for item in members]
            if action=="page-prior-in-id":next(iter(groups.values()))[0].groups["page"]="20"
            if action=="current-id-pin":value.metadata.pin_cite="200"
            result=resolve._resolve_id_citation(value,last,groups)
            events.append({"slot":"id","mention":originals[id(value)],"before":before,"after":[view(item) for members in groups.values() for item in members],"current":view(value),"result":resource(result)})
            return result
        try:
            groups=resolve.resolve_citations(values,resolve_full_citation=full,resolve_shortcase_citation=contextual,resolve_supra_citation=contextual,resolve_id_citation=id_callback)
            outcome={"status":"value","groups":[{"resource":resource(key),"members":[ref(item) for item in members]} for key,members in groups.items()]}
        except Exception as error:
            outcome={"status":"error","kind":type(error).__name__}
        rows.append({"name":action,"family":family,"kinds":kinds,"initialObjects":initial_objects,"events":events,"objects":[view(value) for value in values],"detachedObjects":[view(detached)] if action=="detached-alias-metadata" else [],"outcome":outcome})
    payload={"schemaVersion":"citation-model-mutation-observations/v1","oracleCommit":PIN,"oracleTree":TREE,
             "pythonVersion":"3.11.15","pythonHashSeed":"0","versions":versions,"license":"BSD-2-Clause",
             "licenseSha256":hashlib.sha256((root/"LICENSE").read_bytes()).hexdigest(),
             "exporterSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
             "sources":{name:hashlib.sha256((root/"eyecite"/name).read_bytes()).hexdigest() for name in ("resolve.py","models.py")},"cases":rows}
    args.output.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+"\n")
    print(f"Captured {len(rows)} model mutation observations")


if __name__ == "__main__":
    main()
