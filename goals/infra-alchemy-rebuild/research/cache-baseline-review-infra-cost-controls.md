# Cache baseline review: new package @beep/infra-cost-controls (2026-11-14)

Reviewer: Claude Opus 5.5 (`goals/infra-alchemy-rebuild-p3-cost-controls`). No qualification is granted.

`bun run beep quality cache-policy` on this lane reports eight `unreviewed-expansion` findings, one per cached
computation of the new package: `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`,
`lint:laws` and `test`, plus `configuration-drift` on `//#lint:policy-fingerprint` with
`REVIEW configuration-source-drift: turbo.json`.

## `@beep/infra-cost-controls`

The package was bootstrapped with `bun run beep create-package infra-cost-controls --family tooling --kind infra
--dir-name cost-controls`, so its scripts block is the generated one, identical to every tooling package's
(`@beep/alchemy-aws-extras` included). Its tasks are the standard ones with the default inputs and outputs of
the repo's Turbo pipeline; no task sets an environment variable, an extra input or an output of its own. The
package adds three things a reader should know:

- `alchemy.run.ts` at the package root, owned by `tsconfig.test.json` and therefore inside the `check` inputs;
  it imports only package source and the shared state-store declaration and is never run by a Turbo task.
- `test/support/FakeAws.ts`, a hermetic in-memory AWS behind an effect `HttpClient`: `test` makes no network
  call and reads no credential, so its result depends only on its source inputs.
- Workspace dependencies `@beep/alchemy-aws-extras`, `@beep/identity`, `@beep/schema`, and catalog
  dependencies `alchemy`, `@alchemy.run/aws`, `@alchemy.run/test`; all are already cached subjects or pinned
  catalog entries.

Recording the package adopts its computations as reviewed legacy settings. No task becomes newly qualified and
no exception row is added.

## Root subject `//`

`bun run beep lint policy-fingerprint --write` added the new manifest,
`packages/tooling/infra/cost-controls/package.json`, to the generated `inputs` of `//#lint:policy-fingerprint`
in `turbo.json` and to `standards/policy-tools.fingerprint.json`, as it does for every new workspace package.
That one input-list line is the whole root change: no task was added or removed, and no command, output,
environment or dependency edge changed. Scope, profile and epoch are unchanged.
