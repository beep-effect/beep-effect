# Generated Standards Artifacts — Refresh Policy

Decision (2026-07-25, from the `epistemic-bitemporal-edge-core` closeout
reflection, todo #5): whole-repo generated artifacts under `standards/` are
refreshed **only in dedicated chore PRs**, never on feature branches.

## Scope

| Artifact | Regenerator | Character |
| --- | --- | --- |
| `standards/schema-catalog.generated.jsonc` | `bun run beep lint schema-catalog --write` | whole-repo snapshot; regen absorbs every package's drift |
| `standards/jsdoc-documentation.inventory.jsonc` | `bun run beep quality jsdoc-inventory` | whole-repo snapshot; regen absorbs every package's drift |
| `standards/jsdoc-documentation.inventory.md` | same lane | small totals file; updating it in a feature PR is fine |

Hand-maintained files (e.g. `standards/effect-laws.allowlist.jsonc`) are out of
scope — they are edited, not regenerated.

## The rule

- A feature branch must carry **only its own delta**. If `bun run beep yeet
  verify` and CI pass without regenerating a snapshot artifact, do not
  regenerate it — the gates on these artifacts are delta/ratchet-based, and
  staleness at `HEAD` is not gating.
- If a gate genuinely fails without a regen, stop: that means the artifact has
  become gating for unrelated drift. Land a dedicated
  `chore: refresh generated standards artifacts` PR from a clean `main`
  checkout first, then rebase the feature branch.

## Evidence

On the `epistemic-bitemporal-edge-core` branch (PR #452), mid-flight
regeneration produced a ~27,790-line `jsdoc-documentation.inventory.jsonc`
diff of which only 416 lines belonged to the branch, and a ~2,246-line
`schema-catalog.generated.jsonc` diff of which ~10 entries did. Both regens
were reverted; the full local proof and all 25 hosted checks passed without
them, proving the staleness is not gating
(`goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md`).

## Standing posture

Regen *tooling* (a single `beep quality regen-generated` operator command) was
evaluated and deliberately deferred: `goals/one-round-loop` C5 is `wont_fix`
until median PR CI round-trips exceed one (`goals/one-round-loop/ops/progress.json`).
A changed-files-scoped `jsdoc-inventory` refresh is the wished-for improvement
recorded in the reflection; adopt it there if that packet reopens.
