# Standards Inventory Zero

## Status

Lifecycle: `active` — P0 in progress.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Drive every `standards/*.jsonc` file that enumerates violations to zero items —
`dual-arity.inventory.jsonc`, `schema-first.inventory.jsonc`,
`jsdoc-documentation.inventory.jsonc`, `knip.regression-baseline.jsonc`,
`effect-laws.allowlist.jsonc` — then tighten the gates so zero stays zero.
Posture: convert code aggressively; detector changes only for verified detector
bugs; every "justified/unconvertible" verdict is driver-challenged.

## Read this first

1. [SPEC.md](./SPEC.md) — normative: scope, fences, rule cards, verification
   matrix, stop conditions, DoD.
2. [PLAN.md](./PLAN.md) — phase table, burndown, wave manifests, driver loop.
3. [research/decisions.md](./research/decisions.md) — locked rulings (do not
   reopen without new evidence).
4. [ops/progress.json](./ops/progress.json) — live resumable state.

## Execution model

One Claude driver session orchestrates; codex:rescue background lanes do all
research/exploration/coding, one writer per package (D-D). Work lands as wave
commits on the `standards-remediation` branch pushed to a single draft umbrella
PR (D-B), merged only at zero.

## Relations

- Method prior art: `goals/repo-crispening-orchestration` (waves, one writer
  per package, ratchet flips, fixer contract).
- Supersedes the remaining ledger of: `goals/schema-first-zero-actionables`
  (its own DoD — zero *actionables* — was met; this packet takes the ledger to
  zero *entries*).
- Dogfoods: `goals/one-round-loop` (`beep ci local`).
