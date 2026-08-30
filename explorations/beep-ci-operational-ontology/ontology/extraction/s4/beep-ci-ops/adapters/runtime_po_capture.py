"""runtime_po_capture — auditor-selected ProseObservations for the round-3
CQ-core re-judgment (beep-ci-ops §4b).

The r2 adversary held that the static-syntax observation corpus cannot beat
the "true of a plain DTO" bar for the CQ-load-bearing referents. These quotes
are the DEPLOYED-RUNTIME evidence (design record, measured KPI baseline,
journal/scheduler/cache-posture runtime prose) the original corpus lacked —
hand-captured verbatim per the ProseObservation contract (the one
hand-captured record kind), transcribed by this committed script.
"""

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

D1 = "goals/ship-velocity/research/d1-admission-scheduler.md"
KPI = "explorations/beep-ci-operational-ontology/research/kpi-baseline-2026-08-27.md"
AJ = "packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts"
QSS = "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts"
QS = "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts"
TC = "packages/tooling/tool/cli/src/internal/cli/TurboCache.ts"

QUOTES: list[tuple[str, str]] = [
    (D1, "weights full-proof 3 / merged-preview 5 / review-fix 1 (×3) / publish 1 · heartbeat 5s ·"),
    (D1, "6. **Reap rule.** Only pid-dead or `/proc` starttime mismatch (SPEC D3); stale heartbeats"),
    (D1, "becomes skippable for later origins — mixed-version fleets can no longer starve the queue,"),
    (KPI, "new-binary contenders QUEUE instead of bouncing. The 27%/17% lock-bounce economy"),
    (KPI, "41 verdict files vs 18 journals with 186 finished attempts here."),
    (KPI, "Machine-lock contention failures are **first-class recorded data**: the verdict `message`"),
    (AJ, "Branch-scoped append-only Yeet attempt journal."),
    (AJ, "A durable marker written immediately before a Yeet attempt executes."),
    (QSS, "publish priority after the configured aging window so nothing starves."),
    (QSS, "15 GiB, heartbeat 5s, progress 15s, publish aging 120s, review-fix class"),
    (QS, "Roll back an admission that overshot capacity because two observers promoted"),
    (QS, "One promotion attempt: admit self when first in the shared order and the"),
    (TC, "Local Turbo cache posture: the decision that says whether a workstation may"),
    (TC, "Root quality commands used to inject `--cache=local:rw` on every non-CI Turbo"),
    (TC, "`local:rw` is the fail-closed default. `local:rw,remote:r` is the only"),
]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    repo = Path(sys.argv[sys.argv.index("--repo") + 1]).resolve()
    out = Path(sys.argv[sys.argv.index("--out") + 1]).resolve()
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        capture_output=True, text=True, timeout=10,
    ).stdout.strip()
    out.mkdir(parents=True, exist_ok=True)
    cache: dict[str, list[str]] = {}
    written = 0
    for path, quote in QUOTES:
        if path not in cache:
            p = subprocess.run(
                ["git", "-C", str(repo), "show", f"{commit}:{path}"],
                capture_output=True, text=True, timeout=30,
            )
            if p.returncode != 0:
                raise RuntimeError(f"git show failed for {path}")
            cache[path] = p.stdout.splitlines(keepends=True)
        lines = cache[path]
        nq = norm(quote)
        span = None
        for width in range(1, 6):
            for start in range(1, len(lines) - width + 2):
                if nq in norm("".join(lines[start - 1 : start - 1 + width])):
                    span = (start, start + width - 1)
                    break
            if span:
                break
        if span is None:
            raise RuntimeError(f"quote not found verbatim in {path}: {quote[:60]}")
        payload = [commit, path, span[0], span[1], quote]
        pid = "po:sha256:" + hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        ).hexdigest()
        rec = {
            "id": pid,
            "schema_version": 1,
            "repository": {"commit": commit, "path": path},
            "source_span": {"start_line": span[0], "end_line": span[1]},
            "quote": quote,
            "epistemic_status": "quoted_prose",
        }
        (out / f"po-{pid.split(':')[-1][:12]}.yaml").write_text(
            yaml.safe_dump(rec, sort_keys=False, allow_unicode=True, width=100)
        )
        written += 1
    print(f"runtime_po_capture: wrote {written} ProseObservations to {out}")


if __name__ == "__main__":
    main()
