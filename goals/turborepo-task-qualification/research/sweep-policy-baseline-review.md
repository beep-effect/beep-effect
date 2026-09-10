# Integrate the inherited quality-sweep policy input

The operator requested that PR #1068 incorporate main and reach a mergeable
state while remaining in draft. Main PR #1083 added
`standards/lint-policy.sweeps.jsonc` to the inputs of
`//#lint:policy-fingerprint`. The ordinary main merge includes this change;
root `turbo.json` is byte-identical to imported main `44502c4711`.

The executable census still contains 1751 computations. The reviewed
[delta](./sweep-policy-baseline-delta.json) contains exactly one definition change:
the added policy input above. No computation, command, dependency edge, output,
cache flag, global configuration or other task setting changed.

Accept this inherited input addition in the legacy configuration baseline.
Binding the versioned sweep policy to the fingerprint task invalidates reuse
when that policy changes. This review grants no runtime qualification.

Retain the identity/types scope, `local-linux-x64-bun1.4.2` profile and
`qualification-v2` epoch. Both pilot computations keep `cache: false`; the
qualification ledger remains byte-identical. The qualification campaign and
historical runtime matrices remain paused and unchanged.
