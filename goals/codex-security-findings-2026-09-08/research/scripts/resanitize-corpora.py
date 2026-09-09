"""Repair captured corpus redaction without recapturing live sources.

Run with ``uv run --offline --with pyyaml python <this-script> --finding CSF-013``.
Each generator verifies the staged result before promotion. Original capture
metadata and source counts remain intact; the prior manifest digest records
the security-only transformation. An already repaired pin is verified unchanged.
Use ``--source-ref <commit>`` to replay an older committed pin into the current
output tree. This reads only Git objects, never the original live capture sources.
"""
from __future__ import annotations

import collections
import argparse
import importlib.util
import io
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[4]
CORPUS = ROOT / "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus"


def verify_generator_provenance(module, expected: str) -> None:
    """Find the exact source generator bytes in reachable commit history."""
    path = module.SCRIPT.relative_to(ROOT).as_posix()
    revisions = subprocess.run(
        ["git", "rev-list", "HEAD", "--", path], cwd=ROOT,
        capture_output=True, text=True, check=True,
    ).stdout.splitlines()
    for revision in revisions:
        result = subprocess.run(["git", "show", revision + ":" + path], cwd=ROOT,
                                capture_output=True, check=True)
        if module.sha256(result.stdout) == expected:
            return
    raise SystemExit("refusing a pin whose generator has no matching committed provenance")


def read_committed_pin(root: Path, source_ref: str) -> dict[str, bytes]:
    revision = subprocess.run(["git", "rev-parse", "--verify", "--end-of-options", source_ref + "^{commit}"],
                              cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    prefix = root.relative_to(ROOT).as_posix() + "/"
    archive = subprocess.run(["git", "archive", revision, "--", prefix], cwd=ROOT,
                             capture_output=True, check=True).stdout
    result = {}
    with tarfile.open(fileobj=io.BytesIO(archive)) as tree:
        for entry in tree:
            if entry.isdir():
                continue
            if not entry.isfile() or not entry.name.startswith(prefix):
                raise SystemExit("refusing a non-file committed corpus entry")
            result[entry.name[len(prefix):]] = tree.extractfile(entry).read()
    return result


def load_generator(name: str):
    spec = importlib.util.spec_from_file_location(name, CORPUS / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def repair(name: str, source_ref: str | None = None, population: str | None = None,
           *, finding: str) -> None:
    module = load_generator(name)
    root = module.OUTPUT_ROOT if population is None else module.OUTPUT_ROOTS[population]

    def verify(root: Path) -> None:
        if population is None:
            module.verify_output_tree(root)
        else:
            module.verify_output_tree(root, population)

    if root.is_symlink() or not root.is_dir() or any(p.is_symlink() for p in root.rglob("*")):
        raise SystemExit("refusing a missing or symlinked corpus")
    previous_output = (root / module.MANIFEST_NAME).read_bytes()
    source = (read_committed_pin(root, source_ref) if source_ref else
              {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()})
    original = source.pop(module.MANIFEST_NAME)
    manifest = yaml.safe_load(original)
    generator_digest = module.sha256(module.SCRIPT.read_bytes())
    if not source_ref and manifest["generator_sha256"] == generator_digest:
        verify(root)
        print(f"{root.name}: verified unchanged")
        return
    verify_generator_provenance(module, manifest["generator_sha256"])
    receipts = manifest["files"]
    paths = [module.safe_relative_path(r["path"]).as_posix() for r in receipts]
    actual = sorted(source)
    if paths != sorted(set(paths)) or paths != actual:
        raise SystemExit("refusing an inconsistent source inventory")
    payloads = {}
    for receipt in receipts:
        data = source[receipt["path"]]
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
        payloads[projection] = (module.encode_properties_projection(sanitized) if population is None else
                                module.projected_bytes(sanitized, manifest["provenance"]))
        changed += 1
    for receipt in receipts:
        data = payloads[receipt["path"]]
        receipt.update(bytes=len(data), sha256=module.sha256(data))
    manifest["generator_sha256"] = generator_digest
    if name == "etl_fleet_corpus":
        rules = manifest["redaction_rules"]
        pid_rules = [i for i, rule in enumerate(rules) if "pid <redacted>" in rule or "case-insensitive PID" in rule]
        if len(pid_rules) != 1:
            raise SystemExit("refusing ambiguous PID redaction provenance")
        rules[pid_rules[0]] = module.PID_REDACTION_RULE
        rules[:] = [rule for rule in rules if rule not in (
            "Never transform structural keys, booleans, nulls, or numeric values.",
            module.PROCESS_REDACTION_RULE,
        )]
        rules[:] = [rule.replace("recursively transform string values only:",
                                "recursively drop process identity members, then transform strings:") for rule in rules]
        rules.append(module.PROCESS_REDACTION_RULE)
    repair_record = {
        "finding": finding, "source_manifest_sha256": module.sha256(original),
        "changed_raw_payloads": changed, "live_recapture": False,
    }
    if "security_resanitization" in manifest:
        manifest["security_resanitization"].setdefault("updates", []).append(repair_record)
    else:
        manifest["security_resanitization"] = repair_record
    if source_ref:
        manifest["security_resanitization"]["superseded_manifest_sha256"] = module.sha256(previous_output)
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
        verify(stage)
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-ref", help="Replay a committed source pin, preserving its capture provenance")
    parser.add_argument("--finding", choices=("CSF-012", "CSF-013"), required=True,
                        help="Finding responsible for this repair receipt")
    args = parser.parse_args()
    for generator in ("etl_fleet_corpus", "etl_run3_fleet_corpus", "etl_run3_checkout_identity"):
        repair(generator, args.source_ref, finding=args.finding)
    for population in ("fleet", "synthetic"):
        repair("etl_run3b_fleet_corpus", args.source_ref, population, finding=args.finding)
