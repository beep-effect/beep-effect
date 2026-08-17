---
"@beep/repo-cli": patch
---

Yeet's pre-push proof now runs the hosted lane bodies verbatim instead of cousin root
commands, so a local green means what a hosted green means (ship-velocity B1).

Five lanes in the pre-push collector changed from root aggregates to `beep ci lane`
dispatches carrying the PR shape `check.yml` passes its matrix jobs: `quality:lint` and the
new `quality:lint-policy` replace `bun run lint`, `quality:check` replaces `bun run check`,
and `quality:test-unit` + `quality:test-integration` replace the single unscoped
`bun run test`. All five come from one builder shared with `beep ci local`, so the two local
replay paths cannot drift from each other or from the workflow.

Env posture stays local on purpose: this makes the *command* identical, not the environment.
PR-posture env (`CI=true`, blank secrets, cache flags) belongs to the later `--ci-parity`
tier.

Two lanes were taking their scope from ambient environment rather than from argv, which would
have made the argv parity cosmetic. `beep ci lane lint-policy` now passes `--full` so a local
replay scans the same repo-wide surface the required Lint Policy context does, instead of
silently falling back to changed-file scope off `CI` (hosted behavior is unchanged — it
already forced the full sweep). Because the affected-scoped Check lane suppresses the two
repo-wide tsgo extras that root `bun run check` carried, those extras stay in the local proof
as `quality:check:tsgo-tests` and `quality:check:tsgo-smoke` rather than disappearing with the
root command; they are the only gate on Effect tsgo diagnostics in test files.

`beep ci lane` also applies the same Turbo env hygiene the root quality runner does, so a lane
body that shells out to Turbo cannot leave a killed run's terminal in mouse-capture mode or
pass an unresolved `op://` token reference through as a literal value.
