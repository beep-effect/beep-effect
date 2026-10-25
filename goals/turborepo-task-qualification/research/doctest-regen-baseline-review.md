# Cache baseline review: doctest task regeneration (markdown, schema-org)

Reviewed 2026-10-23 on branch `@slop/10-21-26` (dependency sweep: effect 4.0.5 to 4.0.6,
`@duckdb/node-api` 1.5.6 to 2.0.0, routine catalog refresh).

`bun run beep cache audit` reported 18 blocking findings for two subjects, `@beep/markdown` and
`@beep/schema-org`, nine task tuples each: configuration drift on `#build`, `#check`, `#docgen`,
`#lint`, `#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws` and `#test`, and unreviewed expansion
on `#doctest`.

## What changed

`bun run beep lint package-scripts --write` regenerated the scripts block of both manifests. The
generator's derived `doctest-sources` presence rule (`PackageScripts.schemas.ts`) now adds the
`doctest` task (`bun run beep:doctest`) and its `beep:doctest` implementation
(`BEEP_VITEST_DOCTEST=1 bunx vitest run`), and normalizes the key order of the block. 35 other
workspace manifests already carry `beep:doctest`; the root `doctest` task in `turbo.json` (cached, no
outputs, `dependsOn` `^transit` and `@beep/utils#transit`, env `BEEP_VITEST_DOCTEST`) is unchanged.

- `@beep/schema-org` was regenerated on this branch (27883aeca2) after a `main` merge.
- `@beep/markdown` drifted on `main` after #2157 made its sources satisfy the rule; this branch
  carries the byte-identical generator output because the publish cheap gate requires zero drifting
  manifests.

## Inputs that did not change

The `dependencies`, `devDependencies`, `peerDependencies` and `optionalDependencies` objects of both
manifests are identical to `origin/main` (jq-normalized diff is empty), so no task closure gains or
loses a node. No `turbo.json`, tsconfig or generated-config input changed for these subjects. Source
edits on this branch are ordinary task inputs, not configuration drift, and are outside this review.

## Decision

Record the two subjects' existing legacy posture, with `#doctest` recorded on the same posture as
the other task tuples. No qualification is granted and no other subject changes. Reversal: revert the
two manifests and these baseline entries, which reintroduces the `lint package-scripts` drift.
