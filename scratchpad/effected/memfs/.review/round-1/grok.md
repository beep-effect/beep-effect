I'll review the memfs port against the pinned upstream oracle and the binding decisions, and report only findings. First I'm loading the decision record, port notes, and both trees.The decision record and both trees are in place. Next I’ll read the binding rules, recorded deviations, and the ported sources against the pinned oracle.### grok-1-1
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1086
- class: bug   severity: required
- standard: D9, section 14, operator ruling 2026-10-09 (allowlist a native-runtime site when moving it would change a public contract)   evidence: Upstream `failTimes` throws `new RangeError(...)` (`packages/memfs/src/MemoryFileSystem.ts:1056`) and `__test__/FaultInjection.test.ts:295` asserts `RangeError`. The port throws `InvalidFaultCountError` and `scratchpad/test/memfs/FaultInjection.test.ts:307` was rewritten to expect that class. `InvalidFaultCountError` is not on the package barrel (`index.ts`). `new RangeError` is the `native-error` kind (`NoNativeRuntime.ts` `NATIVE_ERROR_CTORS`); `class extends Error` is not. README and the method JSDoc still say `RangeError`. No `deviations` row.
- failure: `MemoryFileSystem.failTimes(-1, error)` no longer throws `RangeError`. `instanceof RangeError` is false, and callers cannot name the replacement from the public entry.
- fix: Throw `RangeError` with the upstream message again, point the test back at `RangeError`, and allowlist `native-error` for this file.

### grok-1-2
- file: scratchpad/effected/memfs/internal/faults.ts:55
- class: bug   severity: required
- standard: D9, section 14, same allowlist ruling   evidence: Upstream `assertKnownFaultKeys` throws `new RangeError` (`src/internal/faults.ts:43`). `__test__/Ports.test.ts:193` and `__test__/Handle.test.ts:295` expect `RangeError`. The port throws `UnknownFaultKeyError`, and `Ports.test.ts:197` / `Handle.test.ts:299` were rewritten to match. That class is not exported from `index.ts`. README still says an unknown fault key throws `RangeError` (around the fault-injection section and `MemoryFileSystem.ts` near the `withFaults` notes). No deviation is recorded.
- failure: `syncFileSystem` / `promisesFileSystem` / `makeFaulty` with a key such as `readFileSting` throw an unexported tagged error instead of `RangeError`.
- fix: Throw `RangeError` with the same message again, restore the `RangeError` assertions, and allowlist `native-error` on `internal/faults.ts`.

### grok-1-3
- file: scratchpad/effected/memfs/internal/errno.ts:83
- class: bug   severity: required
- standard: D9, section 14; README “the `cause` carries only `code` (and `path`)”   evidence: Upstream `ErrnoException extends Error` with `code` and `path` only (`src/internal/errno.ts:95`). The port extends `Data.TaggedError("ErrnoException")`, so every errno `PlatformError` cause gains `_tag: "ErrnoException"`, YieldableError iteration, and a tagged `toJSON`. `native-runtime` flags `new Error` / `new TypeError` / `new RangeError`, not `class extends Error`, and this file is already allowlisted for `native-error` (`EFFECTED-MEMFS-NODE-ERRNO`) because a tagged error would add `_tag`. `ErrnoParityContract.ts` only asserts `cause.code`, so the extra field is invisible to the gate. Deviations list is empty.
- failure: `reason.cause` on engine failures is no longer a plain `Error` with `code` and `path`. Consumers that read `cause._tag`, spread the cause, or compare it to the upstream shape see `ErrnoException`.
- fix: Restore `class ErrnoException extends Error` with the upstream constructor (`code`, `path`, message). Leave `nodeErrno`'s `new Error` on the existing allowlist.

### grok-1-4
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:165
- class: bug   severity: required
- standard: D9; node-sync differential comment (“the node error rides as `cause`”)   evidence: Upstream builds `Object.assign(new TypeError(...), { code: "ERR_INVALID_ARG_TYPE" })` (`src/NodeSyncFileSystem.ts:135`). The port substitutes `InvalidPathArgumentError`, an `S.TaggedError` with `name` forced to `"TypeError"`. `instanceof TypeError` is false and `_tag` is `"InvalidPathArgumentError"`. `failureShape` in `integration/node-sync.int.test.ts:43` compares `cause.code` and `cause.syscall` only, so the gate stays green.
- failure: A non-string `readFile` path fails `Unknown` / `ERR_INVALID_ARG_TYPE`, but `reason.cause` is not the `TypeError` the node adapter puts there.
- fix: Restore the `TypeError` plus `code` assignment, and allowlist `native-error` on `NodeSyncFileSystem.ts`.

### grok-1-5
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:129
- class: bug   severity: required
- standard: D9   evidence: Upstream `readOnly` is `new Error(\`NodeSyncFileSystem is read-only: ${member} is not supported\`)` (`src/NodeSyncFileSystem.ts:103`). The port dies with `ReadOnlyFileSystemError`, whose prototype name is the tag. `node-sync.int.test.ts:181` only checks `Cause.hasDies`, not the defect value. `new Error` is `native-error` and can be allowlisted; replacing it is not required by the law.
- failure: Write-path defects squash as `ReadOnlyFileSystemError: ...` and carry `_tag`, not as `Error: NodeSyncFileSystem is read-only: ...`.
- fix: Restore `new Error` with the upstream message and allowlist `native-error` on this file.

### grok-1-6
- file: scratchpad/effected/memfs/internal/ports.ts:153
- class: bug   severity: required
- standard: D9   evidence: Upstream `withFaults` copies the port with `Object.assign` and assigns the intercept (`src/internal/ports.ts:133`), which is enumerable, writable, and configurable. The port replaces that with `Object.defineProperty(out, name, { value })`. Those descriptors default to non-enumerable, non-writable, non-configurable. No law requires `defineProperty` here.
- failure: After `syncFileSystem(volume, { faults: { readFile } })`, `Object.keys` omits `readFile`, object spread drops it, and a second `withFaults` built from that result loses the method. In this ESM module, assigning over the faulted method throws `TypeError`.
- fix: Assign the intercept the way upstream does (`out[name] = ...`), or pass `enumerable: true, writable: true, configurable: true`.

### grok-1-7
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1037
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, section 16 (no `@example` / `@remarks`); brief S2 rule   evidence: Exported members still use `@remarks` and `@example` (first pair on `failTimes`; the same carriers run through `MemoryFileSystem.ts`, `NodeSyncFileSystem.ts`, and `index.ts`). S2 has not run, so this stays backlog.
- failure: Docgen’s beep carrier grammar is not met yet. Bodies are still present.
- fix: Leave it for the S2 carrier pass (`**Example** (Title)`, `**Details**` / `**Gotchas**`).

REQUIRED: 6
BACKLOG: 1
