# Cache baseline review: new package @beep/infra-ci-runners (2026-11-14)

Reviewer: Claude Opus 5.5 (`goals/infra-alchemy-rebuild-p5-ci-runners`). No qualification is granted.

`bun run beep cache audit` on this lane reports eight `unreviewed-expansion` findings, one per cached
computation of the new package: `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`,
`lint:laws` and `test`, plus `REVIEW configuration-source-drift: turbo.json`.

## `@beep/infra-ci-runners`

The package was bootstrapped with `bun run beep create-package infra-ci-runners --family tooling --kind infra
--dir-name ci-runners`, so its scripts block is the generated one, identical to `@beep/infra-cost-controls`.
Its tasks are the standard ones with the default inputs and outputs of the repo's Turbo pipeline; no task
sets an environment variable, an extra input or an output of its own. What a reader should know:

- `alchemy.run.ts` and `plan-check.ts` at the package root are owned by `tsconfig.json` and
  `tsconfig.test.json`, so they sit inside the `check` inputs; no Turbo task runs either.
- `src/internal/lambda/reaper.ts` is a Lambda entry Alchemy bundles at deploy time; no Turbo task bundles it.
- `test/support/Fakes.ts` registers recording fake providers and stub fleet services; `test` makes no
  network call and reads no credential, and `test/support/PersonalPlan.ts` is a recorded plan log with the
  stage renamed, so the result depends only on source inputs.
- Workspace dependencies `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, `@beep/identity`,
  `@beep/schema`; catalog dependencies `alchemy`, `@alchemy.run/aws`, `@alchemy.run/docker` (new catalog
  entry at the same `2.0.0-beta.87` as the other `@alchemy.run/*` pins), `@alchemy.run/test`,
  `@distilled.cloud/aws`, `@effect/platform-bun`, `effect`.

Recording the package adopts its computations as reviewed legacy settings. No task becomes newly qualified and
no exception row is added.

## Root subject `//`

`bun run beep lint policy-fingerprint --write` added `packages/tooling/infra/ci-runners/package.json` to the
generated `inputs` of `//#lint:policy-fingerprint` in `turbo.json` and to
`standards/policy-tools.fingerprint.json`, as for every new workspace package. The root `package.json` gains one
catalog line (`@alchemy.run/docker`). No task was added or removed, and no command, output, environment or
dependency edge changed. Scope, profile and epoch are unchanged.
