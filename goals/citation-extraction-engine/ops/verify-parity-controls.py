"""Exercise the actual package command, including eight corrupted component inputs."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    package = root / "packages/law-practice/use-cases"
    fixtures = package / "test/fixtures/eyecite"
    evidence = root / "goals/citation-extraction-engine/history/evidence"

    def invoke(*flags):
        return subprocess.run(["bun", "run", "citation:parity-check", *flags], cwd=package,
                              capture_output=True, text=True, timeout=180)

    baseline = invoke("--audit")
    if baseline.returncode or "audit passed: 8 components" not in baseline.stdout:
        raise SystemExit("package audit baseline must pass")
    strict = invoke()
    if (strict.returncode != 1 or "FAIL ledgers" not in strict.stdout or "FAIL donors" not in strict.stdout or "FAIL supplemental" not in strict.stdout
            or strict.stdout.count("PENDING check-") != 3 or "portable parity checks passed" in strict.stdout):
        raise SystemExit("default command must reject the actual unfinished proof")
    print("PASS default-strict-rejects-current-incomplete-proof")
    for name, flags in {
        "unknown-option": ["--complete"],
        "duplicate-option": ["--audit", "--audit"],
        "missing-option-value": ["--fixtures"],
        "option-as-value": ["--evidence", "--audit"],
    }.items():
        result = invoke(*flags)
        if result.returncode != 1 or "PASS " in result.stdout:
            raise SystemExit(f"invalid argument control did not fail: {name}")
        print(f"PASS {name}")
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="parity-controls-", dir=args.scratch_root) as scratch:
        scratch = Path(scratch)
        copied_fixtures, copied_evidence = scratch / "fixtures", scratch / "evidence"
        shutil.copytree(fixtures, copied_fixtures)
        shutil.copytree(evidence, copied_evidence)
        flags = ["--audit", "--fixtures", str(copied_fixtures), "--evidence", str(copied_evidence)]
        relocated = invoke(*flags)
        if relocated.returncode or "audit passed: 8 components" not in relocated.stdout:
            raise SystemExit("relocated baseline must pass")
        for component, file in {
            "discovery": copied_evidence / "oracle-discovery.json",
            "operations": copied_fixtures / "operation-cases.json",
            "assertions": copied_fixtures / "assertion-cases.json",
            "ledgers": copied_fixtures / "source-inventory.json",
            "donors": copied_fixtures / "typescript-extensions.json",
            "vocabulary": copied_fixtures / "vocabulary-mapping.json",
            "safety-contract": copied_evidence / "citation-policy-contract.json",
            "supplemental": copied_fixtures / "supplemental-extraction.json",
        }.items():
            original = file.read_bytes()
            value = json.loads(original)
            value.pop("schemaVersion")
            file.write_text(json.dumps(value))
            result = invoke(*flags)
            file.write_bytes(original)
            if (result.returncode != 1 or f"FAIL {component}" not in result.stdout
                    or "audit passed" in result.stdout or "portable parity checks passed" in result.stdout):
                raise SystemExit(f"corrupt component escaped the package gate: {component}")
            print(f"PASS corrupted-{component}")
    print("package and relocated audit baselines passed; 13 rejection controls passed")


if __name__ == "__main__":
    main()
