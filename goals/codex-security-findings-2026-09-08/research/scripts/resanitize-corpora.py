"""Repair captured corpus bytes for CSF-012 without recapturing live sources.

Run with ``uv run --offline --with pyyaml python <this-script>``.
Each generator verifies the staged result before promotion. Original capture
metadata and source counts remain intact; the prior manifest digest records
the security-only transformation. An already repaired pin is verified unchanged.
"""
from __future__ import annotations

import collections
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[4]
CORPUS = ROOT / "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus"


def repair(name: str) -> None:
    spec = importlib.util.spec_from_file_location(name, CORPUS / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    root = module.OUTPUT_ROOT
    if root.is_symlink() or not root.is_dir() or any(p.is_symlink() for p in root.rglob("*")):
        raise SystemExit("refusing a missing or symlinked corpus")
    original = (root / module.MANIFEST_NAME).read_bytes()
    manifest = yaml.safe_load(original)
    generator_digest = module.sha256(module.SCRIPT.read_bytes())
    if manifest["generator_sha256"] == generator_digest:
        module.verify_output_tree(root)
        print(f"{root.name}: verified unchanged")
        return
    prior_generator = subprocess.run(
        ["git", "show", "HEAD:" + module.SCRIPT.relative_to(ROOT).as_posix()],
        cwd=ROOT, capture_output=True, check=True,
    ).stdout
    if manifest["generator_sha256"] != module.sha256(prior_generator):
        raise SystemExit("refusing a pin whose generator differs from committed provenance")
    receipts = manifest["files"]
    paths = [module.safe_relative_path(r["path"]).as_posix() for r in receipts]
    actual = sorted(p.relative_to(root).as_posix() for p in root.rglob("*")
                    if p.is_file() and p.name != module.MANIFEST_NAME)
    if paths != sorted(set(paths)) or paths != actual:
        raise SystemExit("refusing an inconsistent source inventory")
    payloads = {}
    for receipt in receipts:
        data = (root / receipt["path"]).read_bytes()
        if module.sha256(data) != receipt["sha256"] or len(data) != receipt["bytes"]:
            raise SystemExit("refusing a source payload with mismatched integrity")
        payloads[receipt["path"]] = data
    changed = 0
    for receipt in receipts:
        path = receipt["path"]
        if receipt["kind"] == module.PROJECTION_KIND:
            continue
        data = payloads[path]
        rows = module.decode_ndjson(data, path) if path.endswith(".ndjson") else [module.decode_json(data, path)]
        if name == "etl_fleet_corpus":
            sanitized = [module.redact_string_values(row) for row in rows]
        else:
            sanitized = [module.redact(row, None, collections.Counter(), True) for row in rows]
        if module.same_json(rows, sanitized):
            continue
        payloads[path] = module.encode_ndjson(sanitized) if path.endswith(".ndjson") else module.encode_json(sanitized[0])
        projection = next(r["path"] for r in receipts if r.get("derived_from") == path)
        payloads[projection] = module.encode_properties_projection(sanitized)
        changed += 1
    for receipt in receipts:
        data = payloads[receipt["path"]]
        receipt.update(bytes=len(data), sha256=module.sha256(data))
    manifest["generator_sha256"] = generator_digest
    if name == "etl_fleet_corpus":
        rules = manifest["redaction_rules"]
        pid_rules = [i for i, rule in enumerate(rules) if "pid <redacted>" in rule]
        if len(pid_rules) != 1:
            raise SystemExit("refusing ambiguous PID redaction provenance")
        rules[pid_rules[0]] = module.PID_REDACTION_RULE
    manifest["security_resanitization"] = {
        "finding": "CSF-012", "source_manifest_sha256": module.sha256(original),
        "changed_raw_payloads": changed, "live_recapture": False,
    }
    manifest["totals"]["payload_bytes"] = sum(map(len, payloads.values()))
    prefix = original.split(b"schema_version:", 1)[0]
    for _ in range(12):
        encoded = prefix + yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True, width=100).encode()
        total = manifest["totals"]["payload_bytes"] + len(encoded)
        if manifest["totals"]["bytes_emitted"] == total:
            break
        manifest["totals"]["bytes_emitted"] = total
    else:
        raise SystemExit("manifest byte total did not converge")
    stage = Path(tempfile.mkdtemp(prefix=f".{root.name}-security-", dir=CORPUS))
    backup = root.with_name("." + root.name + "-security-previous")
    if backup.exists() or backup.is_symlink():
        shutil.rmtree(stage)
        raise SystemExit("a prior security backup requires recovery")
    try:
        for path, data in payloads.items():
            destination = stage / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        (stage / module.MANIFEST_NAME).write_bytes(encoded)
        module.verify_output_tree(stage)
        os.replace(root, backup)
        try:
            os.replace(stage, root)
        except BaseException:
            os.replace(backup, root)
            raise
        shutil.rmtree(backup)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    print(f"{root.name}: sanitized {changed} raw payloads; staged integrity verification passed")


if __name__ == "__main__":
    for generator in ("etl_fleet_corpus", "etl_run3_fleet_corpus", "etl_run3_checkout_identity"):
        repair(generator)
