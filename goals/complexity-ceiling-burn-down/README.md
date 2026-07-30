# Complexity Ceiling Burn-Down

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Clear the cognitive->15 tail (~60 functions), promote the fallow health lane
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
6. [`research/tail-inventory.md`](./research/tail-inventory.md) - target list
   (snapshot; refresh in P0).

## Current Phase

P0 Research. Next concrete action: refresh the tail inventory from a live
`bun run fallow:health` run and record per-function triage verdicts.

## Latest Evidence

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
