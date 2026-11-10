# Agent memory store: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-10: Bun-only suites pass green under Node by skipping

- **Doing:** P1 live MemoryLog layer and its tests (lane agent-memory-store-p1).
- **Evidence:** `bunx vitest run` in the store package reports
  `Test Files 9 passed | 1 skipped`, `Tests 80 passed | 11 skipped`: the
  MemoryLog suite needs `bun:sqlite` (through `@beep/sqlite`) and is skipped
  under Node. Only `bunx --bun vitest run` executes it (11 passed). The
  package `test` script uses `--bun`, but the `coverage` script and a plain
  `bunx vitest` do not, and a skipped suite reads as green.
- **Would have prevented it:** a test-runner or lint check that fails when a
  package whose dependencies reach `bun:sqlite` runs a suite under Node and
  skips every test in it, or a package flag that makes its tests Bun-only.

## 2026-11-10: test assertions must not `yield*` inside `expect(...)`

- **Doing:** the same suite.
- **Evidence:** the package test type check rejects `expect(yield* log.heads(n))`
  with `effect(yieldInCallArgument)` and `Effect.provide(Layer)` in a test
  with `effect(strictEffectProvide)`; about 30 assertions were rewritten to
  bind each read to a `const` first, and per-test databases moved from
  `Effect.provide` to `Layer.build` in the test scope.
- **Would have prevented it:** a short note in the effect-vitest test
  checklist that per-test layers are built with `Layer.build` and that read
  results are bound before `expect`.

## 2026-11-10: two SQLite connections in one Bun process deadlock on a busy lock

- **Doing:** the AC-1 concurrent-insertion test of the Markdown projector
  (lane agent-memory-store-p1), two `MemoryLog` connections to one database
  file appending about 2,900 inserts each with `Effect.all(..., { concurrency: 2 })`.
- **Evidence:** the second append failed after the busy timeout with
  `SqlError/LockTimeoutError ... SQLiteError: database is locked` (`SQLITE_BUSY`).
  bun:sqlite waits for a busy lock synchronously, so once the first
  connection's transaction yields between handler statements, the second
  connection's `BEGIN IMMEDIATE` blocks the one thread the first needs to
  commit. Small batches finish before they yield, which is why the MemoryLog
  two-connection test passes. The projector test now commits the two
  writers one after the other against one base.
- **Would have prevented it:** a note on the `@beep/sqlite` driver that
  several connections in one process must not interleave write transactions,
  or a driver option that serializes them in process.

## 2026-11-10: @effect/vitest drops Effect logs and it.layer timeouts do not reach tests

- **Doing:** measuring the AC-1 suites (edit count, 3/n bound, reparse
  refusals, wall times).
- **Evidence:** `Effect.log` and `Effect.logInfo` lines inside `it.effect`
  never reach the vitest output, so the measured numbers needed an opt-in
  report file (`BEEP_TEST_AGENT_MEMORY_REPORT`); and `it.layer(layer, { timeout:
  "900 seconds" })` left the test at the default `Test timed out in 30000ms`
  until the test itself passed `{ timeout: 900_000 }`.
- **Would have prevented it:** an effect-vitest checklist line on where test
  measurements go and which timeout option applies to the test body.

## 2026-11-10: the opt-in full-tree test reads the live goals tree twice and races edits to it

- **Doing:** re-running the opt-in AC-1 full-tree test after the P1 review
  fixes (lane agent-memory-store-p1) while writing decision files under
  `goals/agent-memory-store/decisions/`.
- **Evidence:** `expected [ Array(3588) ] to have a length of 3594`: the test
  imports `goals/`, rebuilds it, then snapshots `goals/` again to compare, so
  six decision files written during the 58 s run differed from the bytes the
  log imported. A rerun with no concurrent edits passed 3,597/3,597.
- **Would have prevented it:** snapshotting the source folder before the
  import, or a note in the test header that the tree must not change during
  the run.
- **Fixed in the same change:** the test now snapshots the source right
  before the import and its header says the tree must not change during the
  run.
