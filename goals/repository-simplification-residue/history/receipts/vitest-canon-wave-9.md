# #1875 Effect Vitest canon wave 9: record

Lane B of the overnight burn-down. Branch `test/residue-vitest-canon-wave9` off `main`
`77edd3db28`. Scope: the 18 `@beep/repo-cli` test files in lane B, which hold 41 open
EV004 rows and 12 open EV010 rows. This wave changes no detector and no source file. It
adds no exception and no row.

## Census at `77edd3db28`

The inventory holds 712 rows: 465 exceptions and 247 open. EV004 holds 139 rows (89
exceptions, 50 open) and EV010 holds 264 (137 exceptions, 127 open). In the lane B files,
53 rows are open: 41 EV004 and 12 EV010.

| EV004 class (lane B, open) | At base | Migrated | Open after |
| --- | ---: | ---: | ---: |
| `redundant-whole-body-scope` | 10 | 10 | 0 |
| `inner-helper-scope-lifetime-review` | 20 | 13 | 7 |
| `shorter-scope-lifetime-review` | 7 | 5 | 2 |
| `helper-scope-lifetime-review` | 3 | 3 | 0 |
| `shared-helper-scope-lifetime-review` | 1 | 1 | 0 |
| **EV004 total** | **41** | **32** | **9** |
| **EV010** | **12** | **0** | **12** |

## What the detector accepts

EV004 (`detectScopeLifetime` and `detectAppliedScope` in `EffectVitestDetectors.ts`) flags
every `Effect.scoped` call or pipe stage inside an `it.effect` body or in a helper that
returns an Effect. Its class says where the scope sits: the whole test body, a
helper's whole body, inside a helper, or a shorter block in the test. A row clears only
when the `Effect.scoped` goes away. `it.effect` already gives each test a `Scope`, so a
resource acquired without the wrapper is released when the test ends.

## Method

For each row, the question is whether any assertion or later step observes the scope
closing. Every row where nothing observed it was migrated. Every row where something did
was kept, with the evidence below. Each kept row was read in full, and the two
`step-capture-lifecycle` rows were also trialled. The touched files then ran on Bun and on
Node, `check` (test overlay included) ran clean, and a mutation probe ran for each
migration family.

## Migration patterns

1. **Whole-body scope dropped (10 rows).** `}).pipe(Effect.scoped)`,
   `Effect.fnUntraced(..., Effect.scoped)` and `Effect.scoped(Effect.gen(...))` around a
   whole test body. The only scoped resource is a `makeTempDirectoryScoped` fixture, and no
   assertion runs after the body. Files: `cache-evidence` ×2, `models-manifest-errors` ×2,
   `knowledge-doctor-baseline` ×1, `test-typecheck-coverage` ×3, `skills-provenance` ×2.
2. **Scope after `Layer.build` dropped (14 rows).** A fresh service layer is built with
   `Layer.build` and read with `Context.get`, then the build scope is closed at once, and
   the test keeps using the service afterwards. These layers only build plain services
   (`Layer.effect` constructors and `Layer.succeed` stubs) and register no finalizer, so
   letting the test scope own them changes nothing a test observes. Files:
   `goals-packet-convention-migration` ×3 (`PacketForkRepairApplierLive`),
   `runners-bake` ×7 (`RunnersServiceLive`), `restoration-archive-coverage` ×3
   (`CorpusCommandServiceLive`), `worktree-command` ×1 (`WorktreeRemovalServiceLayer` with
   the stub merged-pull-request probe).
3. **Scope nested in `provideScopedLayer` dropped (5 rows).** `provideScopedLayer` from
   `@beep/test-utils` runs `Layer.build(...)` and then `Effect.scoped`, so its scope already
   covers everything inside it. `proof-job`'s `fixture` was
   `Effect.scoped(runFixture(...)).pipe(provideScopedLayer(NodeServices.layer))`, and
   `worktree-remove-fence`'s `withScratchRepo` wrapped `Effect.gen(...).pipe(provideScopedLayer(testLayer))`
   in a second scope. Its three callers wrapped their callback bodies in a third. The
   finalizers (temp directory, `chdir` restore, holder handle) keep their LIFO order inside
   the one remaining scope. `withScratchRepo` becomes
   `Effect.fnUntraced(function* (...) {...}, provideScopedLayer(testLayer))`, which also
   satisfies the `effectFnOpportunity` diagnostic. Files: `proof-job` ×1,
   `worktree-remove-fence` ×4.
4. **Probe helper scope dropped (1 row).** `drawings-review`'s `toolPresent` runs
   `<tool> -v` and waits for `exitCode`, so the child has already exited when the scope
   would close. It becomes `Effect.fnUntraced(function* (command) {...}, Effect.catchTag(...))`.
5. **One-off scope inside a test dropped (2 rows).** In `restoration-archive-coverage`,
   `hashResumedArchivePrefix` opens the source file and fails, and no later step depends on
   that descriptor. In `worktree-command`'s "enforces ancestry boundaries" test, the open
   descriptor and the `sleep` holder are not observed after the block: every refusal is
   asserted inside the block, and the holder is killed by `Effect.ensuring`. The block
   becomes a plain `{ ... }` (the `nestedEffectGenYield` diagnostic rejects a nested
   `yield* Effect.gen`). The descriptor now closes when `withScratchRepo`'s scope closes,
   before that scope removes the temp tree.

No assertion, expected value, test name or registration changed, except for the defect fix
below. No test was skipped, added or removed.

### Defect fixed in passing: `restoration-archive-coverage` late-file test

"rejects collector destinations that appear only after inventory capture" checked only
`Exit.isFailure`. The mutation probe that drops the late write still passed, because the
same collector row then fails earlier, on `Collector present successful row denominator
mismatch: expected 1, observed 0`. The test now flips the error and asserts the
late-appearance refusal by name ("Inherited collector present destinations are not a
subset of preservation files"). With that change, the probe without the late write fails.

## Kept: 9 EV004 rows whose scope close is observed

Under S31 these stay open. Lane B adds no exception, so these are evidence for #1855's
owner/exit register.

- **K1. Cleanup failure is the subject (5 rows).** `lint-security.test.ts:107`,
  `purge-security.test.ts:161`, `regenerate-merge-driver.test.ts:131`,
  `step-git-exec.test.ts:504` and `:695`. Each test wraps `makeTempDirectoryScoped` with an
  observed release, and the scope runs inside `Effect.exit`. After it closes, the test
  asserts the removal error (`removalError`, `PermissionDenied` on `remove`), the combined
  `Cause` of body and release failure, and whether the directory still exists. Without the
  scope, release would run at test teardown, after those assertions.
- **K2. A descriptor's close is the subject (2 rows).** `process-attachment.test.ts:61`
  ("forgets it once closed") scans again after the scope closes and expects no
  descriptor. `worktree-command.test.ts:2270` expects retirement to refuse while the
  descriptor is open and to succeed "with the descriptor closed".
- **K3. Reviewed short capture scopes (2 rows).** `step-capture-lifecycle.test.ts:720` and
  `:742` have the same shape as the six sibling scopes in the file (`:604`, `:624`, `:646`,
  `:672`, `:693`, `:770`), which are reviewed exceptions. The proof
  (`goals/effect-vitest-canon/research/step-capture-scope-proof.md`) shows these scopes
  must close at `runCaptured` completion, before the kill/unref assertions, to keep fiber
  interruption ordering. In a trial without the two scopes, both tests still passed. That
  does not show the scope is unobserved: with the fake spawner, the ordering it guards
  does not reach an assertion. These two rows should join the sibling exceptions in
  #1855's register.

## EV010: 12 rows stay open

Each file needs a live platform resource. Wave 7's memory-filesystem trial already placed
ten of them (H2 to H6). `step-capture-lifecycle` was deferred to after #2247, and this
wave trialled it again.

| File | Row | Evidence |
| --- | --- | --- |
| `step-capture-lifecycle.test.ts` | `:15` `NodeServices` | Real `echo`, `sh` and nested `bun -e` children, plus `/proc/<pid>/stat` process groups (H4). |
| `step-capture-lifecycle.test.ts` | `:16` `NodeFileSystem` | Trial: all five `NodeFileSystem` blocks were moved to `MemoryFileSystem.layer`. 17 tests passed and the same five admission tests failed: `withAdmissionWorkloadBinding` publishes the workload record through a real shell (`yeet-admission-workload: ... No such file or directory`). This matches the earlier step-capture proof. Restored byte for byte from `HEAD`. |
| `goals-packet-convention-migration.test.ts` | `:33` | Copies committed fixtures resolved through `import.meta.url` (`FORKED_PATH`). Wave 7 classed it H3 (process working directory). |
| `process-attachment.test.ts` | `:21` | Reads `/proc` and real symlinks, and spawns an inotify watcher (H4). |
| `proof-job.test.ts` | `:14` | Writes `systemd-run`/`systemctl`/`busctl` shims on `PATH` and spawns them (H4). |
| `restoration-archive-coverage.test.ts` | `:12` | Real hard links, symlinks, `/proc` writer identity, and spawned children (H4). |
| `runners-bake.test.ts` | `:28` | Reads the real checkout through `findRepoRoot` (H2). |
| `skills-provenance.test.ts` | `:49` | Reads committed fixtures and the checkout, and runs the adapter sandbox script with `Bun.spawnSync` (H2). |
| `step-git-exec.test.ts` | `:29` | Runs real `git` (H4). |
| `test-typecheck-coverage.test.ts` | `:6` | Creates real symlinks to prove that the walker refuses or follows them (H6). |
| `worktree-command.test.ts` | `:50` | Real `git`, `mkfifo` and `sleep` holders, and `/proc` (H4). |
| `worktree-remove-fence.test.ts` | `:20` | Real `git`, holders, `/proc/<pid>/cwd`, and `process.chdir` (H4). |

## Exceptions re-checked

The touched files hold four exceptions: `models-manifest-errors.test.ts:140` EV002,
`worktree-remove-fence.test.ts:81` and `:98` EV003, and `worktree-command.test.ts:211`
EV004. Their reasons still hold and they are byte-identical. All 465 exceptions are
unchanged. The `files-command` `withReplacedPath` exception and the seven
`#1855 wave 4 register` exceptions are untouched.

## After the wave

`lint effect-vitest --write` was run twice, and the inventory sha256 was identical both times
(`8deb64e2a9120869cfe4c3d64e7f50bba819a0fa150e2c10796d9eb1da08eac3`). A plain scan then
reports `introduced=0 resolved=0`.

Against `77edd3db28`, paired by `(ruleId, file, occurrence)`:

| | Rows |
| --- | ---: |
| Base | 712 (465 exceptions, 247 open) |
| Gone | 32 (all EV004, all open, all in lane B files) |
| New | 0 |
| Status changed | 0 |
| After | 680 (465 exceptions, 215 open) |

The totals reconcile exactly: 247 − 32 = 215 open, 712 − 32 = 680 rows, and exceptions
stay at 465. EV004 open falls from 50 to 18 and EV010 open stays at 127. Lane B ends with
21 open rows: 9 EV004 and 12 EV010.

## Mutation probes

Each probe changed one fixture or subject line, ran the one test on Bun, and restored the
file. A diff sha256 confirmed the tree was identical afterwards. Every probe finished in
3 s or less, with no hang.

| Pattern | Probe | Result |
| --- | --- | --- |
| 1 | `cache-evidence`: artifact written as `fours` (over the 4-byte bound) | fails |
| 1 | `models-manifest-errors`: manifest `bindings: []` (parses) | fails |
| 1 | `knowledge-doctor-baseline`: lease expires before `NOW` | fails |
| 1 | `test-typecheck-coverage`: blind package includes `test` | fails |
| 1 | `skills-provenance`: directory link `mirror` not created | fails |
| 2 | `goals-packet-convention-migration`: `copyFile` override succeeds | fails |
| 2 | `runners-bake`: Pulumi AMI pin differs from the manifest | fails |
| 2 | `worktree-command`: stub probe answers `O.none()` | fails |
| 2 | `restoration-archive-coverage`: no late collector file | passed at first; fails after the fix above |
| 3 | `proof-job`: `systemd-run` shim exits 0 | fails |
| 3 | `worktree-remove-fence`: `CLAUDE_PID` names init | fails |
| 4 | `drawings-review`: probe an absent tool | NotFound maps to `false`, and the 20 poppler tests skip (11 pass, 20 skip, 0 fail) |

## What remains

- EV004: 18 open repo-wide. In lane B, 9 rows (K1 5, K2 2, K3 2) have a scope whose close
  is observed. They go to #1855 for its owner/exit register.
- EV010: 127 open, unchanged. This wave confirms the 12 lane B rows as live-resource rows.
- Other lanes in the overnight burn-down own the remaining EV002, EV004 and EV015 rows.

## Verification

Route: S39/S41 Claude chain, `claude-opus-5-5` child (Claude Code Agent tool), no
cross-provider lane. Every heavy command ran alone through `beep-heavy` with stdin from
`/dev/null`. Dependency dists were built first with
`bunx turbo run build --filter=@beep/repo-cli^...` (67 of 67 tasks, 66 cached). The lane
report `.beep/vitest-w9-report.md` lists the results of the remaining gates.

| Check | Result |
| --- | --- |
| `bun run beep lint effect-vitest` | `introduced=0 resolved=32` before `--write`, `introduced=0 resolved=0` after |
| `--write` byte stability | two consecutive writes, identical sha256 `8deb64e2...eac3` |
| repo-cli `bun run check` (tsconfig.check, scripts, test overlay) | exit 0. The first run failed on three Effect diagnostics (`effectFnOpportunity` ×2, `nestedEffectGenYield` ×1) that the unwrapping introduced, and patterns 3 to 5 above fix them. |
| 12 touched files, Bun (`bunx --bun vitest run`) | 377 tests passed |
| 12 touched files, Node (`bunx vitest run`) | 377 tests passed |
| Biome on the touched tests | clean |
| `lint:schema-first` | `missing_entries=0`, `introduced=0` |
| root `lint:oxlint`; root docs oxlint (`oxlint . --config .oxlintrc.docs.json --max-warnings=0`) | exit 0, exit 0 |
| `quality fallow audit --base origin/main --check` | ok, 0 findings, `introduced=0` |
| `jsdoc:inventory:check` then `jsdoc:ratchet:check` | ok, `increased=0`, zero-legacy ok |
| `goals:doctor`; `lint:retired-effect-paths` | OK, no new blocking findings; `findings=0` |
| `bun run docgen:local` | no package-local docgen inputs changed (only tests and packet files changed) |
| Coverage ratchet `bun run coverage --filter=@beep/repo-cli` | not proven locally. Both attempts ended with exit 143 (after 3 min 28 s, then after 6 s). The system journal shows `earlyoom` sending SIGTERM to vitest workers in this lane and in sibling lanes at 0% available memory (42 kills since 06:55). This is environment-only. Hosted CI is the proof. |
| `quality package-verify @beep/repo-cli` | not proven locally. The first attempt reported `Failed to spawn bun run docgen`. The second passed build and `check`, then `beep:test` ended with exit 143 under the same `earlyoom` pressure. Hosted CI is the proof. |

## Reversal

Revert the PR. The 12 test files return to their `Effect.scoped` wrappers, and the
late-file test returns to its bare failure check. The 32 EV004 open rows return with their
previous occurrences, and the inventory returns to the base: 712 rows, 465 exceptions, 247
open (EV004 50 open). Nothing else is generated.
