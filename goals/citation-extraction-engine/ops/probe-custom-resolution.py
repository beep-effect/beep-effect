#!/usr/bin/env python3
"""Capture pinned callback dispatch, resource equality and state observations.

Maintainer-only Python: no target runtime imports or parity claim. The callbacks
are deliberate synthetic witnesses, not additions to the canonical test ledger.
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(
        ["git", "-C", str(root), *parts], text=True
    ).strip()
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

    classes = {
        "case": models.FullCaseCitation, "law": models.FullLawCitation,
        "journal": models.FullJournalCitation, "short": models.ShortCaseCitation,
        "supra": models.SupraCitation, "reference": models.ReferenceCitation,
        "id": models.IdCitation, "unknown": models.UnknownCitation,
    }

    def citations(kinds, pages=None):
        result = []
        for index, kind in enumerate(kinds):
            groups = {"volume": "1", "reporter": "U.S.", "page": str((pages or {}).get(index, 1))}
            metadata = {"plaintiff": "Smith"} if kind == "case" else {}
            if kind in ("short", "supra"):
                metadata["antecedent_guess"] = "Smith"
            if kind == "id":
                metadata["pin_cite"] = "2"
            token = models.CitationToken(f"witness-{index}", index * 11, index * 11 + 9, groups)
            result.append(classes[kind](token, index=index, groups=groups, metadata=metadata))
        return result

    def resource(value):
        if isinstance(value, models.Resource):
            return {"kind": "default", "representative": value.citation.index}
        return {"kind": type(value).__name__, "value": value}

    rows = []

    def run(name, kinds, overrides, pages=None):
        values = citations(kinds, pages)
        events = []
        active = {}
        for slot, behavior in overrides.items():
            default = getattr(resolve, "resolve_full_citation" if slot == "full" else f"_resolve_{slot}_citation")

            def callback(citation, *state, slot=slot, behavior=behavior, default=default):
                event = {"slot": slot, "mention": citation.index}
                if slot == "id":
                    event["last"] = resource(state[0])
                    event["groups"] = [{"resource": resource(key), "members": [item.index for item in members]} for key, members in state[1].items()]
                elif slot != "full":
                    event["fulls"] = [{"mention": item.index, "resource": resource(key)} for item, key in state[0]]
                events.append(event)
                if behavior == "default":
                    return default(citation, *state)
                if behavior == "clear-fulls":
                    state[0].clear()
                    return None
                if behavior == "raise":
                    raise ValueError("synthetic callback failure")
                return behavior[citation.index] if isinstance(behavior, dict) else behavior

            key = "resolve_full_citation" if slot == "full" else f"resolve_{slot}_citation"
            active[key] = callback
        try:
            groups = resolve.resolve_citations(values, **active)
            outcome = {"status": "value", "groups": [{"resource": resource(key), "members": [item.index for item in members]} for key, members in groups.items()]}
        except Exception as error:
            outcome = {"status": "error", "kind": type(error).__name__}
        rows.append({"name": name, "kinds": kinds, "pages": pages or {}, "bindings": overrides, "events": events, "outcome": outcome})

    run("all-five-dispatch", ["case", "short", "supra", "reference", "id", "unknown", "law", "journal"],
        {"full": "external", "shortcase": "external", "supra": "external", "reference": "external", "id": "external"})
    run("full-merge-first-page-controls-id", ["case", "case", "id"], {"full": "shared", "id": "default"}, {0: 100, 1: 1})
    run("full-merge-reversed-pages", ["case", "case", "id"], {"full": "shared", "id": "default"}, {0: 1, 1: 100})
    for label, key in [("none", None), ("false", False), ("zero", 0), ("empty-string", ""), ("empty-tuple", ())]:
        run(f"falsy-full-{label}", ["case", "supra", "id"], {"full": key, "supra": "default", "id": "default"})
    run("equal-keys-keep-first-key-object", ["case", "case", "id"], {"full": {0: 1, 1: True}, "id": "default"})
    run("short-resource-without-full", ["short", "id"], {"shortcase": "external", "id": "default"})
    run("supra-resource-without-full", ["supra", "id"], {"supra": "external", "id": "default"})
    run("reference-resource-without-full", ["reference", "id"], {"reference": "external", "id": "default"})
    run("id-resource-without-full", ["id", "id"], {"id": "external"})
    run("false-short-resets-last", ["case", "short", "id"], {"full": "external", "shortcase": "", "id": "default"})
    run("custom-key-default-short-supra", ["case", "short", "supra", "id"], {"full": "external", "shortcase": "default", "supra": "default", "id": "default"})
    run("mutable-prior-full-state", ["case", "supra", "short", "id"], {"full": "external", "supra": "clear-fulls", "shortcase": "default", "id": "default"})
    run("unhashable-truthy-resource", ["case", "id"], {"full": ["unhashable"], "id": "default"})
    run("callback-exception-stops-dispatch", ["case", "short", "id"], {"full": "external", "shortcase": "raise", "id": "default"})
    payload = {
        "schemaVersion": "citation-custom-resolution-observations/v1",
        "oracleCommit": PIN, "oracleTree": TREE, "pythonVersion": "3.11.15",
        "pythonHashSeed": "0", "versions": versions,
        "license": "BSD-2-Clause",
        "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(),
        "exporterSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("resolve.py", "models.py")},
        "cases": rows,
    }
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"Captured {len(rows)} custom-resolution observations")


if __name__ == "__main__":
    main()
