# `@beep/repo-utils` coverage repair on `main` — 2026-11-02

Scope: restore the committed `@beep/repo-utils` coverage floors in
`standards/coverage.regression-baseline.jsonc` (lines 79.83, statements 79.36,
branches 60.04, functions 61.82) on `main` with behavior tests, without
lowering, suppressing or editing any baseline. One new test file,
`packages/tooling/library/repo-utils/test/schemas/TsconfigAliasTargets.test.ts`,
plus this note. No source, JSDoc module, manifest, root config, catalog,
baseline, lifecycle or phase change. Red episode: repo-utils coverage only.

Run: one Claude cloud session (uid 0), no child agents, promotional cloud
credit only. Branch `codex/repo-utils-coverage-main`, cut from a fresh
`origin/main` at `e274d3e6` before any edit.

## Attribution (from the admission, not re-derived here)

The admission compared the same coverage configuration at base `e0b14ca4`:
repo-utils statements 1147/1466 (78.24%) versus the JSDoc-split lane's
1158/1477 (78.40%), with 319 uncovered statements in both. The deficit is
therefore inherited on `main`, not introduced by the JSDoc split. The earlier
owner, #2078, was verified merged on 2026-10-23 (`0e1a160`), so it is no
active hold. At admission, no open PR owned `repo-utils/test`.

## Measurement

Command, from the package directory, Node/V8 like the canonical producer:

```bash
bunx vitest run --coverage --maxWorkers=1 --coverage.reportOnFailure=true \
  --coverage.reporter=json-summary --coverage.reporter=json \
  --coverage.reporter=text-summary --coverage.reportsDirectory=<scratch>
```

| Metric | Before (`e274d3e6`) | After (this branch) | Floor |
| --- | --- | --- | --- |
| Statements | 78.24% (1147/1466) | 81.51% (1195/1466) | 79.36% |
| Lines | 78.74% (1104/1402) | 82.02% (1150/1402) | 79.83% |
| Branches | 58.59% (208/355) | 65.07% (231/355) | 60.04% |
| Functions | 63.40% (317/500) | 65.80% (329/500) | 61.82% |

The before run reproduced the admission's 1147/1466 exactly.

**Root fixture limit.** In both runs, one existing test failed:
`FsUtils` "should fail with DomainError when a directory mid-walk is
unreadable". The session runs as uid 0, which can read a mode-000 directory,
so the fixture cannot fail as designed. The first run, without
`reportOnFailure`, exited 1 with no coverage report. That initial FAIL is kept
on record here. It is not a pass, and the fixture was not skipped, weakened or
changed. Both measurements above were taken with that test failing, so they
lack whatever coverage its error path adds. A non-root run is the parent's
separate proof.

## What the tests cover

`TsconfigAliasTargets.ts` had no test importing it: 49 statements and 24
branches uncovered, including its module-level constants. It is a pure helper
used by `TsconfigSync.plan.ts` and `CreatePackage/ConfigUpdater.ts`. The new
tests assert its documented contract with synthetic export maps:

- Root-export resolution follows the condition priority (`types`, `import`,
  `default`, ...) rather than object key order.
- Non-relative condition values are skipped, with fallback to unknown
  conditions and to array alternatives.
- The top-level condition-map sugar form resolves as the root export.
- A subpath-only map has no root export.
- Subpath and wildcard lookup: `null` (blocked) subpaths and non-map exports
  return none.
- Data-first and data-last forms are covered.
- Canonical alias targets anchor the wildcard at the root export's directory.
- Only `.ts`/`.tsx` file-stem wildcards lose their extension. Directory-shaped,
  partial-segment and `.js` stars pass through or are rejected.

All 15 tests passed on their first run. One statement is still uncovered: the
`lastSlash < 0` fallback in `buildCanonicalAliasTargets`. It appears
unreachable, because the built root target always contains `/`. This is an
observation, not a bug report, so no source change was made.

## Checks run

- The new test file: 15 passed.
- `biome check`: formatting fixed once, then the package's `biome check .` was
  clean.
- `bun run lint:laws` for the package: 0 findings, including
  `package-test-imports`.
- `tsrs -p tsconfig.test.json --noEmit`: clean.
- Default `bun run beep quality package-verify @beep/repo-utils`: the result
  is reported on the PR.

## Decisions

| Decision | Reason | Reversal |
| --- | --- | --- |
| Close the deficit with tests for `TsconfigAliasTargets.ts` only. | It is the largest fully untested non-JSDoc pure module, it has an exact documented contract, and it alone clears all four floors with margin. | Delete the test file. |
| Leave `JSDocCategories.ts` and the other JSDoc surfaces alone. | Out of this lane's scope (JSDoc-owned surfaces). | — |
| Keep the uid-0 fixture failure visible. | Weakening it would hide a real non-root assertion. | — |

## Friction

- `--coverage.reportsDirectory` is cleaned at the start of each run, so a log
  written inside it is deleted. Keep logs outside the reports directory.
- Under uid 0 the `FsUtils` permission fixture always fails. Without
  `reportOnFailure`, cloud coverage runs for this package produce no report at
  all. Prevention: run coverage proofs as a non-root user, or record the
  limit, as here.
