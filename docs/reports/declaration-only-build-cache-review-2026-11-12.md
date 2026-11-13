# Cache review for the declaration-only build

Branch `feat/declaration-only-build` (goal `declaration-only-builds`, PR 2),
reviewed on top of `f7e320d8400`. Reviewer: Claude Opus 5.5 (PR 2 implementer).

`bun run beep cache audit` reports 1,571 blocking `configuration-drift`
findings across 189 subjects, plus the non-blocking
`configuration-source-drift` on `turbo.json`. No root (`//`) task drifts. By
task: 188 `#build`, 181 each of `#check`, `#docgen`, `#lint:deprecated-apis`,
`#lint:jsdoc`, `#lint:laws` and `#test`, 177 `#lint`, 84 `#test:property` and
36 `#doctest`. Two changes in this lane explain every finding.

## `turbo.json` `build.outputs` (188 `#build` subjects)

The root `build` task drops `**/node_modules/.tmp/*.tsbuildinfo` from its
outputs. Turbo hashes a task's `outputs`, so every package `build` that inherits
the root definition changes configuration. Eight subjects drift only here,
because their manifests did not change: `@beep/beep-effect-web`,
`@beep/lejeune-bolt-workbench`, `@beep/oip-web`, `@beep/professional-desktop`,
`@beep/semantica`, `@beep/storybook`, `@beep/todox` and
`@beep/trustgraph-workbench`.

The glob is the pre-#1874 incremental-state location. `tsconfig.base.json`
keeps `tsBuildInfoFile` at `${configDir}/dist/tsconfig.tsbuildinfo`, inside the
`dist/**` output, and no package build writes under `node_modules/.tmp`: the
root `tsconfig.json`, `tsconfig.packages.json` and Storybook's
`tsconfig.stories.json` still keep build info there, but none of them runs in a
package `build` task (Storybook's `beep:build` is `storybook build`). The glob
only restored stale build info into fresh checkouts. Decision
`goals/declaration-only-builds/decisions/2026-11-10-tmp-glob-rides-pr-2` moved
its removal into this PR so the repository rebuilds from cold once.

## Regenerated scripts blocks (181 subjects, every cached task)

`bun run beep lint package-scripts --write` rewrote 182 workspace manifests:
`beep:build` became `tsrs -p tsconfig.json --emitDeclarationOnly` (or
`bun run codegen && tsrs -p tsconfig.json --emitDeclarationOnly` for
`@beep/repo-configs`), and the retired `babel` script key left 169 of them.
The writer also re-sorts each written block into its canonical tier order. A
package's scripts digest is part of every one of its cached task
configurations, so all of a written package's cached tasks drift. The 182nd
manifest, `@beep/eyecite`, has only uncached tasks, which the audit does not
assess (see below).

The task commands (`bun run beep:build` and so on), cache flags, inputs,
environment keys and outputs of these tasks are unchanged. The build writes a
subset of its previous outputs: `.d.ts`, `.d.ts.map` and the build info, without
`*.js` and `*.js.map`, all under the unchanged `dist/**`.

## Uncached computations and the root source digest

Recording the baseline also re-records what the audit does not assess. Of the
2,304 computations whose projection changes, 1,571 are the cached tasks above;
the other 733 are uncached tasks of the same written packages (`coverage`,
`lint:fix`, `package-test-typecheck`, `test:integration` and similar) whose
command digest moves with the scripts block. Two uncached `#build` tasks,
`@beep/eyecite#build` and `@beep/repo-configs#build`, also lose the output glob.
Every task of `@beep/eyecite` is uncached (its `turbo.json` sets `cache: false`),
so the audit reports nothing for it, but its command digests change and the
review covers it. All of these stay uncached.

`//` changes only through the `turbo.json` source digest
(`configuration-source-drift`, `e7c7d83c…` to `5e92298…`), from the output glob
and the seal rows below. No root (`//#…`) computation changes, and the global
configuration is unchanged.

## Also in this lane, without audit drift

- `bun run beep lint policy-fingerprint --write` adds
  `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts`
  to six more `@beep/repo-cli#lint:policy-fingerprint:*` seal rows
  (`quality-bun-audit`, `quality-changeset-graph`, `quality-jsdoc-inventory`,
  `quality-jsdoc-module-tags`, `quality-jsdoc-ratchet`, `quality-tsgo-rules`;
  `lint-package-scripts` already listed it), because the census
  build-equivalence mode now imports the generated build command from it. The
  seal inputs only grow, and the audit reports no drift for these rows.
- `@babel/cli`, `@babel/core` and `babel-plugin-annotate-pure-calls` left the
  root `devDependencies` and the catalog, so
  `standards/root-package.projection.generated.json` (a global input) changes
  and re-keys every task hash once. It changes no task configuration.

No command, cache flag, environment key, epoch or qualification scope changes,
and no qualification is granted.
