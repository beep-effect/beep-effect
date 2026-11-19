# Cache review for the csv and xlsx modeling packages (2026-11-19)

Branch `feat/xlsx-and-csv-foundation-modeling`. Reviewer: Claude Fable 5.2 (csv and xlsx lane).

`bun run beep cache audit` reports 19 blocking findings in three subjects:

- `@beep/csv` and `@beep/xlsx`: `unreviewed-expansion` on `build`, `check`, `docgen`, `doctest`,
  `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test` of each.
- `//`: `configuration-drift` on `//#lint:policy-fingerprint`, with the review row on `turbo.json`.

## Cause

The two packages are new foundation modeling packages created with
`bun run beep create-package`, so their tasks are new subjects with no recorded configuration.
Each carries the generated scripts block, which `bun run beep lint package-scripts --check`
confirms, and has no per-package `turbo.json`.

`bun run beep lint policy-fingerprint --write` added the two package manifests to the generated
input list in `turbo.json`. Those two input lines are the root drift.

## Decision

Record all three subjects. No task command, output, environment entry or cache flag differs from
the generated defaults, and no qualification is granted.
