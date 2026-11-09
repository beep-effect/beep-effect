# Cache review for the lint Turbo input wave

Reviewed against main `4b69a5e4b1fd` on branch `perf/lint-turbo-inputs` (PR A
of the 2026-11-09 lint efficiency plan). Reviewer: Claude Opus 5.5
(perf/lint-turbo-inputs, PR A of the lint efficiency plan).

`bun run beep cache audit` reports 218 configuration-drift findings: 21 root
(`//`) tasks and the `lint:laws` task of 197 workspace packages. It also reports
non-blocking `configuration-source-drift` on `turbo.json`. Every drift comes
from a `turbo.json` input change made in this PR. No other configuration changed.

## `//` (root)

- `//#lint:policy-fingerprint` (generated): adds `packages/**/package.json` and
  the eight `!**/<dir>/**/package.json` negations (`.beep`, `.next`, `.turbo`,
  `build`, `coverage`, `dist`, `node_modules`, `storybook-static`). The check
  task hashes every input of the seals it verifies. The new
  `@beep/repo-cli#lint:policy-fingerprint:lint-laws` route carries the
  workspace-manifest walk, so this check task gets the walk too. The inputs
  only grow.
- `//#fallow:boundaries:advisory`, `//#fallow:boundaries:config-check`,
  `//#fallow:dead-code:check`, `//#fallow:fix-preview:advisory`,
  `//#fallow:flags:advisory`, `//#fallow:health:advisory`,
  `//#fallow:health:check`, `//#fallow:security:advisory`,
  `//#jsdoc:inventory:check`, `//#lint:allowlist`,
  `//#lint:deprecated-imports`, `//#lint:identity-registry`,
  `//#lint:jsdoc:root`, `//#lint:schema-catalog`, `//#lint:schema-first`,
  `//#lint:tsgo-rules`: each adds the negation
  `!packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-*/**`.
  These directories are gitignored Vitest runtime residue. None of these
  scanners reads them: they use git-visible discovery, dot-free globs, or both.
  The new residue probe in `root-tasks-turbo-inputs.test.ts` plants residue
  files and asserts that each hash stays the same. Its positive control,
  `//#lint:effect-vitest`, does see the change.
- `//#lint:schema-tag-idioms`, `//#lint:jsdoc-module-tags`: the same residue
  negation, plus `!{apps,packages,tooling}/**/docs/modules/**`. That path holds
  generated docgen output, and both scanners skip it. The negation is scoped so
  that it does not cover the re-included tracked `goals/**/docs` paths.
- `//#lint:effect-imports`: adds the residue negation plus
  `!**/coverage/**`, `!**/storybook-static/**` and `!**/.next/**`. The scanner
  change in the same PR adds `coverage` and `storybook-static` to
  `EXCLUDED_DIRECTORY_GLOBS` and `PRUNED_DIRECTORY_NAMES`. Its code walk uses
  `dot: false`, so it never enters `.next` or `.runtime-*`. Measured before
  the change, a planted `coverage/**/*.js` file with a root `effect` import was
  scanned and rewritten. After the change it is skipped, and output on the
  clean tree is unchanged. `src-tauri/target` stays an input because the walk
  can read it.
- `//#lint:effect-imports-markdown`: adds the same four negations as
  `//#lint:effect-imports` (the residue family, `!**/coverage/**`,
  `!**/storybook-static/**` and `!**/.next/**`). The Markdown walk differs
  from the code walk: it uses `dot: true` but keeps only git-visible paths, so
  a gitignored `.next`, `coverage`, `storybook-static` or `.runtime-*` tree is
  never read on a git checkout. Its foundation-source walk uses `dot: false`
  with the same pruned directory names. Markdown mode output on the clean tree
  is unchanged before and after the scanner change.

## `lint:laws` (197 packages)

Every package `lint:laws` task drops `$TURBO_ROOT$/packages/**/package.json`
and its eight `!$TURBO_ROOT$/**/<dir>/**/package.json` negations. The task
still depends on `@beep/repo-cli#lint:policy-fingerprint:lint-laws`. That seal
now hashes the same glob and the same negations, through the
`PackageTestImports.collectPackageSourceRoots` route in `PolicyRootFiles.ts`.
A seal hash change reaches every dependent task hash, so any workspace manifest
edit still invalidates every `lint:laws` result. The invalidation is unchanged:
Turbo now expands the glob once on the seal instead of about 200 times.
`laws-turbo-inputs.test.ts` covers this: an upstream or unrelated manifest
edit still changes the consumer `lint:laws` hash through the seal.

Subjects: `//` and the 197 packages named in the audit's
`<package>#lint:laws` findings, plus `@beep/eyecite`. That package sets
`lint:laws` to `cache: false` in its package `turbo.json`, so the audit does
not report it as blocking drift. Its projected task inputs still change by the
same removal, and the baseline command names it as changed.

## Scope

This review adds no qualification and no exception rows. It changes no cache
writer credentials, artifact outputs or trust policy. Scope
(`@beep/identity#lint`, `@beep/types#lint`), profile `local-linux-x64-bun1.4.4`
and epoch `qualification-v3` are copied unchanged from
`standards/cache-qualification-baseline.json`. Reviews of other subjects carry
forward.
