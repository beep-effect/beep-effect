# Accept the empty `@beep/ciops#build` outputs declaration

PR #1180 (root quality sweep) adds `apps/labs/ciops/turbo.json` declaring
`build.outputs: []`, mirroring the sibling typecheck-only lab
`apps/labs/api-docs`. `@beep/ciops` builds with `tsgo --noEmit`, so turbo's
`WARNING no output files found for task @beep/ciops#build` on every
`bun run build` was noise from an undeclared output contract, not a missing
artifact.

The reviewed baseline recorded `@beep/ciops#build` with the inherited default
outputs, so `beep quality cache-policy` now reports `configuration-drift` for
that one computation. Every other `configuration-source-drift` row is the
same file set re-hashed after the sweep merged main; no command, dependency
edge, cache flag, or global configuration changed.

Accept the empty outputs declaration in the legacy configuration baseline.
This review grants no runtime qualification. Retain the identity/types scope,
`local-linux-x64-bun1.4.2` profile and `qualification-v2` epoch; the
qualification ledger is untouched.
