# Standards Inventory Zero

## Status

Lifecycle: `completed-retained` — merged 2026-07-08 via PR
[#326](https://github.com/beep-effect/beep-effect/pull/326) (squash
`705647b8d0`), all 17 required ruleset checks green.

Final state: dual-arity `entries: []`; schema-first gate green with 4
driver-verified exceptions; jsdoc all six tracked totals 0; knip baseline
empty; effect-laws allowlist 6 justified compound-component idioms. ~24
detector corrections landed with fixture pairs (rulings R1–R26). Landing
resolved three upstream main merges (#337/#338 security, #334 duckdb
effect-sql, #335 fcRuns relocation). Reflection:
[`history/reflections/2026-07-08-claude.md`](./history/reflections/2026-07-08-claude.md).

Deferred (optional hardening): P8 repo-wide `ENFORCED_ROOTS` expansion and
`allowlist`→in-code exclusion flips — the committed baselines are already
zeroed, so fail-on-growth-from-zero is the effective enforcement.

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
