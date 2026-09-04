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

P0 Research, P1 implementation, P2 verification, and P4 packet closeout are
complete locally. P3 is active while Yeet publishes and proves the exact pull
request head merge-ready. All 49 live Fallow 3.22.0 tail verdicts are executed:
30 real refactors and 19 review-dated cohesive-boundary overrides, with zero
ignore additions. Runtime-coverage CRAP and `fallow impact` are both deferred
with evidence.

The repository has evolved since the 2026-07-30 calibration. Per the 2026-09-03
user refresh, the latest-main total of 207 suppressions is the campaign's
no-growth comparator; the calibration total and original refreshed P0 total of
194 remain provenance rather than stop conditions. The final
committed-candidate baseline has 189 entries, all matched, with zero stale or
moved entries. The strict branch-local Fallow audit is green.

## Latest Evidence

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
