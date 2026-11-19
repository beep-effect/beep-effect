# Cache review for the `@slop/11-18-26` cleanup branch

Reviewed on `@slop/11-18-26` with `main` @ a4ce5e8b0c9 merged in. Reviewer: Claude Opus 5.5
(slop-cleanup closeout lane). No command, cache flag, output or environment variable changed;
no qualification is granted.

## Audit

`bun run beep cache audit` reports 13 blocking `configuration-drift` findings in four subjects:

| Subject | Drifted computations |
| --- | --- |
| `//` | `check:model-first-slices` |
| `@beep/alchemy-aws-extras` | `build`, `check`, `lint:deprecated-apis`, `test` |
| `@beep/alchemy-postgres` | `build`, `check`, `lint:deprecated-apis`, `test` |
| `@beep/infra-github` | `build`, `check`, `lint:deprecated-apis`, `test` |

The other 25 `REVIEW configuration-source-drift` lines are the `$schema` URL bump from
`v2-11-11` to `v2-11-13` in every `turbo.json` that came with the Turbo update on this branch.
They are review notes, not blocking findings, and the URL is not a task input.

## `//#check:model-first-slices`

The prototype now links `@beep/effect-drizzle` as source
(`scratchpad/model-first-slices/package.json`, `link:../../packages/ecosystem/effect-drizzle`),
and its host store tables are derived from row schemas through that package and `@beep/pglite`.
The task's `inputs` in the root `turbo.json` gain the manifests and sources of those two
packages:

- `packages/ecosystem/effect-drizzle/package.json`, `packages/ecosystem/effect-drizzle/src/**`
- `packages/drivers/pglite/package.json`, `packages/drivers/pglite/src/**`

The check reads these files, so they belong in the key. `docs/runbooks/turbo-cache-inputs.md`
records the new inputs in the task's row. The command, `cache: true`, `outputs: []` and the
absent `env` are unchanged.

## `@beep/alchemy-aws-extras`, `@beep/alchemy-postgres`, `@beep/infra-github`

Each package's tests now compute their registration-time values (an opt-in `Config` flag, a
per-run random suffix, a decoded ruleset capture) with `atRegistration` from the new
`@beep/test-utils/Registration` module instead of calling `Effect.runSync` inline. Each package
therefore gains:

- `"@beep/test-utils": "workspace:^"` in `devDependencies` (`package.json`);
- a project reference to `packages/tooling/test-kit/test-utils/tsconfig.json` in
  `tsconfig.json`, `tsconfig.check.json` and `tsconfig.test.json`.

The manifest and tsconfig bytes are part of each cached computation's reviewed configuration,
so all four tasks drift on them. The scripts block, task commands, outputs and environment are
unchanged.

## Request

`docs/reports/test-utils-registration-cache-request-2026-11-18.json` names exactly these four
subjects, binds `previous` to the exact current text of each subject file, and copies `scope`,
`profile` and `epoch` from `standards/cache-baseline/_root.json`.
