# Cache review for check once

Goal `declaration-only-builds`, PR 3, reviewed on top of `d8326d55935`.
Reviewer: Claude Opus 5.5 (PR 3 implementer).

Against the baseline on `d8326d55935`, `bun run beep cache audit` reports
1,548 blocking `configuration-drift` findings across 181 subjects, plus
non-blocking `configuration-source-drift` on the root `turbo.json` and on 19
package `turbo.json` files. No root (`//`) task drifts. By task: 181 `#check`,
179 each of `#docgen`, `#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws` and
`#test`, 178 `#build`, 175 `#lint`, 84 `#test:property` and 35 `#doctest`. Two
changes in this lane explain every finding.

## Regenerated `beep:check` (179 subjects, every cached task)

`bun run beep lint package-scripts --write` rewrote 180 workspace manifests:
the leading `tsrs -p tsconfig.check.json` of each declaration-only package's
`beep:check` became `tsrs -p tsconfig.json --emitDeclarationOnly`, the
package's own build program. Compiler flags on that first segment are carried
over in the same order, so `@beep/repo-cli`'s check now opens with
`tsrs -p tsconfig.json --emitDeclarationOnly --checkerCostCache source.tsrs-cost-cache`;
every later segment stayed as written. A package's scripts digest is part of
every one of its cached task configurations, so every cached task of a written
package drifts. Of the 180, `@beep/eyecite` has only uncached tasks (its
`turbo.json` sets `cache: false`), which the audit does not assess, and
`@beep/repo-configs` builds uncached, so its `#build` is absent from the count.

The task commands (`bun run beep:check` and so on), cache flags, inputs,
environment keys and outputs of these tasks are unchanged. The check task
still declares `outputs: []`: under Turbo its own `build` runs first in the same
invocation, so the check's build step writes nothing and a check cache hit has
nothing to restore. The `--checkerCostCache` files are machine-local and
gitignored, as before.

## `turbo.json` `check.dependsOn` (181 `#check` subjects)

The root `check` task now depends on `["^build", "build"]`. Turbo hashes a
task's `dependsOn`, so every package `check` that inherits the root definition
changes configuration: the 179 written packages above and two
declaration-only packages whose manifests did not change, which drift on
`#check` only: `@beep/effect-drizzle` and `@beep/markdown`, the two
`ownSourceCheckOverrides` rows, whose `tsconfig.check.json` adds `scripts` to
`include` and so keeps the no-emit check first.

The 19 packages whose `beep:build` is not the declaration-only command (eight
bundler apps, ten no-emit apps and labs, and `@beep/infra`) gained an explicit
`tasks.check.dependsOn: ["^build"]` in their own `turbo.json`
(`@beep/storybook` keeps its two extra `#check` edges and drops
`$TURBO_EXTENDS$`). Their resolved `check` configuration is the one they had
before, so the audit reports only `configuration-source-drift` on those files,
with no blocking drift: `bunx turbo run check --dry=json` lists no own `#build`
for `@beep/oip-web`, `@beep/storybook`, `@beep/infra` or `@beep/docket-intake`,
and lists `@beep/types#build` for `@beep/types`.

## Uncached computations and source digests

Recording the baseline also re-records what the audit does not assess: the
uncached tasks of the written packages (`coverage`, `lint:fix`,
`package-test-typecheck`, `test:integration` and similar), whose command digest
moves with the scripts block, and every task of `@beep/eyecite`. All of them
stay uncached. `//` changes only through the root `turbo.json` source digest;
no root (`//#…`) computation changes, and the global configuration is
unchanged.

The lane recorded this review in two steps, the second after `@beep/repo-cli`
joined the rewrite; the second record restamps every subject of the first, so
one review covers the PR.

No command, cache flag, environment key, epoch or qualification scope changes,
and no qualification is granted.
