# Cache review for the gate record and gate run libraries (2026-11-19)

Branch `feat/gate-report-services` (gate-report-core P2). Reviewer: Claude Fable 5.2 (goal driver).

`bun run beep cache audit` reports 23 blocking findings in four subjects:

- `@beep/repo-gate-record` and `@beep/repo-gate-run`: `unreviewed-expansion` on `build`, `check`,
  `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test` of each.
- `@beep/repo-cli`: `configuration-drift` on `build`, `check`, `doctest`, `lint:deprecated-apis`,
  `test` and `test:property`.
- `//`: `configuration-drift` on `//#lint:policy-fingerprint`, with the review row on `turbo.json`.

## Cause

The two libraries are new tooling/library packages created with `bun run beep create-package`, so
their tasks are new subjects with no recorded configuration. Each carries the generated library
scripts block unchanged.

`@beep/repo-cli` now depends on `@beep/repo-gate-run`: the Yeet issue parser consumes the
TypeScript diagnostic parser that moved into the library, and the check probe takes its
build-closure command from it. The new dependency and its tsconfig references change the
configuration of the six repo CLI tasks that hash them.

`bun run beep lint policy-fingerprint --write` added the two package manifests, and the library
leaves the repo CLI's policy tools now import, to the generated input lists in `turbo.json`. Those
input lines are the root drift.

## Decision

Record all four subjects. No task command, output, environment entry or cache flag differs from
the generated defaults, and no qualification is granted.
