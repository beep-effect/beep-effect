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

## 2026-11-12: the P2 capture brief described a BaseNode field the P0 model does not have

- **Doing:** writing op capture (lane agent-memory-store-p2) against the
  exported base.
- **Evidence:** the brief said each `BaseNode` lists "node id, revision, kind,
  text"; `src/Operation.models.ts` has `nodeId`, `revisionId` and an
  `OccurrenceAnchor` whose quote is the text, and no kind. Capture had to
  derive kinds by re-partitioning the base text (decision
  `op-capture-derives-base-kinds`) rather than read them.
- **Would have prevented it:** quoting the field list straight from the model
  file in a phase brief, or a generated field summary of each P0 model in the
  packet.

## 2026-11-12: Effect language-service rules fire on unexported-looking test helpers

- **Doing:** writing the op capture test harness
  (`test/OperationCapture.support.ts`).
- **Evidence:** the package test type check (`tsconfig.test.json`) failed with
  `TS377101 missingPipeableSignature` on every exported two-or-more-argument
  helper, `TS377050 missedPipeableOpportunity` on
  `assertNone(Result.getOrThrow(captureBatch(...)))` and `TS377032
  strictEffectProvide` on `Effect.provide(Digest.layerWebCrypto)` inside a test;
  three rounds of edits to helpers that only tests call.
- **Would have prevented it:** a short "test helper shapes" line in the
  effect-vitest checklist (single-object parameters or `dual`, `layer(...)`
  instead of `Effect.provide`), or relaxing the pipeable rule for `test/**`.

## 2026-11-12: the schema-first gate's reach into src/internal is only knowable from its source

- **Doing:** writing the admission layer's internal read model
  (`src/internal/AdmissionLog.ts`, lane agent-memory-store-p2).
- **Evidence:** the first draft exported plain `interface NodeState` and
  `interface HoldRecord` from an `@internal` module. The repo-wide
  `lint schema-first` scan is outside a package lane's command budget, so the
  only way to learn that exported data-like interfaces count even under
  `src/internal/` was reading `SchemaFirstScan.ts` and `SchemaFirstDetectors.ts`
  in the CLI package; both became `S.Opaque` classes before any run.
- **Would have prevented it:** a package-scoped mode of the schema-first scan
  (a `--package` filter like `lint laws` has), so a lane can run it on its own
  files.

## 2026-11-13: the adversarial replay spent its time in capture and fsync, not admission

- **Doing:** timing the AC-2 and AC-3 replay (lane agent-memory-store-p2,
  `test/admission-replay.ts`): 100 runs of 118 writes each.
- **Evidence:** the first version imported the fourteen fixture files into a
  fresh store and captured every write per run: about 3.5 s a run, 350 s in
  all. Admission itself measured 1.2 ms an operation (100 replaces in one
  batch: 119 ms); op capture cost about 10 ms a write, because it partitions
  the base file again on every call (`baseKinds`) as well as the edited file,
  and the files run to 32,000 characters. Moving to one import, one capture
  per write and a byte copy of the database per run was then slower again
  (2.6 to 3.8 s a run) until the run copies skipped the journal and fsync
  (`PRAGMA journal_mode = MEMORY`, `synchronous = OFF`): 0.3 to 0.9 s a run on
  a loaded host, the whole file about 40 s at load average 57.
- **Would have prevented it:** a cached base partition in op capture (the
  base kinds of an export never change), and a documented way to snapshot an
  imported in-memory store for test replays instead of copying a file.
