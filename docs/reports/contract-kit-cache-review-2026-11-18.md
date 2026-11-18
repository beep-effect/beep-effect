# Cache review for the new `@beep/contract-kit` package (2026-11-18)

Branch `claude/model-first-standard-scaffolder` (model-first-standard P1 step 2).
Reviewer: Claude Opus 5.5 (scaffolder lane).

`bun run beep quality cache-policy` reports 9 blocking findings in two subjects:

- `@beep/contract-kit`: `unreviewed-expansion` on `build`, `check`, `docgen`,
  `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test`.
- `//`: `configuration-drift` on `//#lint:policy-fingerprint`, with the
  `configuration-source-drift` review row on `turbo.json`.

## Cause

`@beep/contract-kit` is a new foundation modeling package created with
`bun run beep create-package` (`packages/foundation/modeling/contract-kit`), so
its tasks are new subjects with no recorded configuration. It carries the
generated library scripts block unchanged and depends on `@alchemy.run/domain`,
`@beep/identity` and `effect`.

`bun run beep lint policy-fingerprint --write` added
`packages/foundation/modeling/contract-kit/package.json` to the inputs of
`//#lint:policy-fingerprint` in `turbo.json`, because the fingerprint covers every
workspace manifest. That one input line is the root drift.

## Judgement

The new subject's tasks use the root task definitions with no package
`turbo.json` override: no custom command, cache flag, input, output or
environment. The root change is one added input path, which only makes the
fingerprint task rerun when the new manifest changes. Recording both grants no
qualification.

## Reversal

Delete the package (`bun run beep delete-package contract-kit`), rerun
`bun run beep lint policy-fingerprint --write`, and re-record `//` and remove the
`@beep/contract-kit` subject file.
