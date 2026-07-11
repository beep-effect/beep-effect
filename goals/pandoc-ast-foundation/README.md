# Pandoc AST Foundation

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

### Closeout reconciliation (2026-07-11)

`@beep/pandoc-ast` has been live on main at
`packages/foundation/modeling/pandoc-ast` since 2026-06-15, landed via direct
commit `d22d97bb29` ("feat(pandoc-ast): add foundation package"). That commit
predates the PR-only ruleset, so no PR exists; the yeet PR-mergeable gate is
grandfathered rather than retroactively enforced. The manifest phases had
drifted (P3 Close stayed `pending` after the work shipped); this reconciliation
flips P3 to `completed`, sets the packet to `completed-retained`, and adds the
closeout reflection.

## Mission

Graduate the first DOCX round-trip interop slice into a pure schema-first
`@beep/pandoc-ast` foundation package. The package models Pandoc JSON, maps the
supported Md-core profile to and from `@beep/md`, and records DOCX-origin gaps
as structured compatibility issues.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/pandoc-ast-foundation/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`../../explorations/docx-roundtrip-interop`](../../explorations/docx-roundtrip-interop/README.md) - graduated source exploration.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

All phases are complete. P0 research, P1 implementation, and P2 package-local
verification finished with the 2026-06-15 landing; P3 Close was reconciled
retroactively on 2026-07-11 with the closeout reflection in
[`history/reflections/`](./history/reflections/).

## Latest Evidence

2026-06-15 package-local proof:

- `bun run --cwd packages/foundation/modeling/pandoc-ast check`
- `bun run --cwd packages/foundation/modeling/pandoc-ast test`
- `bun run --cwd packages/foundation/modeling/pandoc-ast type-test`
- `bun run --cwd packages/foundation/modeling/pandoc-ast lint`
- `bun run --cwd packages/foundation/modeling/pandoc-ast docgen`
- `bun run --cwd packages/foundation/modeling/pandoc-ast build`
- `bun run --cwd packages/foundation/modeling/identity check`
- `bun run repo-exports:catalog`
- `bun run repo-exports:catalog:check`
- `bun run docgen:local --full`

## Notes

This packet intentionally stops before a Pandoc executable driver, generated
DOCX fixture pipeline, UI work, or patent-domain semantics. Those follow-ons
remain named in the graduated exploration map.
