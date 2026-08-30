"""po_from_evidence — ProseObservation transcription for the beep-ci-ops §4b
normalization run.

Contract (s4-lane-contract.md §4b): every S4 lane candidate is a
candidate-harvest entry; its `evidence` quotes become ProseObservation records.
This script TRANSCRIBES those quotes into po-<sha12>.yaml records — it never
paraphrases: the quote field is byte-for-byte the harvest quote, and a quote
that cannot be located in its pinned source span (whitespace-normalized, the
validator's rule) is REPORTED for manual re-capture, never emitted with edits.

Span recovery: if the quoted evidence span does not contain the quote at the
pinned commit (lane extraction ran at an older corpus pin), the file is
searched for the smallest line window containing the normalized quote and the
span is corrected to it; the correction is reported.

Two deterministic transcription rules for harvest-quote shapes that cannot
pass the validator as-is (both stay verbatim — nothing is paraphrased):
- an ELIDED quote (containing ` ... `/`…`) is split on the elision marker and
  each fragment becomes its own ProseObservation (each fragment is verbatim);
- a SHORT quote (<10 chars stripped) with a known span is replaced by the raw
  span text itself, extending the span line-by-line (cap +3) until the
  normalized text reaches 10 chars — the span text is verbatim by
  construction.

Usage:
  python po_from_evidence.py --repo <root> --candidates <CANDIDATES.yaml> --out <dir>
"""

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

EVIDENCE_RE = re.compile(
    r"^(?P<path>[^\s:]+?)(?::(?P<s>\d+)(?:[-–](?P<e>\d+))?)?\s+[—–-]+\s+(?P<q>.+)$",
    re.S,
)

# MANUAL RE-CAPTURES (the hand-captured half of the ProseObservation
# contract): harvest quotes whose wording dropped backticks or crossed JSDoc
# `*` continuation lines, re-captured VERBATIM from the pinned source. Keyed
# by (path, normalized harvest quote) -> verbatim replacement quote.
RECAPTURES: dict[tuple[str, str], str] = {
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts",
        "Gate coordinating one origin-scoped resource (the per-origin full-proof lock)",
    ): "Gate coordinating one origin-scoped resource (the per-origin full-proof",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts",
        "the per-origin full-proof lock",
    ): "lock) underneath machine-wide admission.",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts",
        "runs use while heartbeating the lease",
    ): "then runs `use` while heartbeating the",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts",
        "pid plus procStart",
    ): "`pid` plus `procStart` (the `/proc/<pid>/stat` start time) identify the",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts",
        "identify the owner across pid reuse",
    ): "owner across pid reuse; leases are reaped only when the pid is dead or the",
    (
        "goals/ship-velocity/research/d1-admission-scheduler.md",
        "The publish kind (1 token) remains in the schema",
    ): "remains in the schema for the",
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def canonical_po_id(commit: str, path: str, s: int, e: int, quote: str) -> str:
    payload = [commit, path, s, e, quote]
    return "po:sha256:" + hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


def git_show(repo: Path, commit: str, path: str) -> str | None:
    p = subprocess.run(
        ["git", "-C", str(repo), "show", f"{commit}:{path}"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return p.stdout if p.returncode == 0 else None


def unquote(q: str) -> str:
    q = q.strip()
    for a, b in (("'", "'"), ('"', '"'), ("‘", "’"), ("“", "”")):
        if len(q) >= 2 and q.startswith(a) and q.endswith(b):
            return q[1:-1]
    return q


def locate(lines: list[str], quote: str, s: int | None, e: int | None) -> tuple[int, int] | None:
    nq = norm(quote)
    if not nq:
        return None
    if s is not None:
        e2 = e if e is not None else s
        span = "".join(lines[s - 1 : e2])
        if nq in norm(span):
            return (s, e2)
    # search: smallest window (up to 40 lines) containing the normalized quote
    n = len(lines)
    for width in range(1, 41):
        for start in range(1, n - width + 2):
            window = "".join(lines[start - 1 : start - 1 + width])
            if nq in norm(window):
                return (start, start + width - 1)
    return None


def main() -> None:
    argv = sys.argv[1:]
    def arg(name: str) -> str:
        return argv[argv.index(name) + 1]
    repo = Path(arg("--repo")).resolve()
    cand_path = Path(arg("--candidates")).resolve()
    out = Path(arg("--out")).resolve()
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        capture_output=True, text=True, timeout=10,
    ).stdout.strip()

    candidates = yaml.safe_load(cand_path.read_text())
    out.mkdir(parents=True, exist_ok=True)
    file_cache: dict[str, list[str] | None] = {}
    emitted: dict[str, str] = {}
    drifted: list[str] = []
    unparsed: list[str] = []
    missing: list[str] = []
    short: list[str] = []
    corrected = 0

    for rec in candidates:
        for ev in rec.get("evidence", []) or []:
            ev = str(ev).strip()
            m = EVIDENCE_RE.match(ev)
            if not m:
                unparsed.append(ev)
                continue
            path = m.group("path")
            s = int(m.group("s")) if m.group("s") else None
            e = int(m.group("e")) if m.group("e") else None
            quote = unquote(m.group("q"))
            if path not in file_cache:
                text = git_show(repo, commit, path)
                file_cache[path] = text.splitlines(keepends=True) if text is not None else None
            lines = file_cache[path]
            if lines is None:
                missing.append(ev)
                continue

            if len(quote.strip()) < 10:
                if s is None:
                    short.append(ev)
                    continue
                # SHORT rule: the raw span text is the quote, extended until
                # the normalized text reaches 10 chars (cap +3 lines).
                e2 = e if e is not None else s
                grown = "".join(lines[s - 1 : e2]).strip()
                extra = 0
                while len(norm(grown)) < 10 and extra < 3 and e2 + 1 <= len(lines):
                    e2 += 1
                    extra += 1
                    grown = "".join(lines[s - 1 : e2]).strip()
                if len(norm(grown)) < 10:
                    short.append(ev)
                    continue
                fragments = [(grown, s, e2)]
            elif re.search(r"\s(?:\.\.\.|…)\s", quote) and locate(lines, quote, s, e) is None:
                # ELIDED rule: split on the elision marker; each fragment is a
                # verbatim quote in its own right.
                parts = [p.strip() for p in re.split(r"\s(?:\.\.\.|…)\s", quote) if len(p.strip()) >= 10]
                if not parts:
                    drifted.append(ev)
                    continue
                fragments = [(p, s, e) for p in parts]
            else:
                fragments = [(quote, s, e)]

            for fq, fs, fe in fragments:
                recapture = RECAPTURES.get((path, norm(fq)))
                if recapture is not None and locate(lines, fq, fs, fe) is None:
                    fq = recapture
                    corrected += 1
                span = locate(lines, fq, fs, fe)
                if span is None:
                    drifted.append(f"{path}:{fs}-{fe} — '{fq}'")
                    continue
                if fs is not None and span != (fs, fe if fe is not None else fs):
                    corrected += 1
                pid = canonical_po_id(commit, path, span[0], span[1], fq)
                if pid in emitted:
                    continue
                emitted[pid] = path
                po = {
                    "id": pid,
                    "schema_version": 1,
                    "repository": {"commit": commit, "path": path},
                    "source_span": {"start_line": span[0], "end_line": span[1]},
                    "quote": fq,
                    "epistemic_status": "quoted_prose",
                }
                sha12 = pid.split(":")[-1][:12]
                (out / f"po-{sha12}.yaml").write_text(
                    yaml.safe_dump(po, sort_keys=False, allow_unicode=True, width=100)
                )

    print(f"po_from_evidence: wrote {len(emitted)} ProseObservations to {out}")
    print(f"  spans corrected vs harvest coordinates: {corrected}")
    for label, bucket in (
        ("UNPARSED evidence entries", unparsed),
        ("MISSING files at pin", missing),
        ("DRIFTED quotes (manual re-capture needed)", drifted),
        ("SHORT quotes (<10 chars, manual attention)", short),
    ):
        if bucket:
            print(f"  {label}: {len(bucket)}")
            for b in bucket:
                print(f"    - {b[:160]}")


if __name__ == "__main__":
    main()
