# #1875 Effect Vitest canon wave 7: record

Lane `residue-vitest-canon`, branch `test/residue-vitest-canon-wave7` off `main`
`d46bb55e6b`. Scope: the open EV010 rows (`platform-filesystem-candidate` and
`platform-resource-provenance-review`). The detector lane #1855 owns detector policy. This
wave changes no detector and adds no exception.

The parallel PR #2247 (#1855 wave 6, EV014) touches 24 files. None of its test files is
edited here. One of them carries EV010 rows: `step-capture-lifecycle.test.ts` (2 rows,
deferred to the next wave).

## Census at `d46bb55e6b`

`bun run beep lint effect-vitest`: 2,798 files, 960 findings, `introduced=0 resolved=0`. The
inventory holds 960 rows: 698 exceptions and 262 open. EV010 holds 280 rows: 137 exceptions
and 143 open (43 `platform-filesystem-candidate`, 100 `platform-resource-provenance-review`).

| Package | Open EV010 at base | Migrated | Open after |
| --- | ---: | ---: | ---: |
| `@beep/repo-cli` | 123 | 14 | 109 |
| `@beep/law-practice-server` | 4 | 2 | 2 |
| `@beep/m365-mcp`, `@beep/occt` | 3 each | 0 | 3 each |
| `@beep/practice-identify` | 2 | 0 | 2 |
| `@beep/box-provisioning`, `@beep/ciops`, `@beep/effect-drizzle`, `@beep/lint-rules`, `@beep/pdf-tools`, `@beep/repo-utils`, `@beep/technical-drawing`, `@beep/utils` | 1 each | 0 | 1 each |
| **Total** | **143** | **16** | **127** |

By class: `platform-filesystem-candidate` 43 to 37 (6 retired), and
`platform-resource-provenance-review` 100 to 89 (11 retired).

## What the detector accepts

EV010 (`emitPlatformFinding` in `EffectVitestDetectors.ts`) always flags a direct filesystem
import (`node:fs`, `node:os` with `tmpdir`, `@effect/platform-*/NodeFileSystem` or
`BunFileSystem`). It flags a `NodeServices`/`BunServices` import unless every `it.layer`
harness that receives the bundle either never reads `FileSystem.FileSystem` and has no
opaque imported reference, or binds `yield* FileSystem.FileSystem` in the callback (or a
same-file helper) and either provides a workspace subject layer or calls a native-only
operation (`realPath`, `readLink`, `symlink`, `link`, `chmod`, `chown`, `utimes`). Its
replacement sketch asks for the actual services to be identified before a filesystem layer
is chosen.

So a test clears EV010 only when it stops importing a native filesystem: the in-memory
`MemoryFileSystem.layer` from `@beep/memfs` (the repository's vendored port of Effect PR
#6573, already used by `artifacts-io.test.ts` and `cli-kits.test.ts`) plus `Path.layer`. This
wave does not add `realPath` calls only to satisfy the native-operation proof.

## Method

Each candidate's native layer was swapped and the file run on Bun. That trial is the oracle:
a missing service shows up as a `Service not found` defect at runtime, and a test that reads
real files fails with `NotFound`. A file was kept only when all of these held:

- every test passed on Bun and on Node;
- `check` (including the test overlay) and `test-tsgo-package` were clean;
- no test exercised a native link or no-follow guard;
- `lint effect-vitest` showed no new row.

Every other file was restored byte for byte from `HEAD`.

## Migration patterns

1. **Services bundle to memory filesystem.** `NodeServices.layer` becomes
   `Layer.mergeAll(MemoryFileSystem.layer, Path.layer)`, as a module constant
   (`PlatformLayer`) that the existing `it.layer` registration or layer composition uses.
   Suite names, options and test bodies stay the same. `makeTempDirectoryScoped` gives each
   test its own directory in the block's volume, as the native temp root did.
2. **Filesystem layer to memory filesystem.** `NodeFileSystem.layer` becomes
   `MemoryFileSystem.layer` in place, and `NodePath`/`BunCrypto` merges are kept.
3. **Keep the bundle's crypto.** `NodeServices` also supplies `Crypto`. Where a subject hashes
   (`hashFileSha256`, the packet-issue lane record), the layer also merges
   `NodeCrypto.layer` (`@effect/platform-node/NodeCrypto`, which EV010 does not flag). Files
   that already imported `NodeCrypto` from the root keep it.

`MemoryFileSystem.layer` is a `Layer.effect`, so EV014 counts it as a resource layer. The
seven blocks that had no hook timeout (`cache-synthetic-orchestration` ×1, `process-identity`
×1, `qa-judge-skill` ×1, `yeet-settle` ×4) get `{ timeout: "30 seconds" }`, the budget their
sibling blocks already use. A first pass without the timeouts produced 7 EV014 rows; with
them, `introduced=0`.

## Per-file migrations

| File | Package | Class | Pattern | Tests |
| --- | --- | --- | --- | ---: |
| `allowlist-check.test.ts` | repo-cli | resource-provenance-review | 1 | 7 |
| `cache-synthetic-orchestration.test.ts` | repo-cli | resource-provenance-review | 1 (root `NodeCrypto` kept) | 16 |
| `cli-kits.test.ts` | repo-cli | resource-provenance-review | 0 (3 tests on memfs; the large-file streaming test stays on `NodeServices.layer`, so its row stays open) | 30 |
| `drawings-judge.test.ts` | repo-cli | resource-provenance-review | 1 | 2 |
| `effect-vitest-store.test.ts` | repo-cli | resource-provenance-review | 1 | 3 |
| `fallow-audit-cache.test.ts` | repo-cli | resource-provenance-review | 1 | 5 |
| `person-match-portability.test.ts` | repo-cli | resource-provenance-review | 1 | 17 |
| `version-sync-effect.test.ts` | repo-cli | resource-provenance-review | 1 | 41 |
| `yeet-packet-issue-lane-record.test.ts` | repo-cli | resource-provenance-review | 1 + 3 | 13 |
| `process-identity.test.ts` | repo-cli | filesystem-candidate | 2 | 7 |
| `qa-judge-skill.test.ts` | repo-cli | filesystem-candidate | 2 | 2 |
| `qa-pure.test.ts` | repo-cli | filesystem-candidate | 2 | 40 |
| `yeet-merged-preview.test.ts` | repo-cli | filesystem-candidate | 2 | 16 |
| `yeet-monitor-phase-empty.test.ts` | repo-cli | filesystem-candidate | 2 | 2 |
| `yeet-settle.test.ts` | repo-cli | filesystem-candidate | 2 | 51 |
| `PracticeKg.mail-index.test.ts` | law-practice-server | resource-provenance-review | 1 (`Layer.fresh` kept) | 6 |
| `PracticeKg.register.test.ts` | law-practice-server | resource-provenance-review | 1 (`Layer.fresh` kept) | 6 |

17 files, 16 rows, 264 tests (plus the contract-test fixture repoint below). No assertion, expected value, test name or registration
changed. No test was skipped, added or removed. **Correction from hosted CI (#2250):** moving the whole `hashFileSha256` block onto `MemoryFileSystem` made "hashes a file far larger than one chunk without reading it whole" time out at 300 s on hosted Test Unit, because 64 appends to the in-memory file are quadratic. That test exercises real streaming over a multi-chunk file, which is the platform-bound class this receipt describes. It now runs in its own `NodeServices.layer` block, while the three portable cases stay on memory. Its EV010 row stays open, so the wave retires 16 rows, not 17. The `cli-kits` block already sat beside a
`MemoryFileSystem` block in the same file. The `yeet-settle` `temporary` helper already
provided a no-op filesystem per test, so its platform swap only changes the services that
helper does not shadow.

### Defect fixed in passing: `effect-vitest-contract.test.ts`

Two `discovery filesystem` tests in `effect-vitest-contract.test.ts` scanned the checked-in
`effect-vitest-store.test.ts` and asserted that it yields at least one finding. They passed
only while that file kept its open EV010 row. Migrating it made them fail
(`timing.findingCount > 0`, and no `new finding(s)` line for that file); the full repo-cli
coverage run caught it. Both tests now scan `basic-ftp-compatibility.test.ts` through one
named constant (`scannedTestFile`) with a comment on why. That file's EV010 row is a reviewed
native-subject exception (native sockets plus the installed dependency graph), so later
migrations cannot empty it. No assertion changed. The file's own open EV010 row (H2) is
untouched. The pre-fix failure, from the scan that had lost its only finding, serves as the
mutation probe. The file passes 36 of 36 tests on Bun and on Node.

## Exceptions re-checked

Only one touched file holds an exception: `person-match-portability.test.ts:262` EV002. Its
reason (a fresh TestConsole that starts inside the application effect, after the runner's
lifecycle logging) still holds, so it is left unchanged. All 698 exceptions are
byte-identical. The `files-command` `withReplacedPath` exception and the seven
`#1855 wave 4 register` exceptions are untouched.

## Not migrated: 127 rows

No exception was added. Each class below gives the evidence that the test needs a live
platform resource, from the memory-filesystem trial unless marked otherwise. Under S31 these
rows stay open. H1 and H6 go to #1855 as detector questions. H2-H5 are live-resource classes
for #1855's owner/exit register wave.

- **H1. The subject's type requires the CLI environment (3 rows).** Files:
  `agent-effectiveness-command.test.ts`, `ci-lane-timings.test.ts`,
  `yeet-review-window.test.ts`. All tests pass at runtime on the memory filesystem, but
  `Command.run` requires `ChildProcessSpawner | Crypto | Stdio | Terminal`, so the test
  overlay fails with TS377004 without `NodeServices`. `agent-effectiveness-command` already
  merges `MemoryFileSystem.layer` *after* `NodeServices.layer`, so its filesystem is the
  memory one. Counterexample for #1855: `Layer.mergeAll(NodeServices.layer,
  MemoryFileSystem.layer)` has proven non-native filesystem provenance and still gets a
  `platform-resource-provenance-review` row.
- **H2. The test reads the real checkout root or committed fixtures (33 rows).** The trial
  failed with `Could not find repository root (looked for .git, bun.lock)` or `NotFound` on
  a committed fixture path. Files: `agent-effectiveness-eval-scorer`,
  `architecture-operation-plan`, `cache-conformance`, `cache-conformance-lab` (committed
  corpus plus a loopback server), `check-census`, `ci-heavy-admission`,
  `ci-rerun-runner-loss`, `commitlint-config`, `coverage-turbo-inputs`,
  `create-package-identity-template`, `effect-schema-inventory-fixture`,
  `effect-vitest-contract` (from source, not trialled: `repositoryRoot` from
  `import.meta.url`), `effect-vitest-primitives`, `gate-order-handoff`,
  `knowledge-doctor-evaluators`, `knowledge-doctor-grouping`, `knowledge-refs`,
  `lint-judge-rubric`, `lint-subcommand-allowlist`, `models-locators`,
  `native-runtime-prefix`, `proof-digest`, `proof-ledger`, `runners-bake`,
  `single-project-emit`, `skills-materialize`, `skills-provenance`, `skills-relock`,
  `test-tsgo-turbo-inputs`, `yeet-command-wiring`, `yeet-merge-gate`,
  `yeet-review-body-signal`, `yeet-status-triage`.
- **H3. The subject changes the process-global working directory (16 rows).** The trial
  failed with `ENOENT ... chdir '<package>' -> '/tmp/...'`: `process.chdir` needs the
  directory on the real filesystem. Files: `ci-lane`, `effect-fn`,
  `goals-doctor-path-security`, `goals-graph`, `goals-manifest-capabilities`,
  `goals-packet-convention-migration`, `goals-set-risk-tier`,
  `identity-registration-removal`, `lab-identity-segment`, `roadmap-refs`,
  `schema-catalog`, `schema-first-parity`, `schema-topology`, `skills-command`,
  `sync-data-to-ts`, `tsconfig-sync`. `tsconfig-sync` also merges `NodeServices.layer`
  after its `MemoryFileSystem.layer`, so its filesystem is already native.
- **H4. The test spawns a live process (46 rows).** The trial failed with
  `Service not found: effect/process/ChildProcessSpawner`, or `posix_spawn 'flock'`/`'git'`/`'bun'`
  against a directory that exists only in memory. Files: `cache-baseline-merge`,
  `cache-command`, `cache-dependencies`, `cache-pilot-orchestration`,
  `corpus-preservation`, `drawings-command`, `graft-deep-refresh`,
  `jsdoc-inventory-detector-fixes`, `knowledge-doctor`, `knowledge-mint-bootstrap`,
  `knowledge-semantic-delta`, `package-verify`, `palantiri-command`,
  `process-attachment`, `proof-job`, `quality-scheduler`, `quality-tasks`,
  `step-git-exec`, `stream-console`, `tmpfs-reap` (also `/proc/locks`),
  `worktree-command`, `worktree-remove-fence`, `yeet-base-conflict`,
  `yeet-check-fidelity`, `yeet-comment-actor`, `yeet-converge`, `yeet-inbox-porcelain`,
  `yeet-inbox-view`, `yeet-monitor-ready`, `yeet-portfolio-index-guard`,
  `yeet-pr-comment-rows`, `yeet-pr-wave-notifier`, `yeet-push-ack-timeline`,
  `yeet-ready-gate`, `yeet-remediation`, `yeet-resume`, `yeet-review-fixes`,
  `yeet-scripted-process`, `yeet-watch-mode`, `yeet-wave-exempt`, `yeet-wave-rerun`,
  `yeet`. Four were classified from source and not trialled: `crux-batches.test.js` (a
  `node:test` fixture with `node:child_process`), `proof-shadow`,
  `restoration-archive-coverage` and `yeet-sweep-retire`, which spawn git or flock. Some
  files fail only one test on the memory filesystem (`stream-console` 1 of 28 here, and
  `knowledge-refs` 1 of 62 in H2), but the row sits on the import, so a single live test
  keeps it.
- **H5. A native engine, binary or timestamp is the subject (4 rows).**
  `research-history-sift` opens DuckDB on a path in the temp root (`Failed to open DuckDB
  connection`). `PracticeKg.compare` and `PracticeKg.correspondents` write DuckDB files
  (from source). `turbo-lane-digest` needs native modification times to pick the newest
  summary: under the memory filesystem it fails `newest-per-task` assertions.
- **H6. Native link or no-follow guards are the subject (6 rows).** Files:
  `corpus-provenance-index` (×2), `drawings-intake`, `test-typecheck-coverage`, `yeet-ack`,
  `yeet-economics`. `yeet-ack`, `test-typecheck-coverage` and `yeet-economics` pass on the
  memory filesystem, but their tests create real symlinks to prove that receipts, journals
  and walkers refuse or follow them. The production guards (`readContainedFileStringNoFollow`,
  `O_NOFOLLOW` opens in `Corpus`/`Drawings`) protect against operating-system links, so they
  stay native. Counterexample for #1855: a `NodeFileSystem.layer` file whose `it.layer`
  callback calls `fs.symlink` gets a `platform-filesystem-candidate` row. The same harness
  over `NodeServices.layer` would pass `harnessProvesNativeFileSystem`.
- **H7. The package does not depend on `@beep/memfs` (16 rows).** These were not trialled.
  `@beep/ciops`, `@beep/practice-identify` (×2), `@beep/box-provisioning`, `@beep/m365-mcp`
  (×3), `@beep/occt` (×3), `@beep/pdf-tools`, `@beep/effect-drizzle`,
  `@beep/technical-drawing`, `@beep/utils`, `@beep/repo-utils` and `@beep/lint-rules`. To
  migrate them, a package would need a new workspace devDependency and lockfile change, which
  is out of this wave's scope. Several are native by source: OCCT and PDF tools run native
  binaries, the m365-mcp attachment source uses `realPath`/`symlink`, and `@beep/utils`
  `FileSystem.test.ts` tests the native filesystem helpers themselves.
- **H8. Real multi-chunk streaming (1 row).** The `cli-kits` `hashFileSha256` large-file case streams 64 chunks from a real file and proves it never reads the file whole. On `MemoryFileSystem`, its 64 appends are quadratic and it timed out at 300 s on hosted Test Unit, so it stays on `NodeServices.layer`.
- **Deferred to the next wave (#2247 overlap, 2 rows).** `step-capture-lifecycle.test.ts:15` and
  `:16`.

## After the wave

`lint effect-vitest --write` was run twice, and the inventory sha256 was identical both times
(`79812a797da22fcf7424595ea65907910e0eb0f9a3cd4a1853e7876cc162922f`). It holds 944 rows: 698
exceptions and 246 open. A plain scan reports `introduced=0 resolved=0`.

Against `d46bb55e6b`, paired by `(ruleId, file, occurrence)`:

| | Rows |
| --- | ---: |
| Base | 960 (698 exceptions, 262 open) |
| Gone | 16 (all EV010, all open: 6 `platform-filesystem-candidate`, 10 `platform-resource-provenance-review`) |
| New | 0 |
| Status changed | 0 |
| After | 944 (698 exceptions, 246 open) |

That reconciles exactly: 262 − 16 = 246 open, 960 − 16 = 944 rows, and exceptions stay at 698.
EV010 open falls from 143 to 127.

After merging `main` `35faa4a00d` (#2178, the effect 4.0.6 deps sweep, which adds one open row elsewhere), the PR base holds 961 rows (698 exceptions, 263 open). The lane holds 945 (698 exceptions, 247 open): the same 16 rows gone, 0 new, 0 status changes, and two `--write` runs byte-stable.

The scan saw 2,802 files after the dependency build (2,798 before). The four extra files are
built `dist/` copies in test-kit packages, and they produce no rows.

## What remains

- EV010: 127 open rows, including the `cli-kits` large-file streaming row kept on the platform filesystem. H1 and H6 (9 rows) need #1855 detector rulings. H2-H5 (99 rows) are
  live-resource classes for #1855's owner/exit register. H7 (16 rows) needs a memory-filesystem
  dependency or a native ruling per package. 2 rows are deferred until #2247 merges.
- Next #1875 wave: wave 8, the two `step-capture-lifecycle` EV010 rows after #2247 merges, plus
  the outstanding wave 5 resource-lifetime families (EV004 50 open, EV002 52 open, EV015 17
  open), then the canon closeout.

## Verification

Route: S39/S41 Claude chain, `claude-opus-5-5` child (Claude Code Agent tool), no
cross-provider lane. Every heavy command ran alone through `beep-heavy` with stdin from
`/dev/null`. Dependency dists were built first with
`bunx turbo run build --filter=@beep/repo-cli^... --filter=@beep/law-practice-server^...`
(85 of 85 tasks, 84 cached).

| Check | Result |
| --- | --- |
| `bun run beep lint effect-vitest` | base `introduced=0`. A first pass gave `introduced=7` (EV014 on the new memory layers), fixed with hook timeouts. The final scan gave `introduced=0 resolved=20` before `--write` (17 of this wave's rows plus 3 rows from files later restored to `HEAD`), then `introduced=0 resolved=0` after it. |
| `--write` byte stability | two consecutive writes, identical sha256 `79812a79...2922f`. 960 rows to 944. |
| Exceptions | 698 before and after, reasons unchanged |
| repo-cli `bun run check` (tsconfig.check, scripts, test overlay) | exit 0 after restoring H1. The first run failed TS377004 on the three H1 files. |
| law-practice-server `bun run check` (with `tsconfig.test.json`) | exit 0 |
| `package-test-typecheck` (repo-cli, law-practice-server) | exit 0 |
| 17 touched files, Bun (`bunx --bun vitest run`) | 264 tests passed, same test names as `HEAD` |
| 17 touched files, Node (`bunx vitest run`) | 264 tests passed, same test names as `HEAD` |
| Mutation probes (Bun) | Each probe failed, and none hung. Pattern 1 (`allowlist-check`): the allowlist names a missing file. Pattern 2 (`qa-judge-skill`): the subject writes to another path. Pattern 3 (`cli-kits`): the written bytes differ from the digest oracle. `Layer.fresh` memory block (`PracticeKg.register`): one docket in the written register is changed. All files were restored byte-identical. |
| `effect-vitest-contract.test.ts` (repointed fixture), Bun and Node | 36 of 36 on each runtime |
| Coverage ratchet `bun run coverage --filter=@beep/law-practice-server` | exit 0, `coverage-ratchet ok` |
| Coverage ratchet `bun run coverage --filter=@beep/repo-cli` | first run: 7,723 passed and 3 failed, ratchet not reached. 2 of the failures were the contract-fixture defect above, now fixed. The third, `knowledge-doctor-evaluators` "reads the same packets ... as the live filesystem", is environment-only: it compares live packet files with committed state, and the diff is this lane's uncommitted `statusNote`. It passes on the pristine `HEAD` tree and with only the packet files restored. Not re-run after the fix; hosted CI is the proof. |
| `quality package-verify @beep/law-practice-server` | ok (audit 46.6s, docgen 19.8s) |
| `quality package-verify @beep/repo-cli` | audit: 7,730 passed and 1 failed, the same environment-only `knowledge-doctor-evaluators` row. Package-verify stops on that red. |
| `bun run docgen:local` | no package-local docgen inputs changed (only tests and packet files changed) |
| Biome on the changed tests | clean |
| root `lint:oxlint`; root docs oxlint (`oxlint . --config .oxlintrc.docs.json --max-warnings=0`) | exit 0, exit 0 |
| `lint:schema-first` | `missing_entries=0 stale_entries=0`, `introduced=0` |
| `quality fallow audit --base origin/main --check` | ok, 0 findings, `introduced=0` |
| `jsdoc:inventory:check` then `jsdoc:ratchet:check` | ok, `increased=0`, zero-legacy ok |
| `lint:retired-effect-paths`; `goals:doctor` | `findings=0`; OK, no new blocking findings |

## Reversal

Revert the PR. The 17 files go back to their native layers, the contract test scans `effect-vitest-store.test.ts` again, the 16 EV010 open rows return
with their previous occurrences, and the inventory returns to the base: 960 rows, 698
exceptions, 262 open (EV010 143 open). Nothing else is generated.
