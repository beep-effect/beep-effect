# Complexity Ceiling Burn-Down

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Clear the current cognitive->15 tail (49 functions), promote the fallow health lane
from advisory to a blocking baseline ratchet, and keep the `maxCognitive: 8`
gate credible — zero appeasement refactors, zero bare suppressions.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/complexity-ceiling-burn-down/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/calibration.md`](./research/calibration.md) - the 2026-07-30
   calibration evidence (distribution, judged panel, decisions) this whole
   campaign rests on.
6. [`research/tail-inventory.md`](./research/tail-inventory.md) - live P0 target
   list and per-function verdicts.
7. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction receipts
   discovered while executing the packet.

## Current Phase

P0 research and P1 implementation are complete. P2 full verification is open
again after integrating current main at `663904610c`; P3 publication and P4
final closeout remain open until the exact pull request head is proven
merge-ready. All 49 functions in the refreshed P0 inventory have
executed verdicts:
30 real refactors and 19 review-dated cohesive-boundary overrides, with zero
ignore additions. Runtime-coverage CRAP and `fallow impact` are both deferred
with evidence.

The repository has evolved since the 2026-07-30 calibration. Per the 2026-09-03
user refresh, the latest-main total of 207 suppressions is the campaign's
no-growth comparator; the calibration total and original refreshed P0 total of
194 remain provenance rather than stop conditions. The final
committed-candidate baseline has 189 entries, all matched, with zero stale or
moved entries. The strict branch-local Fallow audit passed on the current
candidate with zero introduced findings.

## Latest Evidence

The user requested early PR publication while full verification continues.
The clean-commit run on `3def70707c` passed all 15 initial gates, security,
SAST, build, and desktop IPC before it was deliberately interrupted to switch
to that workflow. A publication freshness check found main at `663904610c`;
its ONNX replacement supersedes the campaign's original advisory exception.
The combined candidate still needs full local and hosted proof.

The integration with main at `52fcc8d135` passed repository Oxlint and three
fresh health checks at **2026-09-09T01:04:34Z**, **01:04:37Z**, and
**01:04:40Z**. Fallow 3.23.0 analyzed 4,443 files and 68,551 functions with
zero unwaived functions above cognitive 15. All 189 baseline entries match,
and suppression hygiene remains 207 total with no missing reasons or stale
entries. The affected epistemic package passed its full audit and docgen
after three test calls were switched to its existing compiled codecs.

Publication of `3f22ad17fa` had passed security, committed-range SAST, build,
test typechecking, full docgen, integration, and lint before semantic-delta
rejected an executable command's positional argument as an unknown subcommand.
The SPEC now names the equivalent CI lane entry point, which passed its
mitigation proof and OSV scan. This repair and the main integration require
fresh full proof on the committed candidate. Hosted proof and closeout remain
outstanding.

The previous full local verification passed at **2026-09-09T00:21:12Z**. Its reviewed
candidate includes `origin/main` at `9b7553f618` through HEAD `29f1284b43`.
The full-tier verdict records 31 passed lanes, three reused lanes, and no
failures. All 15 initial gates passed, as did security, build, full docgen,
lint and policy, compiler checks, unit and integration tests, coverage, and
final blocking health. The CLI suite passed 163 files and 3,159 tests; coverage
passed its comparison across 134 packages. This build required no TS2589
quarantine handling.

Fallow 3.23.0 analyzed 4,441 files and 68,533 functions with zero unwaived
functions above cognitive 15. All 189 baseline entries match, and suppression
hygiene remains 207 total with no missing reasons or stale entries. Three
consecutive health runs and their unchanged baseline digest are recorded in
`reports/clean-runs.md`.

Main at `663904610c` replaces ONNX's vulnerable ZIP dependency with fflate
and private download and destination staging directories. The temporary
advisory exception is removed. The pre-scan guard now verifies the installed
replacement, symlink isolation, private permissions, and cleanup in three
passing tests. Local and hosted security require this proof before OSV. The root regression script
has an explicit catalog dependency; Knip reports zero introduced findings.
A focused SAST replay of all four staged JavaScript/TypeScript files ran 128
rules with zero findings. The later publication scan included the committed
installer regression script and passed. Both SAST and semantic-delta require
committed-candidate proof; pre-commit file equality does not establish their
complete scope.

P0 refresh (2026-09-03): Fallow 3.22.0 scanned 4,361 files and 65,040
functions; `research/tail-inventory.md` records all 49 current functions above
cognitive 15, their hotspot positions, and their refactor/override verdicts.
The npm registry, installed binary, and lockfile all identify 3.22.0 as the
latest release; `.fallowrc.jsonc` uses its version-aligned local schema.

Final local evidence (2026-09-03): after synchronizing the branch to
`origin/main` at `53193e5a5e93a3231282eaead455f7d06a85ac4d`, Fallow analyzed
4,411 files and 67,646 functions with zero unwaived findings above cognitive
complexity 15. The 189-entry baseline matched exactly in three consecutive
runs against digest
`fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6`;
the diff audit reported zero introduced findings and 63 inherited-adjacent
findings; and the suppression inventory reported 207 across 114 files with
zero missing/stale reasons and no campaign additions. Browser QA round 7
recorded 47 accepted events, zero rejected events, zero dropped artifacts, and
an independent judge result with zero findings. The health lane is blocking in
CI and pre-push, with baseline argv and the blocking predicate covered by the
plan-contract and focused CLI tests. The refreshed full-coverage shard passed
all 159 repo-CLI test files with 3,093 passing tests and five skips; all eight
touched packages have also passed their full package handoff verification.

PR1 of the campaign (2026-07-30, calibration session): ceilings pinned in
`.fallowrc.jsonc` (`maxCognitive: 8`), law 23 added to
`standards/effect-laws-v1.md`, DECISIONS entry ratifying the ratchet mechanism,
`standards/fallow.health.regression-baseline.jsonc` generated and proven
(`--baseline` compare exits 0 clean / 1 on regression), suppression reasons
backfilled, `require-suppression-reason: error` enabled, fallow MCP added to
`.mcp.json`.

## Notes

- The dead-code campaign (`goals/fallow-zero-dead-code`) is the structural
  template: triage-first, config-only exception policy, 3-clean-runs promotion.
- Refactor worked examples:
  `goals/standards-remediation/ops/reports/{DA-2,SF-2}`.
- Execution routing (user directive): Codex implements (GPT-5.6 Sol, xhigh);
  Fable orchestrates/reviews.
- Revisit-6 is a recorded decision hook in the 2026-07-30 DECISIONS entry, not
  part of this packet's scope.
