# Retire ./scripts into beep CLI commands and a compiled beep binary for CI

## Status

Lifecycle: `active`

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

P1 Implement — in progress (lane `beep-effect-worktrees/scripts-to-beep-cli`, branch `goals/scripts-to-beep-cli`). Two PRs: PR 1 lands every replacement command, the slim compiled `bin-ci` entry and the binary publisher; PR 2 pins the first published binary, switches the workflows, deletes the CI shell and adds the tracked-shell law. Commands stay in `@beep/repo-cli` until `goals/beep-cli-composition` moves them.

## Latest Evidence

- 2026-11-06 grill session decisions D10, D11, D15 in [`explorations/pulumi-to-alchemy/DECISIONS.md`](../../explorations/pulumi-to-alchemy/DECISIONS.md).
- Consumer inventory of `scripts/` recorded in `SPEC.md` Target Surfaces.
- 2026-11-07 P0: compile probe (full CLI fails on eager DuckDB, slim CiOperational entry bundles 672 modules / 110 MB) and five decisions under [`decisions/`](./decisions/).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
