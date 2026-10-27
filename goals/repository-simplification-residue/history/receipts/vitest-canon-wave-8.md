# #1875 Effect Vitest canon wave 8: record

Lane A of the overnight burn-down, branch `test/residue-vitest-canon-wave8` off `main`
`77edd3db28`. Scope: the open EV002, EV004, EV010 and EV015 rows in 11 `@beep/repo-cli` test
files (`lanes.A` of the overnight lane file). Lanes B, C and R own every other file; lane R alone
owns the detector and any new exception. This wave changes no detector, adds no row and adds no
exception. The `step-capture-lifecycle` rows sit in lane B's set, so they are not here.

## Census at `77edd3db28`

`bun run beep lint effect-vitest`: 2,937 files, 712 findings, `introduced=0 resolved=0`. The
inventory holds 712 rows: 465 exceptions and 247 open. The lane's 11 files hold 84 open rows:

| File | EV002 | EV004 | EV010 | EV015 |
| --- | ---: | ---: | ---: | ---: |
| `yeet-sweep-retire.test.ts` | 27 | 8 | 1 | 0 |
| `proof-shadow.test.ts` | 13 | 0 | 1 | 0 |
| `research-history-sift.test.ts` | 6 | 0 | 1 | 0 |
| `graft-cache-sync.test.ts` | 3 | 0 | 0 | 0 |
| `identity-registration-removal.test.ts` | 2 | 0 | 1 | 0 |
| `roadmap-refs.test.ts` | 1 | 0 | 1 | 0 |
| `yeet-settle.test.ts` | 0 | 0 | 0 | 11 |
| `yeet-monitor-ready.test.ts` | 0 | 0 | 1 | 2 |
| `yeet-review-window.test.ts` | 0 | 0 | 1 | 2 |
| `corpus-command.test.ts` | 0 | 0 | 0 | 1 |
| `yeet-pr-provenance.test.ts` | 0 | 0 | 0 | 1 |
| **Total** | **52** | **8** | **7** | **17** |

The files also hold 3 exceptions (`yeet-sweep-retire` EV003 `withCwd` and `withRealCwd`,
`corpus-command` EV010). All three are unchanged.

## After the wave

`lint effect-vitest --write` was run twice, and the inventory sha256 was identical both times
(`b63a829515633dd532878214b678eaab55fd2daa5115c83d89e58a3b01d0ef41`). It holds 635 rows: 465
exceptions and 170 open. A plain scan reports `introduced=0 resolved=0`.

Against `77edd3db28`, paired by `(ruleId, file, occurrence)`:

| | Rows |
| --- | ---: |
| Base | 712 (465 exceptions, 247 open) |
| Gone | 77, all open and all in the lane's files: 51 EV002, 8 EV004, 17 EV015, 1 EV010 |
| New | 0 |
| Status changed | 0 |
| After | 635 (465 exceptions, 170 open) |

That reconciles exactly: 247 − 77 = 170 open, 712 − 77 = 635 rows, and exceptions stay at 465.
7 of the lane's 84 rows stay open (1 EV002, 6 EV010).

The post-build scans list 2,941 files where the base listed 2,937. The four extra files are the
built `dist/` copies in test-kit packages from the dependency build, as in wave 7, and they produce
no rows.

## Migration patterns

1. **Shared block.** A provided layer with no state a test can observe moves into `it.layer`.
   `research-history-sift`: both `describe`s become `it.layer(TestLayer, { timeout: "30 seconds" })`
   over `NodeServices.layer` plus `FetchHttpClient.layer`; neither suite adjusts the clock or
   reads the console. `proof-shadow`: the 12 `PlatformLayer` tests sit in two unnamed blocks inside
   `describe("proof shadow mode")`, in place, so suite and test names are unchanged and the two
   existing named blocks there are not nested.
2. **Single-test block.** A layer whose state a test reads gets a block per test. The
   `proof-shadow` report test reads `TestConsole` and gets its own
   `Layer.mergeAll(PlatformLayer, TestConsole.layer)` block. The two `identity-registration-removal`
   tests and the `yeet-sweep-retire` git-failure test each get their own block over the layer they
   provided (`removalLayer` and `testLayer` hold a TSMorph project cache and a TestConsole).
3. **Stub value to `Effect.provideServiceEffect`.** The 26 `provideScopedLayer(ghLayer(tip, state))`
   calls in `yeet-sweep-retire` provided `Layer.effect(ChildProcessSpawner, ghSpawner(...))`. They now
   provide `ghSpawner(tip, state)` through `Effect.provideServiceEffect`, the form the same file
   already used for its files-list cases. The spawner is built once per provide over the real
   spawner, as before. The unused `ghLayer` factory is removed.
4. **Whole-body temp root to a test-scoped value.** Removing the `proof-shadow` provides would make
   `inTempCheckout((root) => ...)` the whole test body, and EV003 flags that (a first pass produced
   13 new EV003 rows, so it was not kept). The acquisition is now `makeTempCheckout`, and the 13
   whole-body cases yield `tempCheckout`, an `Effect.acquireRelease` over it that the test's own
   scope releases. EV003's sketch asks for exactly this: keep only the per-test resource scoped. The
   two nested cases that need a checkout for part of a test keep `inTempCheckout`, now an
   `acquireUseRelease` over the same acquisition. The checkout was the last thing released before,
   and it still is. No process state is involved.
5. **Drop a chdir the subject does not need.** The two `identity-registration-removal` rows
   (`regenerates the empty labs state ...`, `fails to resolve the registry path ...`) ran inside
   `withTempWorkingDirectory` only so that `"."` named the fixture. `syncLabIdentitySegment` and
   `resolveIdentityPackagesFilePath` take the repository root as an argument, so the tests now
   write under `fs.makeTempDirectoryScoped()` and pass that absolute root. No cwd changes, so no
   EV003 process-state wrapper appears. This is disposition 2 of the #1855 wave 5 process-state
   ruling. The expected values are unchanged.
6. **Block-owned subject over an override seam.** The three `graft-cache-sync` rows rebuilt
   `Layer.fresh(GraftCacheSyncLive)` over a `FileSystem` double declared in the test body (wave 6
   hand-off 1). Each test now runs in its own nested block over `overriddenSyncLayer`: a fresh
   `GraftCacheSyncLive` built over `overriddenFileSystem`, plus a `FileSystemOverrides` service
   (a `Ref` of partial filesystem operations). `overriddenFileSystem` dispatches `readDirectory`,
   `realPath`, `rename` and `stat` through the `Ref` at call time and passes everything else to
   the native filesystem. After building its fixture, a test installs its counters or
   `rename` hooks with `overrideFileSystem({...})`. The hook bodies, the body-local counters and
   every assertion stay in the test. The block exports only `GraftCacheSync` and the override
   service, so the test's own `fs` stays native, as before. This holds because
   `GraftCacheSyncLive` performs no filesystem operation when it is built (its JSDoc says so, and
   `makeGraftCacheSync` only reads the services). So nothing is observed before the test installs
   its overrides, and the counted reads are the same as in the per-test rebuild. The repository
   precedent is `corpus-command`'s `ArchiveCopyMutation` seam.
7. **Redundant scopes removed (EV004, 8 rows).** In `yeet-sweep-retire`, `withScratchRepo` wrapped
   its body in `Effect.scoped` and then in `provideScopedLayer(testLayer)`, which scopes the same
   effect again (`Layer.ts:47-53` in `@beep/test-utils`). The outer `Effect.scoped` is dropped, and
   the helper becomes `Effect.fn("YeetRetireTest.withScratchRepo")(..., provideScopedLayer(testLayer))`
   (the `effectFnOpportunity` diagnostic asked for that form). The six inner `Effect.scoped` calls
   inside `withScratchRepo` callbacks, around a `sleep`/`sh` lane holder, are dropped too: the
   holder now joins the `provideScopedLayer` scope, which closes when the same callback ends. It
   still closes in reverse acquisition order: the holder first, then the temp tree, then the cwd
   restore. Each test also still kills its holder through `Effect.ensuring`. The git-failure test's
   whole-body `Effect.scoped` goes with its provide (pattern 2): `it.effect` scopes the test.
8. **Own block for a clock-adjusting test (EV015, 17 rows).** `ownsUnsharedTestClock` accepts a
   `TestClock.adjust` only in a top-level block with exactly one registration. Each test that
   adjusts the clock gets its own top-level block with the same builder, options and suite name.
   The tests before and after it stay together in blocks of the same name, in place, so suite
   names and registration order are unchanged:
   - `yeet-settle`: `B7 merge-loop timing`. Its three tests all adjust, so it becomes three
     blocks, and its one plain `it` goes to a `describe` of the same name. `B7 sleep after a spent
     registration budget (ruling 49)` becomes two blocks.
   - `yeet-monitor-ready` (`B7 remaining boundaries`), `yeet-review-window` (`review window read`
     and `status read with the review window`), `yeet-pr-provenance` and `corpus-command`
     (`corpus restoration mail`): one block for the adjusting test, plus its neighbours in place.

   Each top-level block builds its own memo map and TestEnv, so each adjusting test has a clock no
   other test advances. That changes one thing, which is what EV015 flags: a test that registered
   after an adjusting test in the same block used to start on the clock that test had advanced
   (1 s in `B7 remaining boundaries`, 13 minutes in the review-window blocks, 2 s in
   `yeet-pr-provenance` and `corpus restoration mail`), and now starts at zero. Every such test
   either sets its own time (`TestClock.setTime`) or does not depend on the absolute time, and
   all of them pass with unchanged expected values on Bun and Node. The three `B7 merge-loop
   timing` tests each begin with `TestClock.setTime(0)`, so their split changes nothing they
   read.

The new blocks carry `{ timeout: "30 seconds" }`, the hook budget their siblings use, so no
EV014 row appears. The exception is the split `B7 remaining boundaries` block, which keeps its
original options.

### EV010: one portable file

`proof-shadow`'s `PlatformLayer` now uses `MemoryFileSystem.layer` from `@beep/memfs/MemoryFileSystem`,
with `NodeCrypto` and `NodePath` kept, so the `@effect/platform-node/NodeFileSystem` row retires.
The 15 tests over `PlatformLayer` (13 migrated here, 2 in the existing `red runs` and clone blocks) write their temp checkout, ledger and turbo summaries themselves.
None spawns a process: the block provides no `ChildProcessSpawner`, and the trial passed on Bun and
Node. The git-backed `proof shadow changed packages` block stays on `NodeServices.layer`. Wave 7
had classified this row as a live process (H4) from source without a trial; the trial shows the
spawning tests are only in that other block.

## Per-file record

| File | Rows retired | Patterns | Tests |
| --- | --- | --- | ---: |
| `yeet-sweep-retire.test.ts` | 27 EV002, 8 EV004 | 3, 2, 7 | 45 |
| `proof-shadow.test.ts` | 13 EV002, 1 EV010 | 1, 2, 4, EV010 | 29 |
| `research-history-sift.test.ts` | 6 EV002 | 1 | 6 |
| `graft-cache-sync.test.ts` | 3 EV002 | 6 | 23 |
| `identity-registration-removal.test.ts` | 2 EV002 | 2, 5 | 12 |
| `yeet-settle.test.ts` | 11 EV015 | 8 | 51 |
| `yeet-monitor-ready.test.ts` | 2 EV015 | 8 | 40 |
| `yeet-review-window.test.ts` | 2 EV015 | 8 | 25 |
| `corpus-command.test.ts` | 1 EV015 | 8 | 92 |
| `yeet-pr-provenance.test.ts` | 1 EV015 | 8 | 11 |

No assertion, expected value, test name or registration changed. No test was skipped, added or
removed. The 11 lane files run 336 tests at the base and 336 after, with identical full names
(suite path plus title) from the JSON reporter on Bun.

## Not migrated: 7 rows

No exception was added: under the brief, only lane R adds them.

- **`roadmap-refs.test.ts:78` EV002 (1 row).** This is the third of wave 6's hand-off 2 cases. The
  test body is `withTempWorkingDirectory(...).pipe(provideScopedLayer(testLayer))`. Without the
  provide, the chdir wrapper becomes the whole body, which is an EV003 process-state wrapper under
  the #1855 wave 5 ruling. Unlike the identity cases, the chdir is read: `lint roadmap-refs`
  resolves its repository root with `findRepoRoot()` from `process.cwd()` (`RoadmapRefs.ts:303`),
  and that command has no root option. Yielding `temporaryWorkingDirectory` inside a block would
  hide the same process-state mutation from EV003, so it was not done. Exit: a repository-root
  seam on the roadmap-refs command, or a lane R/#1855 owner and exit for the wrapper.
- **EV010 (6 rows), still live resources** (wave 7 classes, rechecked against the migrated
  files):
  - `identity-registration-removal:14`: H3. The five `withRegistry` removal tests chdir into a
    temp tree whose `tsconfig.json` the TSMorph service resolves from the cwd.
  - `research-history-sift:5`: H5. DuckDB's sqlite scanner writes and reads the History file on
    the real filesystem.
  - `roadmap-refs:8`: H2 and H3. The second test reads the committed fixture from the real
    checkout, and both chdir.
  - `yeet-monitor-ready:42`: H4. Live spawner, trialled in wave 7.
  - `yeet-review-window:26`: H1. `Command.run` needs the CLI environment's types.
  - `yeet-sweep-retire:40`: H4. It runs real git, `sleep`/`sh` lane holders and the
    `/proc`-reading archive fence.

## Mutation probes

There were 13 probes, all applied at once and run on Bun. Each listed test failed with an assertion or
a typed error, and none hung: the slowest failing test took 1.6 s. The files were then restored
byte for byte from the migrated copies.

| Pattern | File: test | Mutation | Failure |
| --- | --- | --- | --- |
| 1 | `research-history-sift`: collapses repository subpages | drop the denylisted fixture row | `expected 3 to be 4` |
| 2, 5 | `identity-registration-removal`: fails to resolve the registry path | add an identity workspace under the root | `expected 'Success' to be 'Failure'` |
| 5 | `identity-registration-removal`: regenerates the empty labs state | write a registry without the lab markers | `DomainError` (marker missing) |
| 4, EV010 | `proof-shadow`: shadows a first attempt as misses | `makeTempCheckout` omits `bun.lock` | `Failed to read bun.lock for the proof epoch` in 14 of the 15 `PlatformLayer` tests (the no-lanes case reads no epoch), so they read the memory volume |
| 6 | `graft-cache-sync`: plans 25 populated clones | the `stat` override stops counting | `expected +0 to be 7982` |
| 6 | `graft-cache-sync`: cleans up a failed atomic replacement | the `rename` override is not installed | the expected failure does not occur |
| 3 | `yeet-sweep-retire`: retires the merged nested lane | `ghSpawner(tip, "OPEN")` | `YeetCommandError` (refuses to retire) |
| 7 | `yeet-sweep-retire`: refuses while another process holds the lane | the holder stands in the clone, not the lane | the refusal does not occur |
| 8 | `yeet-settle`: keeps the full poll interval | `pollInterval` 20 s | `expected 2 to be 1` |
| 8 | `yeet-review-window`: reads the window open on the test clock | adjust 1 minute, not 13 | window still `open` |
| 8 | `yeet-monitor-ready`: times out at exactly 1000ms | `settleTimeoutMs: 999` | `expected 2 to be 3` |
| 8 | `yeet-pr-provenance`: preserves exact Codex identity | another `CODEX_THREAD_ID` | `assertSome` mismatch |
| 8 | `corpus-command`: resumes one durably started mail attempt | the changed-policy rerun keeps the policy | the expected refusal does not occur |

## Exceptions re-checked

All 465 exceptions are byte-identical, including the three in the lane's files (`yeet-sweep-retire`
EV003 `withCwd` and `withRealCwd`, whose reasons still hold because both wrappers are unchanged,
and the `corpus-command` EV010 exception). The `files-command` `withReplacedPath` exception and
the seven `#1855 wave 4 register` exceptions are untouched.

## What remains

- In the lane's files: 1 EV002 row (`roadmap-refs`, needs a root seam or a lane R owner/exit) and
  6 EV010 live-resource rows for #1855's owner/exit register.
- Repository-wide after this lane alone: 170 open rows. Lanes B, C and R report their own counts.

## Verification

Route: the S39/S41 Claude chain, through a `claude-opus-5-5` child (Claude Code Agent tool), with no
cross-provider lane. Every heavy command ran alone through `beep-heavy` with stdin from `/dev/null`.
Dependency dists were built first with `bunx turbo run build --filter=@beep/repo-cli^...`
(67 of 67 tasks, 66 cached).

| Check | Result |
| --- | --- |
| `bun run beep lint effect-vitest` | base `introduced=0 resolved=0`. A first pass gave `introduced=13` (EV003 on the whole-body `inTempCheckout` in `proof-shadow`), fixed with pattern 4. Before `--write` the final scan gave `introduced=0 resolved=77`; after it, `introduced=0 resolved=0`. |
| `--write` byte stability | two consecutive writes, identical sha256 `b63a8295...0ef41`. 712 rows to 635. |
| Exceptions | 465 before and after, reasons unchanged |
| repo-cli `bun run check` (`tsconfig.check`, scripts, test overlay) | exit 0. A first run flagged three `effectFnOpportunity` (TS377047) sites, two in the new seam and one in `withScratchRepo`; they were rewritten to `Effect.fnUntraced` and `Effect.fn`. |
| repo-cli `package-test-typecheck` | exit 0 |
| 11 lane files, Bun (`bunx --bun vitest run`) | 336 of 336 passed, with full names identical to the base files' 336 |
| 11 lane files, Node (`bunx vitest run`) | 336 of 336 passed, same names |
| Mutation probes (Bun) | 13 of 13 failed as listed, none hung, files restored byte-identical |
| Coverage `bun run coverage --filter=@beep/repo-cli` | Attempts 1 and 2 were SIGTERMed by `earlyoom` under host memory pressure from the parallel lanes (`low memory! at or below SIGTERM limits`, victim `vitest run --coverage`), so they are environment-only. Attempt 3: 7,877 passed, 5 skipped and 1 failed, so the ratchet was not reached. The failure is `knowledge-doctor-evaluators` "reads the same packets ... as the live filesystem", the same environment-only failure as in wave 7: it compares live packet files with committed state, and the diff is this lane's uncommitted packet edits. With the packet files at `HEAD`, the file passes 14 of 14. Hosted CI is the proof for the ratchet. |
| `quality package-verify @beep/repo-cli --quick` | ok (lint 6.2 s, check 16.1 s). The full audit was not run separately, because coverage already ran the same suite with the one environment-only red above. |
| `lint:schema-first` | `introduced=0 resolved=0`, parity ratchet ok |
| root docs oxlint (`oxlint . --config .oxlintrc.docs.json --max-warnings=0`); root `lint:oxlint` | exit 0, exit 0 |
| Biome on the 10 changed tests | clean after one import-order fix in `graft-cache-sync` |
| `quality fallow audit --base origin/main --check` | The first run, during the memory pressure, failed to run `fallow`. The re-run passed: ok, 0 findings, `introduced=0`. |
| `jsdoc:inventory:check` then `jsdoc:ratchet:check` | ok, `increased=0`, zero-legacy ok |
| `lint:retired-effect-paths`; `goals:doctor` | `findings=0`; OK, no new blocking findings |
| `bun run docgen:local` | not run: no export or package-local docgen input changed (tests and packet files only) |

## Reversal

Revert the PR. The 10 test files return to their per-test provides, wrappers, scopes and shared
clock blocks, and `proof-shadow` returns to `NodeFileSystem.layer`. The 77 open rows return with
their previous occurrences (51 EV002, 8 EV004, 17 EV015, 1 EV010), and the inventory returns to the
base: 712 rows, 465 exceptions, 247 open. Nothing else is generated.
