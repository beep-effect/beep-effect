"""Tree-pinned citation replay for the frozen run-3 corpus pins (graduation Ruling 8,
2026-10-01 graduation sitting).

Every repository citation in a run-3 corpus MANIFEST ({file, line, needle, sha256})
was resolved by its generator at capture time, against the capture commit. Main has
moved since then, so the generators' own verify modes ("source citation anchor differs
in current tree") are red at HEAD, and #1160 rewrote citation line numbers in the
committed manifests without a DECISIONS entry. Ruling 8 replaces current-tree replay
with tree-pinned replay: this script reads each manifest's bytes AS PINNED (the run-3
pin tag, never the working tree), and resolves every citation against the git tree
object the manifest itself records as `corpus_tree`:

  - the cited file exists in `corpus_tree`;
  - `line` is an integer inside that file;
  - `needle`, when present, occurs on that line;
  - `sha256`, when present, equals the sha256 of the file bytes in `corpus_tree`;
  - when `corpus_commit` is present locally, its root tree equals `corpus_tree`.

A failed check on any pin is a failure; the verdict line prints the per-pin failure
counts (run3-fleet/run3b-fleet/run3b-synthetic) and must read 0/0/0. Two advisory lines
never change the exit code: how many pinned citations are changed or absent in the HEAD
manifest bytes (the #1160 edit), and how many pinned citations fail in the HEAD tree
(current-tree resolution is advisory by Ruling 8 item 4).

The capture commit `a9035c364e` is reachable only through the evidence tag
`evidence/beep-ci-ops/orun-2026-09-10T02-10-52Z-capture` (Ruling 8 item 3); a clone
without that tag lacks the `corpus_tree` object and this script fails loudly, naming
the tag to fetch. `run3-checkout-identity` records no `corpus_tree` and no needles, so
it is out of scope. The frozen generators under `ontology/extraction/**` are never read
or edited (their self-pinned `generator_sha256` forbids it).

Ruling 8 item 6: the frozen corpus regression suite beside the generators
(`test_run2_repair.py`, `test_run3_generators.py`, `test_run3b_generator.py`; 98 tests,
not CI-wired) is red at HEAD with 2 failures and 3 errors. It lives in the byte-immutable
`extraction/` tree, so it is retired, not edited; its bytes stay as provenance and this
script replaces its citation leg. The three errors are that leg
(`test_run3b_generator.CensusTests.test_source_citations_resolve_from_committed_needles`
and the current-tree citation step of `test_run3_generators.PinnedContractTests`
`test_ordinary_rerun_cannot_capture_read_source_or_spawn` and
`test_pin_corruption_fails_then_original_bytes_verify`). The two failures are source
drift: `RedactionTests.test_execution_step_identifiers_preserve_failure_rider_and_projections`
(`stepId: S.` removed from `ProofState.ts` by #1168) and
`RedactionTests.test_deployed_execution_join_keys_survive_redaction_and_projection`
(`YeetVerdictLane.parentLaneId`, which #1239 added to `Verdict.ts`, is a non-process
lane join key per Ruling 8 item 5).

Run from the repository root (stdlib + pyyaml):

  UV_CACHE_DIR=$HOME/.cache/beep/uv-cache uv run --with pyyaml python \\
    explorations/beep-ci-operational-ontology/research/scripts/verify_run3_citations.py

Options: --pin-ref REF (manifest bytes; default the run-3 pin tag), --pins NAME...
(default the three run-3 corpus pins), --repo DIR (default: this script's repository).
Exit 0 when every pin verifies, 1 on any failure, 2 on usage errors.
"""
import argparse
import hashlib
import subprocess
import sys
from pathlib import Path, PurePosixPath

import yaml

CORPUS = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus"
DEFAULT_PIN_REF = "evidence/beep-ci-ops/orun-2026-09-10T02-10-52Z-pin"
CAPTURE_TAG = "evidence/beep-ci-ops/orun-2026-09-10T02-10-52Z-capture"
DEFAULT_PINS = ("run3-fleet", "run3b-fleet", "run3b-synthetic")

Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


class GitObjectMissing(Exception):
    """A git object or path is absent from the local object store."""


def git(repo: Path, *args: str) -> bytes:
    completed = subprocess.run(["git", "--no-optional-locks", "-C", str(repo), *args],
                               capture_output=True, timeout=60)
    if completed.returncode:
        raise GitObjectMissing(" ".join(args))
    return completed.stdout


def object_type(repo: Path, rev: str) -> str | None:
    try:
        return git(repo, "cat-file", "-t", rev).decode().strip()
    except GitObjectMissing:
        return None


def citations(value, out: list[dict]) -> list[dict]:
    """Collect {file, line, ...} dicts; angle-bracket files name fleet inputs, not code."""
    if isinstance(value, dict):
        file = value.get("file")
        if "file" in value and "line" in value and isinstance(file, str) and not file.startswith("<"):
            out.append(value)
        for child in value.values():
            citations(child, out)
    elif isinstance(value, list):
        for child in value:
            citations(child, out)
    return out


def safe_path(file: str) -> bool:
    path = PurePosixPath(file)
    return bool(file) and not path.is_absolute() and ".." not in path.parts and "\\" not in file


class TreeReader:
    """Cached blob reads from one git tree-ish."""

    def __init__(self, repo: Path, treeish: str):
        self.repo, self.treeish, self.cache = repo, treeish, {}

    def read(self, file: str) -> bytes | None:
        if file not in self.cache:
            try:
                self.cache[file] = git(self.repo, "cat-file", "blob", f"{self.treeish}:{file}")
            except GitObjectMissing:
                self.cache[file] = None
        return self.cache[file]


def check(cite: dict, reader: TreeReader, hashes: bool) -> str | None:
    """Return a failure reason for one citation, or None when it resolves."""
    file, line, needle = cite["file"], cite["line"], cite.get("needle")
    if not safe_path(file):
        return "unsafe path"
    data = reader.read(file)
    if data is None:
        return "file missing"
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeDecodeError:
        return "file not UTF-8"
    if type(line) is not int or not 1 <= line <= len(lines):
        return "line out of range"
    if needle is not None and (not isinstance(needle, str) or not needle or needle not in lines[line - 1]):
        return "needle differs"
    if hashes and "sha256" in cite and cite["sha256"] != hashlib.sha256(data).hexdigest():
        return "sha256 differs"
    return None


def key(cite: dict) -> tuple:
    return (cite["file"], cite["line"], cite.get("needle"), cite.get("sha256"))


def main() -> int:
    parser = argparse.ArgumentParser(description="tree-pinned replay of run-3 corpus citations (Ruling 8)")
    parser.add_argument("--pin-ref", default=DEFAULT_PIN_REF, help="git ref holding the pinned manifest bytes")
    parser.add_argument("--pins", nargs="+", default=list(DEFAULT_PINS), help="corpus pin directories to verify")
    parser.add_argument("--repo", type=Path, default=None, help="repository root (default: this script's repo)")
    args = parser.parse_args()

    start = args.repo if args.repo is not None else Path(__file__).resolve().parent
    try:
        repo = Path(git(start, "rev-parse", "--show-toplevel").decode().strip())
    except GitObjectMissing:
        print(f"FAIL: not inside a git repository: {start}")
        return 2
    if object_type(repo, f"{args.pin_ref}^{{commit}}") is None:
        print(f"FAIL: pin ref {args.pin_ref} is not available locally (git fetch origin tag {args.pin_ref})")
        return 1

    failures: dict[str, int] = {}
    totals: dict[str, int] = {}
    for pin in args.pins:
        manifest_path = f"{CORPUS}/{pin}/MANIFEST.yaml"
        try:
            pinned_bytes = git(repo, "show", f"{args.pin_ref}:{manifest_path}")
        except GitObjectMissing:
            print(f"FAIL {pin}: {manifest_path} absent at {args.pin_ref}")
            failures[pin], totals[pin] = 1, 0
            continue
        manifest = yaml.load(pinned_bytes, Loader=Loader)
        tree = manifest.get("corpus_tree") if isinstance(manifest, dict) else None
        commit = manifest.get("corpus_commit") if isinstance(manifest, dict) else None
        cites = citations(manifest, [])
        totals[pin] = len(cites)
        if not isinstance(tree, str):
            print(f"FAIL {pin}: manifest records no corpus_tree; tree-pinned replay cannot apply")
            failures[pin] = len(cites) or 1
            continue
        if object_type(repo, tree) != "tree":
            print(f"FAIL {pin}: corpus_tree {tree} is not a tree object in this clone "
                  f"(git fetch origin tag {CAPTURE_TAG})")
            failures[pin] = len(cites) or 1
            continue
        bad = []
        if not cites:
            bad.append(("MANIFEST.yaml", 0, "no repository citations found"))
        if isinstance(commit, str):
            if object_type(repo, commit) == "commit":
                root = git(repo, "rev-parse", f"{commit}^{{tree}}").decode().strip()
                if root != tree:
                    bad.append(("corpus_commit", 0, f"root tree {root[:12]} differs from corpus_tree"))
            else:
                print(f"advisory {pin}: corpus_commit {commit[:10]} absent locally; "
                      f"corpus_tree is the authority (evidence tag {CAPTURE_TAG})")
        reader = TreeReader(repo, tree)
        cite_failures = 0
        for cite in cites:
            reason = check(cite, reader, hashes=True)
            if reason is not None:
                cite_failures += 1
                bad.append((cite["file"], cite["line"], reason))
        failures[pin] = len(bad)
        status = "ok" if not bad else "FAIL"
        print(f"{status} {pin}: {len(cites) - cite_failures}/{len(cites)} citations resolve "
              f"in corpus_tree {tree[:10]} (manifest bytes at {args.pin_ref})")
        for file, line, reason in sorted(set(bad)):
            print(f"  FAIL {pin}: {file}:{line}: {reason}")

        # Advisory 1: HEAD manifest bytes versus the pinned bytes (the #1160 line edit).
        try:
            head_manifest = yaml.load(git(repo, "show", f"HEAD:{manifest_path}"), Loader=Loader)
            head_keys = set(map(key, citations(head_manifest, [])))
            drift = sum(key(cite) not in head_keys for cite in cites)
            print(f"advisory {pin}: {drift}/{len(cites)} pinned citations are changed or absent "
                  f"in the HEAD manifest bytes")
        except GitObjectMissing:
            print(f"advisory {pin}: no HEAD manifest")
        # Advisory 2: current-tree resolution of the pinned citations (never gating).
        head_reader = TreeReader(repo, "HEAD")
        head_bad = sum(check(cite, head_reader, hashes=False) is not None for cite in cites)
        print(f"advisory {pin}: {head_bad}/{len(cites)} pinned citations fail in the HEAD tree "
              f"(current-tree resolution is advisory)")

    counts = "/".join(str(failures[pin]) for pin in args.pins)
    names = "/".join(args.pins)
    verdict = "PASS" if not any(failures.values()) else "FAIL"
    print(f"VERDICT {verdict}: failing citations {counts} ({names}; "
          f"{sum(totals.values())} citations, tree-pinned replay, graduation Ruling 8)")
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
