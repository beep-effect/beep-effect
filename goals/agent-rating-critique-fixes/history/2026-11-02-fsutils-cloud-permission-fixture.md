# `FsUtils` permission fixture under uid 0 — 2026-11-02

Scope: fix the false failure of the `FsUtils` test "should fail with
DomainError when a directory mid-walk is unreadable" in cloud VMs that run as
uid 0, without weakening the non-root assertion. The lane owns only
`packages/tooling/library/repo-utils/test/FsUtils.test.ts` and this note. No
source, config, manifest, baseline, lifecycle or phase change. No new test
helper: the fault mechanism is the existing `MemoryFileSystem.layerWith(...,
{ faults })`, used the same way as `FsDenying` in
`packages/tooling/library/repo-tsconfig/test/TsconfigDiscovery.test.ts`.

Run: one Claude cloud session (uid 0), no child agents, promotional cloud
credit only. Branch `codex/fsutils-cloud-permission-fixture`, cut from a fresh
`origin/main` at `1947c120`, which contains the #2571 merge `c82db4b4`.

## Initial failure (reproduced before any edit)

`bunx vitest run test/FsUtils.test.ts` in the package, uid 0: exit 1,
`1 failed | 30 passed (31)`. The failing case was the mid-walk unreadable test.
`Effect.flip` received the success value `[]`: the glob succeeded, because root
reads a mode-000 directory. The walker's `onUnreadable: "fail"` path was never
reached, so the case could not fail as designed. #2571 recorded the same
failure, and the parent's non-root run of that head passed 239/239, so the
cause is the process identity, not the package.

## Change

1. **Deterministic, every profile.** A memory volume seeded with
   `/repo/src/a.ts` and `/repo/locked/b.ts`, whose `readDirectory` of
   `/repo/locked` fails with an injected `PlatformError.systemError`. Two
   cases:
   - `PermissionDenied`: `globFiles("**/*.ts", { cwd: "/repo", ignore:
     ["locked/**"] })` fails with `DomainError` `Glob failed for pattern
     "**/*.ts"`. The assertions are the same as the real-OS case.
   - `NotFound` (contrast): the same walk succeeds with `["src/a.ts"]`. A
     vanished directory is a benign race in `@beep/walker`. This case also
     shows the fault is reached: without it, `locked/b.ts` would be listed.
2. **Real OS case, assertions unchanged.** After `chmod 000`, a probe
   `fs.readDirectory(locked)` runs first.
   - If the read is refused, the original assertions run exactly as before.
   - If it succeeds (uid 0 or `CAP_DAC_OVERRIDE`), the test restores the mode
     and calls `ctx.skip("OS does not enforce directory read permission for
     this process (uid 0 or CAP_DAC_OVERRIDE)")`. The reporter shows it as
     **skipped (↓) with that reason**, never as passed.

   The probe tests the capability itself rather than the uid, and it needs no
   native `process` call.

## Results (cloud, uid 0)

| Run | Before (`1947c120`) | After |
| --- | --- | --- |
| `test/FsUtils.test.ts` | 1 failed, 30 passed (31), exit 1 | 32 passed, **1 skipped** (33), exit 0 |
| Package suite (`bunx vitest run --maxWorkers=1`) | not re-run here (#2571 recorded the same 1 failure) | 241 passed, **1 skipped** (242), exit 0 |

**Limits**
- The root run qualifies only the injected-fault error branch. It does **not**
  qualify real OS permission enforcement: that case was skipped here. The
  non-root real-OS replay is the parent's.
- No coverage numbers were taken.

**Other checks**
- `biome check` on the file and the package `biome check .`: clean.
- `tsrs -p tsconfig.test.json --noEmit`: clean.
- `bun run lint:laws`: 0 findings in every blocking law. One advisory
  `terse-effect` finding is pre-existing, at
  `src/schemas/PackageJsonTools.ts:318` (`nested-option-match`), in source
  this lane does not touch.
- `bun run beep quality package-verify @beep/repo-utils` (default): exit 0,
  `ok docgen 22.4s`, **`skip audit`** (no reason printed). The audit was
  skipped, so this is not an audit pass. The command runs no unit tests.

## Decisions

| Decision | Reason | Reversal |
| --- | --- | --- |
| Deterministic `readDirectory` fault through the existing memfs `faults` option. | It is the documented way to exercise permission paths ("permission modes are metadata, never enforced"), it runs identically for every user, and it needs no new helper. | Delete the two injected-fault cases and `deniedReadDirectoryLayer`. |
| Capability probe plus a visible `ctx.skip` reason for the real OS case. | A root run cannot qualify OS enforcement, so a skip with a reason is honest. Weakening or deleting the assertion would hide a non-root regression. | Remove the probe block. |
| No uid helper added. | None exists in `@beep/utils/HostProcess`, and a native `process.getuid` call is what the native-runtime law guards against. | — |

## Friction (recorded as it happened)

- **No supported in-Effect dynamic skip.**
  - Evidence: `ctx.skip(...)` inside `it.effect` works (vitest counts it
    skipped, confirmed with a throwaway probe file that was deleted). But the
    throw passes through the Effect, and the run log prints `ERROR (#795):
    Error: test is skipped; abort execution`.
  - Impact: a misleading ERROR line on a correct skip. Time impact not measured.
  - Attribution: test-runner / `@effect/vitest` defect logging. Confidence
    medium.
  - Workaround: accepted. The outcome is reported correctly as skipped.
  - Prevention: a test-runner helper for an effectful skip that does not log
    as an error.
  - Owner: unresolved (test-runner).
- **First edit missed the existing text.** I assumed `MemoryFileSystem.layerWith()`
  where the file uses `MemoryFileSystem.layer`, and the edit failed with no
  change. Impact: one retry. Prevention: read the exact line before editing.
  Owner: author lesson.
- **A stash-based before/after lint comparison was denied by permissions.**
  Nothing ran (no stash entry; working tree intact, verified). Workaround: read
  the finding's file and line instead. Prevention: compare against the base
  without mutating the work tree (for example, a read-only `git show`).
  Owner: author lesson.
- **Root identity in cloud VMs (carried over from #2571).** Prevention is now
  in the test itself. A non-root cloud user is still the broader fix. Owner:
  unresolved (cloud environment / bootstrap).
- **No `OPPORTUNITIES.md` in this goal.** The parent is consolidating friction
  as single writer (6577166488), so these receipts live in this note and a PR
  comment rather than a new ledger file. Owner: parent consolidation.
