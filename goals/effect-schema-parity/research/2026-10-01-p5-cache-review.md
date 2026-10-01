# P5 cache baseline review (2026-10-01)

The P5 statics retirement removed the last `@beep/schema` import from two
packages, so their manifests drop the `@beep/schema` workspace dependency
(`bun run beep quality knip` reported both as unused):

- `@beep/architecture-lab-use-cases` (`packages/architecture-lab/use-cases`)
- `@beep/workspace-use-cases` (`packages/workspace/use-cases`)

`bun run beep tsconfig-sync` dropped the matching project reference from each
package's `tsconfig.json` and `tsconfig.check.json`.

## What the re-record changes

Compared with the baseline on `main`, the re-recorded
`standards/cache-qualification-baseline.json` changes 19 projection nodes and
one projection source. No node is added or removed, and no cache policy
changes.

- **Dependency closure (18 nodes).** Nine tasks per package record one
  upstream package fewer (`dependencies`): `audit`, `build`, `check`,
  `coverage`, `lint:deprecated-apis`, `package-test-typecheck`, `test`,
  `test:integration` and `test:property`, for each of the two packages above.
- **`//#lint:typos` configuration (1 node).** The recorded inputs now include
  `!packages/drivers/venice-ai/test/fixtures/swagger.json`. That exclusion is
  already in `turbo.json` on `main`; the committed baseline predated it.
- **Projection source.** The recorded `turbo.json` digest moves from the stale
  `00a20784…` to `6503a298…`, the digest of `turbo.json` as it stands on
  `main`.

The last two items are drift the baseline carried before this PR; the
re-record captures the current configuration, it does not change it. Task
inputs, outputs, environment keys and cache policy are otherwise unchanged.

The baseline is re-recorded with `cache baseline --request`. The request is
kept outside the repo, and its scope, profile and epoch are copied from the
committed baseline. `bun run beep cache audit` then reports 0 blocking
findings.
