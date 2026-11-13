# Retire ./scripts into beep CLI commands and a compiled beep binary for CI

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Retire ./scripts into beep CLI commands and a compiled beep binary for CI (graduated from explorations/pulumi-to-alchemy).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/scripts-to-beep-cli/GOAL.md
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

Closed: `completed-retained`, final #3027, the fifth goals-only re-final (merged
2026-11-09, `f0698392821`). #3022 (fourth re-final, merged 490332acbc) lost its
publish verdict to a plain git push (checkpoint `2026-11-09-fifth-refinal-after-raw-push`).
#2860 (d15ecf4ca61), #2902 (8224cf33a5), #2906 (5a842b4882), #2921 (17472a68ce), #2922
(2398f39133), #2961 (031fa9d4af) and #3022 are merged supporting PRs; the code work is
complete. #3027 verifies from hosted facts: 8 required checks green, 7 path-skipped, and no
review threads. The
[batch migration](../goal-closeout-hosted-verification/history/migration-2026-11-13.md)
adopted the legacy proposal.

## Latest Evidence

- 2026-11-06 grill session decisions D10, D11, D15 in [`explorations/pulumi-to-alchemy/DECISIONS.md`](../../explorations/pulumi-to-alchemy/DECISIONS.md).
- Consumer inventory of `scripts/` recorded in `SPEC.md` Target Surfaces.
- 2026-11-07 P0: compile probe (full CLI fails on eager DuckDB, slim CiOperational entry bundles 672 modules / 110 MB) and five decisions under [`decisions/`](./decisions/).
- 2026-11-07: #2860 merged (commands, policy data, bin-ci entry, publisher); #2902 merged (in-process coverage for the ten PR 1 files); #2906 opened (pinned binary cutover, CI shell deleted, #2850 cache-pilot scripts ported, tracked-shell-allowlist law, reflection `history/reflections/2026-11-07-claude.md`).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
