# #1875 Effect Vitest canon wave 19: record

Branch `claude/vitest-canon-w19` off `main` `545f9a2b31`. Scope: the fixture-field `chmod` and
claim-file class of the remaining native EV010 rows (`observation-launch-claims`,
`observation-launch-outbox`), plus `observation-file`, which reads owner metadata the same way.

## Finding: not a native subject, but a memfs fidelity gap

These suites looked native: the claim store checks owner uid, `0o700`/`0o600` modes, inode
identity, `realPath` containment and link counts. `@beep/memfs` already models all of these
(`InodeMetadata` carries `mode`, `uid` and `nlink`, and `chmod` is implemented).

The real blocker was one divergence the memfs README called deliberate: opening a directory
read-only failed at `open` with `EISDIR`. The claim store fsyncs its directories through exactly
that open (`syncDirectory`), so every claim case failed with `reason: "storage"` on the memory
filesystem. Linux allows the open, and memfs claims the Linux POSIX profile, so the right fix is
in memfs, not a detector rule.

## memfs: read-only directory descriptors

In `packages/tooling/test-kit/memfs/src/internal/volume.ts`:

- `openExistingEntry` registers a descriptor for a directory when the open is plain read-only
  (no write, append, create or truncate flag). Any other flag still fails `BadResource`/`EISDIR`
  at `open`.
- `getOpenInode` serves the handle's `stat` and `sync`, which read only the inode, so they work
  on a directory handle.
- `getOpenFile`, behind every data operation, fails a directory handle with `EISDIR`. Both
  helpers share `openDescriptorEntry`, which Fallow's duplication gate required. Node and
  Linux report the same: `readAlloc` gives `BadResource`/`EISDIR`.

Errno parity contract (`test/ErrnoParityContract.ts`): the `{ memory, node }` divergence for
"open a directory for reading" and "stream a directory" becomes one shared outcome. New cases pin
`sync` on a read-only directory handle (success), `readAlloc` from it (`EISDIR`), and an `r+`
open of a directory (`EISDIR` at `open`). Both the memory and the native implementations satisfy
every case. The README now lists two deliberate divergences instead of three.

## Test migrations

| File | Change |
| --- | --- |
| `fixtures/observation-claims.ts` | The owner uid is read from the fresh root (`fs.stat(root).uid`) instead of `process.geteuid()`, so the fixture is valid on both filesystems. The crash suites still run it natively. |
| `observation-launch-claims.test.ts` | All 7 harnesses use `MemoryFileSystem.layer` + `Path.layer`. |
| `observation-file.test.ts` | Both tests use `MemoryFileSystem.layer` + `Path.layer`. |
| `observation-launch-outbox.test.ts` | The 3 harnesses that never open the SQLite journal use the memory layer. `backend` becomes an `Effect.fn` helper (`yield* backend()`), so the 4 SQLite harnesses reach `SqliteClient.make` and the wave 18 rule accepts them. |

| `native-schedule.test.ts` | Fixes an inherited flake (from #2364) that `package-verify` caught: "reserves query delay before failed or interrupted read-back" asserts that the tick right after a failed read-back lands inside a 100 ms reconcile window on the live clock, and lost that race 1 run in 3 on a loaded host. The case now runs on its own policy with a 2 s window and 2.1 s waits. A `TestClock` version was tried; it made the shared fixture's hang wait a new EV008 row, so it was dropped. |

Assertions are unchanged. The uid the claim checks compare against is now the volume's own owner,
so the `uid + 1` and missing-owner refusals still test what they did.

## Inventory, paired by `(ruleId, file, occurrence)` against `545f9a2b31`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 452 | 440 | 12 |
| After | 449 | 440 | 9 |

Gone: 3 EV010 open rows (`observation-file`, `observation-launch-claims`,
`observation-launch-outbox`). New: 0. No exception added. No detector change.

## Still open (9)

| Class | Rows |
| --- | ---: |
| Concurrent independent processes | 1 |
| A `Deferred`-held spawner child | 1 |
| Spawned `git` | 3 |
| Real transcript discovery (`observation-worker`) | 1 |
| Unix-domain sockets | 1 |
| Node and Bun crypto plus filesystem | 2 |

## Verification

| Check | Result |
| --- | --- |
| memfs suite (`bunx vitest run`; `bun.int` under `--bun`, as its scripts run it) | 732 + 68 passed |
| The 7 ai-metrics files using the fixture or memfs, Bun and Node | 34 passed each |
| `bun run check` in memfs and ai-metrics | exit 0 |
| `bun run beep lint effect-vitest --write` | 452 → 449 rows, 0 new |
| `quality package-verify @beep/memfs` and `@beep/repo-ai-metrics` | pass (ai-metrics after the flake fix) |
| `quality fallow audit --base origin/main` | 0 introduced |
| The flaky case, 3 runs on Node, and the full file on Bun | pass |
