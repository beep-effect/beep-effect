# Canonical Proof Reconciliation

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Bring the CLI accepted proof and the eight live slices onto the amended grammar: manifest + architecture-lab first, then one codemod PR per slice proven by an audit baseline delta

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/canonical-proof-reconciliation/GOAL.md
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

P0 Research — not started.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-08-30 from [`explorations/v3-consistency-audit`](../../explorations/v3-consistency-audit/README.md). Requires
  `architecture/slice-audit` (`goals/slice-topology-audit`): do not open a
  codemod PR before the audit command, its baseline and its required check
  exist on `main`.
- The migration is a baseline delta per PR, never a big-bang rename; 724
  deep named-import sites repo-wide must be rewritten by the same codemod
  that renames the symbol.
- effect v4 `Rpc.make` takes `error:`, not `failure:` — `Failure` is only the
  member name. The `Contract` kit is a sibling of `@beep/schema/Fn`.
