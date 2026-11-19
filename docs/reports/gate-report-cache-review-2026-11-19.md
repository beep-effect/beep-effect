# Cache review for the new `@beep/gate-report` package (2026-11-19)

Branch `feat/gate-report-core` (gate-report-core P1). Reviewer: Claude Fable 5.2 (goal driver).

`bun run beep cache audit` reports 8 blocking findings in one new subject, and the root subject
drifts:

- `@beep/gate-report`: `unreviewed-expansion` on `build`, `check`, `docgen`, `lint`,
  `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test`.
- `//`: `//#lint:policy-fingerprint` gains one input.

## Cause

`@beep/gate-report` is a new foundation modeling package created with
`bun run beep create-package` (`packages/foundation/modeling/gate-report`), so its tasks are new
subjects with no recorded configuration. It carries the generated library scripts block unchanged,
including the generated `check` that leads with the unbuilt-reference probe, and depends on
`@beep/schema`, `@beep/identity` and `effect`.

`bun run beep lint policy-fingerprint --write` added the package manifest to the inputs of
`//#lint:policy-fingerprint` in `turbo.json`, because the fingerprint covers every workspace
manifest. That one input line is the root drift.

## Decision

Record both subjects. No task command, output, environment entry or cache flag differs from the
generated library defaults, and no qualification is granted.
