"""adapter-typescript — manifest-pinned entry point for the TypeScript
SourceObservation extractor (beep-ci-ops §4b normalization).

The parsing engine is the committed sibling `adapter-typescript.ts` (TypeScript
compiler API under bun); this wrapper (1) verifies the engine's bytes against
the committed sidecar digest `adapter-typescript.ts.sha256` so the manifest pin
of THIS script transitively pins the engine, (2) converts the engine's JSON
records to one `so-<sha12>.yaml` per record, (3) implements the golden
`--self-check` contract.

Usage:
  python adapter-typescript.py --self-check <golden_dir>
  python adapter-typescript.py --repo <root> --out <observations_dir>
"""

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
ENGINE = HERE / "adapter-typescript.ts"
SIDECAR = HERE / "adapter-typescript.ts.sha256"
GOLDEN_REL = (
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/"
    "beep-ci-ops/adapters/golden/typescript/input.ts"
)


def die(msg: str) -> None:
    print(f"adapter-typescript: {msg}", file=sys.stderr)
    sys.exit(1)


def bun() -> str:
    b = shutil.which("bun") or str(Path.home() / ".local/share/mise/shims/bun")
    if not Path(b).exists():
        die("bun not found on PATH or at the mise shim path")
    return b


def verify_engine() -> None:
    want = SIDECAR.read_text().split()[0]
    got = hashlib.sha256(ENGINE.read_bytes()).hexdigest()
    if got != want:
        die(
            f"engine digest mismatch: adapter-typescript.ts is {got[:12]}, "
            f"sidecar pins {want[:12]} — regenerate the sidecar only with a "
            "version bump"
        )


def run_engine(args: list[str]) -> list[dict]:
    p = subprocess.run(
        [bun(), str(ENGINE), *args], capture_output=True, text=True, timeout=600
    )
    if p.returncode != 0:
        die(f"engine failed: {p.stderr.strip()}")
    records = []
    for line in p.stdout.splitlines():
        line = line.strip()
        if line:
            records.append(json.loads(line))
    return records


def canonical(rec: dict) -> str:
    return json.dumps(rec, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def self_check(golden_dir: Path) -> None:
    inp = golden_dir / "typescript" / "input.ts"
    expected_file = golden_dir / "typescript" / "expected.yaml"
    if not inp.exists() or not expected_file.exists():
        die(f"golden fixture incomplete under {golden_dir}/typescript/")
    got = run_engine(["--golden-input", str(inp), "--golden-path", GOLDEN_REL])
    expected = yaml.safe_load(expected_file.read_text())
    got_c = sorted(canonical(r) for r in got)
    want_c = sorted(canonical(r) for r in expected)
    if got_c != want_c:
        for g, w in zip(got_c, want_c):
            if g != w:
                print(f"- want: {w}\n+ got:  {g}", file=sys.stderr)
        if len(got_c) != len(want_c):
            print(f"count: want {len(want_c)} got {len(got_c)}", file=sys.stderr)
        die("golden self-check FAILED")
    print(f"adapter-typescript --self-check PASS ({len(got_c)} records)")


def extract(repo: Path, out: Path) -> None:
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        timeout=10,
    ).stdout.strip()
    if len(commit) != 40:
        die("cannot resolve repo HEAD")
    records = run_engine(["--repo", str(repo), "--commit", commit])
    out.mkdir(parents=True, exist_ok=True)
    for rec in records:
        sha12 = rec["id"].split(":")[-1][:12]
        (out / f"so-{sha12}.yaml").write_text(
            yaml.safe_dump(rec, sort_keys=False, allow_unicode=True, width=100)
        )
    print(f"adapter-typescript: wrote {len(records)} SourceObservations to {out}")


def main() -> None:
    argv = sys.argv[1:]
    verify_engine()
    if argv[:1] == ["--self-check"] and len(argv) == 2:
        self_check(Path(argv[1]))
    elif "--repo" in argv and "--out" in argv:
        repo = Path(argv[argv.index("--repo") + 1]).resolve()
        out = Path(argv[argv.index("--out") + 1]).resolve()
        extract(repo, out)
    else:
        die("usage: --self-check <golden_dir> | --repo <root> --out <dir>")


if __name__ == "__main__":
    main()
