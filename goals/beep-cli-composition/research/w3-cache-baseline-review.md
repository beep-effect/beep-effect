# Cache baseline review: W3 @beep/repo-cli-kit (2026-11-03)

Reviewer: Claude Opus 5.5 (W3 lane, `refactor/beep-cli-w3-repo-cli-kit`).

W3 creates `@beep/repo-cli-kit` with `bun run beep create-package` and moves
repo-cli's CLI-kit substrate into it (`src/internal/{cli,schema,process,
artifacts,systemd,stats,duckdb,package-scripts,tsmorph}` and the five root
modules), with their tests. No qualification is granted.

## `@beep/repo-cli-kit` (new subject)

Its tasks (`build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`,
`lint:jsdoc`, `lint:laws`, `test`) come from the generated scripts block and
per-package `turbo.json` that `create-package` emits. They are the standard
tooling-library task set: the same inputs, outputs and `passThroughEnv` as
sibling libraries such as `@beep/repo-utils`. No custom cache flag.

## `@beep/repo-cli`

`package.json` adds the `@beep/repo-cli-kit` workspace dependency;
`tsconfig-sync` added the project reference. The `build`, `check`, `doctest`,
`lint:deprecated-apis`, `test` and `test:property` tasks gain the
`@beep/repo-cli-kit#build` upstream edge and lose the moved source files from
their own inputs. No flag, output or environment change.

## `//` (root)

`bun run beep lint policy-fingerprint --write` regenerated the seal inputs in
`turbo.json` and `standards/policy-tools.fingerprint.json` so the policy
seals name the moved modules at their new paths; `tsconfig-sync` added the
root alias and project reference. `turbo.json` is the only configuration
source that changed.
