"""Check corpus coverage, control decisions and incomplete family-proof rejection."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    fixtures = root / "packages/law-practice/use-cases/test/fixtures/eyecite"
    evidence = root / "goals/citation-extraction-engine/history/evidence"
    corpus = json.loads((fixtures / "regex-adversarial-corpus.json").read_text())
    controls = json.loads((evidence / "regex-benchmark-controls.json").read_text())
    validator = root / "goals/citation-extraction-engine/ops/check-regex-benchmarks.ts"
    def invoke(folder, reports, audit=True):
        return subprocess.run(["bun", "run", str(validator), "--fixtures", str(folder), "--evidence", str(reports), *(["--audit"] if audit else [])],
                              cwd=root, capture_output=True, text=True, timeout=180)
    baseline = invoke(fixtures, evidence)
    if baseline.returncode or "120 adversarial inputs, 110 families, 13610 instances" not in baseline.stdout:
        raise SystemExit("benchmark contract baseline must pass")
    strict = invoke(fixtures, evidence, False)
    if strict.returncode != 1:
        raise SystemExit("missing family execution proof must fail default mode")
    def projection(c, mutate):
        value = json.loads(c["sourceProjection"])
        mutate(value)
        c["sourceProjection"] = json.dumps(value, sort_keys=True, separators=(",", ":"))
        c["sourceProjectionSha256"] = sha(c["sourceProjection"].encode())
    def samples(report, medians):
        for row, value in zip(report["runs"][0]["rows"], medians):
            row["sample"]["samplesNanos"] = [value] * 5
    def changed_text(c):
        c["cases"][0]["text"] = "b" * 8
        c["cases"][0]["inputSha256"] = sha(c["cases"][0]["text"].encode())
    mutations = {
        "missing-corpus-case": lambda c, r: c["cases"].pop(),
        "duplicate-corpus-case": lambda c, r: c["cases"].append(c["cases"][0]),
        "changed-input-rehashed": lambda c, r: changed_text(c),
        "wrong-input-size": lambda c, r: c["cases"][0].update(size=9),
        "unknown-input-recipe": lambda c, r: c["cases"][0].update(recipeId="other"),
        "stale-input-hash": lambda c, r: c["cases"][0].update(inputSha256="a" * 64),
        "missing-family": lambda c, r: projection(c, lambda v: v["families"].pop()),
        "missing-instance": lambda c, r: projection(c, lambda v: v["extractorInstances"].pop()),
        "changed-pattern-hash": lambda c, r: projection(c, lambda v: v["extractorInstances"][0].update(patternSha256="a" * 64)),
        "changed-instance-flags": lambda c, r: projection(c, lambda v: v["extractorInstances"][0].update(flags=1234)),
        "changed-instance-constructor": lambda c, r: projection(c, lambda v: v["extractorInstances"][0].update(constructor="other")),
        "stale-source-projection": lambda c, r: c.update(sourceProjectionSha256="a" * 64),
        "missing-oracle-license": lambda c, r: c.pop("oracleLicense"),
        "wrong-synthetic-license": lambda c, r: c["syntheticLicense"].update(id="MIT"),
        "stale-synthetic-license": lambda c, r: c["syntheticLicense"].update(sha256="a" * 64),
        "stale-generator": lambda c, r: c.update(generatorSha256="a" * 64),
        "stale-plan": lambda c, r: c.update(planSha256="a" * 64),
        "missing-control-run": lambda c, r: r["runs"].pop(),
        "duplicate-control-run": lambda c, r: r["runs"].append(r["runs"][0]),
        "missing-cpu": lambda c, r: r.pop("cpuModel"),
        "missing-parent-hash": lambda c, r: r.pop("parentSha256"),
        "stale-child-source": lambda c, r: r.update(childSha256="a" * 64),
        "missing-confirmed-exit": lambda c, r: r["runs"][0]["rows"][0].pop("exitConfirmed"),
        "unconfirmed-exit": lambda c, r: r["runs"][0]["rows"][0].update(exitConfirmed=False),
        "wrong-exit-signal": lambda c, r: r["runs"][1]["rows"][-1].update(exitSignal="SIGTERM"),
        "catastrophic-accepted": lambda c, r: r["runs"][1].update(decision="accepted"),
        "linear-rejected": lambda c, r: r["runs"][0].update(decision="rejected-scaling"),
        "wrong-match-observation": lambda c, r: r["runs"][0]["rows"][0]["sample"].update(matched=False),
        "missing-warmup-count": lambda c, r: r["runs"][0]["rows"][0]["sample"].pop("warmups"),
        "wrong-evaluation-count": lambda c, r: r["runs"][0]["rows"][0]["sample"].update(totalEvaluations=1),
        "missing-sample": lambda c, r: r["runs"][0]["rows"][0]["sample"]["samplesNanos"].pop(),
        "nonpositive-sample": lambda c, r: r["runs"][0]["rows"][0]["sample"]["samplesNanos"].__setitem__(0, 0),
        "missing-geometric-size": lambda c, r: r["runs"][0]["rows"].pop(1),
        "consecutive-fourfold-growth": lambda c, r: samples(r, [4, 16, 64, 65, 66, 67, 68]),
        "wrong-runtime-version": lambda c, r: r["runs"][0]["rows"][0]["sample"].update(runtime="v0"),
        "missing-guard-scope": lambda c, r: r.pop("watchdogScope"),
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="regex-benchmark-controls-", dir=args.scratch_root) as scratch:
        scratch = Path(scratch)
        copied_fixtures, copied_evidence = scratch / "fixtures", scratch / "evidence"
        copied_fixtures.mkdir(); copied_evidence.mkdir()
        for name in ["source-inventory.json", "canonical-cases.json", "regex-inventory.json"]:
            shutil.copyfile(fixtures / name, copied_fixtures / name)
        def write(c, r):
            encoded = json.dumps(r).encode()
            (copied_evidence / "regex-benchmark-controls.json").write_bytes(encoded)
            c["controlsSha256"] = sha(encoded)
            (copied_fixtures / "regex-adversarial-corpus.json").write_text(json.dumps(c))
        for name, mutate in mutations.items():
            c, r = copy.deepcopy(corpus), copy.deepcopy(controls)
            mutate(c, r); write(c, r)
            if invoke(copied_fixtures, copied_evidence).returncode != 1:
                raise SystemExit(f"negative control did not fail: {name}")
            print(f"PASS {name}")
        for name, values in [("exact-threshold-is-allowed", [4,14,49,50,51,52,53]), ("single-breach-is-allowed", [4,16,16,17,18,19,20])]:
            c, r = copy.deepcopy(corpus), copy.deepcopy(controls)
            samples(r, values); write(c, r)
            if invoke(copied_fixtures, copied_evidence).returncode:
                raise SystemExit(f"positive scaling control did not pass: {name}")
            print(f"PASS {name}")
        write(copy.deepcopy(corpus), copy.deepcopy(controls))
        (copied_fixtures / "regex-benchmark-results.json").write_text('{"schemaVersion":"citation-regex-family-results/v1","families":[],"instanceCoverage":[]}')
        if invoke(copied_fixtures, copied_evidence).returncode != 1:
            raise SystemExit("empty family result file must not be accepted")
    print(f"baseline and default incomplete rejection passed; {len(mutations) + 1} negative and 2 positive contract controls passed")


if __name__ == "__main__":
    main()
