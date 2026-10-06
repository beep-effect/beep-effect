# Relocation note (run-4 launch), 2026-10-06

This directory is the sibling shelter of the run-3 seat trees (`orun-2026-09-10T02:10:52Z`). The
files were moved here from the live scan root `beep-ci-ops/work/` on 2026-10-06, before the run-4
pin, by a plain `mv` with a byte-identity check. No byte was edited. This README is the only new
file; it is not part of the moved set.

## What moved

| From (`extraction/s4/beep-ci-ops/`) | To (`extraction/s4/archives/beep-ci-ops/`) | Files |
| --- | --- | --- |
| `work/alternative/` | `orun-2026-09-10T02:10:52Z.work/alternative/` | 90 |
| `work/denotation-batches/` | `orun-2026-09-10T02:10:52Z.work/denotation-batches/` | 8 |
| `work/foundational/` | `orun-2026-09-10T02:10:52Z.work/foundational/` | 90 |
| `work/hypotheses/` | `orun-2026-09-10T02:10:52Z.work/hypotheses/` | 66 |
| `work/proposals/` | `orun-2026-09-10T02:10:52Z.work/proposals/` | 46 |
| `work/review-audit/` | `orun-2026-09-10T02:10:52Z.work/review-audit/` | 4 |
| `work/sittings/` | `orun-2026-09-10T02:10:52Z.work/sittings/` | 11 |
| `governance/ratifications/rat-053..070.yaml` | `orun-2026-09-10T02:10:52Z.governance/ratifications/` | 18 |

315 seat-tree files and 18 ratifications, 333 in all. The run-3 observations were already archived
at `../orun-2026-09-10T02:10:52Z.observations/` by the run-3 rotation, and the run-3 manifest and
index stay at `beep-ci-ops/runs/orun-2026-09-10T02:10:52Z.{manifest,index}.yaml`.

## Why

- The v15 validator scans every record-prefixed `*.yaml` under the ontology root as live and has
  no in-root archive exemption; the skill's rotation keeps per-run record trees at the sibling
  shelter outside the scan root (`.claude/skills/ontology-foundational-auditor/SKILL.md`,
  "OBSERVATIONS ARE RUN-SCOPED" and "CARRY-FORWARD POLICY"). Left in place, the run-3 trees read
  as 904 violations against a run-4 scan.
- Observation ids embed the pinned commit and the adapter version and are recomputed, never
  hand-typed, so they re-mint under a new pin. Run-3 hypotheses and reviews cite run-3 observation
  ids and cannot re-validate under the run-4 pin.
- `research/scripts/validate_packet.py` reads the shelters: its `--s5` joins glob
  `archives/*/orun-*.governance/ratifications/rat-*.yaml` and
  `archives/beep-ci-ops/orun-*.work/proposals/otp-*.yaml`, so the S5 status files that bind to
  these records keep resolving.

## Byte identity

Tree digests, equal before and after the move:

| Tree | Files | sha256 |
| --- | --- | --- |
| `orun-2026-09-10T02:10:52Z.work/` (this directory, README excluded) | 315 | `4fe3bccbf24385b9077ac8d8475063371e5d420076b685732f7f395ee5c227a4` |
| `orun-2026-09-10T02:10:52Z.governance/ratifications/` | 18 | `87e15cfa6d991c37dcab01a48624370e93e1d0c05f79488620442d3ec96fe7b6` |

Recipe (run with the tree as the argument; it excludes this README):

```sh
TD() { (cd "$1" && find . -type f ! -path ./README.md -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64); }
```

Each of the 333 files also hashes to the git blob it had at its old path in the commit the move
started from (`git hash-object` against `git rev-parse <commit>:<old path>`).

## Authority and provenance

- `goals/ciops-ontology-pipeline/research/decisions.md`, entry "2026-10-06 — P3 opened; run-4
  launch sitting": Ruling 3 (the move is lawful, notes live only in new files), Ruling 4 (a plain
  `mv` by the engine lane, staged by the orchestrator), recorded calls (i) and (j).
- The moved bytes are run-3 provenance and are frozen here. Ratifications `rat-053..070` keep the
  steward fields they were scribed with.
- Links into `work/` and `governance/ratifications/` inside
  `beep-ci-ops/runs/orun-2026-09-10T02:10:52Z.README.md` and `beep-ci-ops/work-run3/impl-report.md`
  are not rewritten: those files are not appended to, and the old paths stay as provenance. Read
  them against the table above.
