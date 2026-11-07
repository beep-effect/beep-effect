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

P3 Yeet — PR 2 #2906 open: it switches every workflow to the pinned `beep` binary but keeps the seven transitional scripts that `heavy.yml@main` still calls (decision `2026-11-07-heavy-at-main-three-prs`). PR 1 #2860 merged 2026-11-07 (d15ecf4ca61) and published release `beep-ci-d15ecf4ca610`, which #2906 pins. Coverage unblocker #2902 merged (8224cf33a5). PR 3, opened once #2906's `heavy.yml` is the `@main` copy, deletes the transitional scripts and their allowlist entries and is the goal's final PR carrying `proposedCloseout`; `initiative.status` stays `active` until then.

## Latest Evidence

- 2026-11-06 grill session decisions D10, D11, D15 in [`explorations/pulumi-to-alchemy/DECISIONS.md`](../../explorations/pulumi-to-alchemy/DECISIONS.md).
- Consumer inventory of `scripts/` recorded in `SPEC.md` Target Surfaces.
- 2026-11-07 P0: compile probe (full CLI fails on eager DuckDB, slim CiOperational entry bundles 672 modules / 110 MB) and five decisions under [`decisions/`](./decisions/).
- 2026-11-07: #2860 merged (commands, policy data, bin-ci entry, publisher); #2902 merged (in-process coverage for the ten PR 1 files); #2906 opened (pinned binary cutover, CI shell deleted, #2850 cache-pilot scripts ported, tracked-shell-allowlist law, reflection `history/reflections/2026-11-07-claude.md`).

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
