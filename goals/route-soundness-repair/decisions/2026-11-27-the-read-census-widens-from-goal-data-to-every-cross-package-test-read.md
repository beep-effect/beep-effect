---
title: "The read census widens from goal data to every cross-package test read"
date: 2026-11-27
lane: "fix/route-soundness-cross-package-reads"
reversal: "Revert this PR's squash commit: the cross-package census, the nine turbo.json changes and the three CoverageScope rows go, and the cache baseline returns to its previous digests."
---

ROUT-03 checked only goal and exploration paths, but the same hole exists for package-owned files. On origin/main a change to a `packages/_internal/db-admin/drizzle` migration selected only `@beep/db-admin`'s integration tasks, while integration and pglite tests in six server packages replay that folder by relative path. `#3608` fixed one instance by hand, the law-practice use-cases fixtures (ROUT-09). The driver ruled that the defect be fixed now, before slice 12, rather than deferred.

The new `cross-package-read-census.test.ts` applies #3608's rule to every test source. A string literal of the form `../…`, outside an import or export statement, is resolved against the test file. If it lands in another workspace package's tracked files, two checks apply:
- every such file is an input of each test task the reader package has a script for (`test`, `test:integration`, `test:integration:parallel`), with `!` exclusions honoured;
- for a read outside `test/integration/`, CoverageScope's affected plan selects the reader or plans a full run.

The turbo-input helpers move to `test/support/TurboTestInputs.ts`, which both censuses share.

**Boundary.** Root-anchored bare literals such as `path.join(root, "packages/…")` are not counted. On origin/main, 170 of them resolve to tracked files in another package. Almost all are classifier rows, synthetic temp-tree paths, assertion messages or tailwind source maps, chiefly in repo tooling tests, so they cannot be told apart from reads by their shape. Repo-cli's real repository reads stay declared by hand in its `turbo.json` (`packages/_internal/db-admin/**`, `packages/architecture-lab/**` and the rest). Relative reads are always resolved against the test file, so they are counted without exception.

**Changes.**
- Five server packages get their first `turbo.json`, declaring `drizzle/**` on every test task they run.
- law-practice-server adds `drizzle/**` and the domain claim-element fixtures.
- repo-cli adds the identity package registry and law-practice-server's `vitest.shards.json`.
- github-reporting and ci-runners declare the source trees their tests read.
- CoverageScope adds documents-server to the drizzle readers. Its coverage runs `test/*.pglite.test.ts`, so the old `quality-tasks.test.ts` expectation that excluded it was wrong.
- CoverageScope maps the domain claim-element fixtures to law-practice-server, and `vitest.shards.json` to repo-cli.

**Readings.**
- On the pre-change tree the census fails both checks.
- After it, a migration-only change selects `test`, `test:integration` and `test:integration:parallel` for every replaying server package.
- A malformed baseline migration turns `packages/epistemic/server/test/RetentionAuthority.pglite.test.ts` red with `syntax error at or near "THIS"`.
- Two review findings on #3616 widened the census. It now strips only module specifiers from a line instead of skipping every `import`/`export` line, and it keeps a reference that resolves to another package's root. On main the first surfaced 0 new reads. The second surfaced 1: `ci-partitions.test.ts` named law-practice-server's root as a join base for the test files it globs. The literal is narrowed to `test/`, and repo-cli declares `packages/law-practice/server/test/**` on `test`, `test:property` and `coverage`, with a CoverageScope row for the same prefix.

The cache subjects are re-recorded through `docs/reports/cross-package-reads-cache-baseline-request-2026-11-27.json` and, for the review fix, `docs/reports/cross-package-reads-root-reference-cache-baseline-request-2026-11-27.json`. No changed file is in the CI binary closure.
