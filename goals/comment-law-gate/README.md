# Comment Law Gate

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Stop comment inflow: one scanner, a merge-base growth check, a clean-scope lock, an oxlint rule, the /delete-comment skill and a package decisions home.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/comment-law-gate/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P4 Close. #3467 (scanner, lock, oxlint rule, advisory) and #3468 (package decisions home) landed; the final PR adds the strip and /delete-comment, template and law-text changes, the AGENTS line and turns the law blocking.

## Latest Evidence

[`history/2026-11-22-scanner-replay-and-parity.md`](./history/2026-11-22-scanner-replay-and-parity.md): the oxlint rule and the scanner agree on 57,854 of 57,854 findings; 67 of the last 72 in-scope main commits would fail, with no false positive on a directive, licence or exported JSDoc.

## Notes

Evidence and the four-goal map: [`explorations/comment-law/MAP.md`](../../explorations/comment-law/MAP.md).
