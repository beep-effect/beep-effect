### fable-2-1
- file: scratchpad/effected/memfs/internal/volume.ts:403
- class: perf   severity: required
- standard: D11 (measured regression versus upstream); standards/effect-laws-v1.md law 21 (tersest equivalent form); AGENTS.md derived-guard preference is satisfied by the kit's own `isAnyOf`   evidence: `S.is(DirectoryInode)` / `S.is(FileInode)` are used as inode-KIND guards at volume.ts:403 (inodeUpdateEvents, every Update event from File.write/chmod/chown/utimes/truncate/copyFile-overwrite), :515 (attachDirectory), :696 (getOpenFile, every File.read/write/seek/truncate/stat), :1057 (containsDirectory, per visited directory), :1634/:1643 (open-create) and :2947 (collectEntrySnapshots, every Volume.paths/snapshot/entries). Upstream checked `findInode(...)?._tag === "Directory"` (O(1)). `S.is` on these structs is a full structural decode: `Schema.HashMap` (reference Schema.ts:14669) re-decodes every entry through `ArraySchema(Tuple([key, value]))` and re-materialises the map with `HashMap_.fromIterable`, plus four DateTimeUtc and six Finite checks. Read-only bun probe against the lab `make` (root seeded with k=2000 files, 300 iterations): `S.is(DirectoryInode)` on the root = 1325.3 us/call vs `_tag` check 0.3 us; `fs.chmod("/sub/g")` = 1363.3 us/op (the root guard is ~97% of it; the remaining resolve+collectInodePaths walk over 2001 inodes is ~38 us); `fs.chmod("/f1")` = 2129.6 us/op; with k=0 the guard still costs 5.1 us vs 0.3 us (17x) on the per-descriptor `getOpenFile` path. The cost scales linearly with the root's entry count on every update-event publication and every inspection walk.
- failure: Every metadata update, descriptor operation and inspection-view walk pays an O(k) re-decode plus an O(k) HashMap allocation that upstream never performed; at 2000 root entries an update becomes ~35x slower than the engine's own resolve-and-walk work, and the inspection view (`paths()`/`snapshot()`) regresses the same way.
- fix: Replace the kind guards with the tagged-union kit's discriminant-only narrowing guard: `O.filter(HashMap.get(state.inodes, RootInode), InodeEntry.isAnyOf(["Directory"]))` (and `InodeEntry.isAnyOf(["File"])` at :696/:1634/:1643), which is typed `value is Extract<..., { _tag: "Directory" }>` and checks only `_tag` (reference Schema.ts:6516-6518). Keep `S.is(ErrnoException)` (instanceof, O(1)). Optionally construct inodes with object literals typed `satisfies FileInode` instead of `InodeEntry.cases.*.make` on the create paths (:428/:457/:486), which pay the same ~5 us validation per inode.

### fable-2-2
- file: scratchpad/effected/memfs/internal/volume.ts:308
- class: docs   severity: backlog
- standard: scratchpad/EFFECTED_PORT_GOAL.md section 11.3 (unreachable branch: simplify and record it); section 14 / D9 bookkeeping   evidence: S3 removed about ten defensive branches from the engine: getInode's typed NotFound (now `O.getOrThrow`, :308-310), attachDirectory's AlreadyExists and "Cannot attach this directory" PermissionDenied (:505-516, `permissionDenied` helper deleted), detachEntry's ENOTEMPTY arm (:813-826, `recursive` now `_recursive`), getOpenFile's EISDIR arm (:696), openDescriptorUnlocked's folded-match `continue` and linkInode AlreadyExists retry (:1629-1643), closeDescriptorUnlocked's idempotent close (:1693-1701), fileInfo's SymbolicLink size arm (:1724), withSystemErrorPath's and makeDirectory's non-ErrnoException cause passthrough (:709-711, :935), and copy's dead `changed` flag (:1545). I checked each against the engine's invariants (single-writer `mutate`, inode retention while nlink/openCount > 0, `resolve` never returns a SymbolicLink when following, remove's ERR_FS_EISDIR gate, validateCopyDirectoryContents before mutation) and found no observable behaviour change, but neither README Port notes nor the ledger `deviations` mention the simplification class; several `O.getOrThrow` sites carry no comment naming the invariant they rely on.
- failure: A reader (or the next reviewer) sees defect-raising `O.getOrThrow` sites and deleted error arms with no record of why they are safe; the port's accounting for section 11.3 simplifications is incomplete.
- fix: Add one `unreachable-branches` entry to the ledger row and the README Port notes listing the sites above and the invariant each relies on, and add a one-line invariant comment at the uncommented `O.getOrThrow` sites (:403, :696, :709, :935, :1057, :1694, :1699).

### fable-2-3
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:31
- class: docs   severity: backlog
- standard: D9 / section 14 bookkeeping; README Port notes Deviations (native-runtime entry); standards/effect-laws-v1.md law 7 allowlist contract as superseded by the 2026-10-09 ruling   evidence: Upstream `import * as NFS from "node:fs"` became `const NFS = process.getBuiltinModule("node:fs")` plus an inline `import("node:fs").BigIntStats` type at :122. This bypasses the no-native-runtime NODE_RUNTIME_IMPORTS scan (Laws/NoNativeRuntime.ts:87) rather than carrying an allowlist entry, matching the operator ruling that removed effected allowlist exceptions and the repo's own `repo-run/DirectoryHandle.ts:29` precedent, but it is recorded nowhere: the `native-runtime` ledger row and README deviation do not name NodeSync, README.md:289 still says the module is "the only one importing `node:*`", and index.ts:26-28 repeats the old framing.
- failure: The module no longer has a static node:fs import edge (knip/bundlers/the law scanner cannot see it) and the carried prose describes the upstream import shape; the deviation ledger misses one native-runtime site.
- fix: Extend the native-runtime deviation (ledger `deviations` + README Port notes) with the NodeSync builtin-registry access and the reason (adapter over node:fs sync, no allowlist route), and reword README.md:289 and index.ts:26-28 to say it reaches node:fs through `process.getBuiltinModule`.

### fable-2-4
- file: scratchpad/test/memfs/NodeSyncFileSystem.coverage.test.ts:11
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md EV010 (node builtins in tests) and the module's .canon-exceptions.json ledger; scratchpad/EFFECTED_PORT_GOAL.md section 11.1 (vi.mock-class doubles kept in S3 need a one-line reason comment and a ledger backlog row)   evidence: `const node = process.getBuiltinModule("node:fs")` followed by `vi.spyOn(node, "accessSync" | "statSync")` reaches and mutates the host builtin without an import, so the EV010 detector (EffectVitestDetectors.ts:482 matches import specifiers only) never fires and no exception row exists, whereas `integration/node-sync.int.test.ts:8` records its node:fs use with a reason. The spies are vi.mock-class doubles over a module with no service seam, yet the file carries no reason comment and the ledger has no row for them.
- failure: The canon inventory under-reports the module's platform-bound tests, and the one legitimate spy-based double in the suite is undocumented, so the gate's 32 ledgered exceptions are not the full set.
- fix: Add a one-line reason comment above line 11 (the subject is the node:fs adapter itself; no Effect seam exists to stub) and record the file as an EV010-equivalent exception (`.canon-exceptions.json`) plus a ledger backlog row, as the integration tests do.

### fable-2-5
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:462
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md hard requirements (accurate lead description); round-1 back-4 (deferred to S2; ledger note 16:17Z records S2 green)   evidence: After the typed-error conversion the prose still names `RangeError` at MemoryFileSystem.ts:462 (`withFaults` doc: "unknown-key `RangeError`"), :1129 (`makeFaulty`: "a `RangeError` names any other key"), README.md:105 and README.md:228, while the code throws `UnknownFaultKeyError` (faults.ts:79) and the tests assert that class (Handle.test.ts:302, Ports.test.ts:196-204).
- failure: Public docs tell a consumer to catch an error class the port never throws; the S2 pass closed with the round-1 backlog item unapplied.
- fix: Replace the four `RangeError` mentions with `UnknownFaultKeyError` (and keep `InvalidFaultCountError` where `failTimes` is meant).

### fable-2-6
- file: scratchpad/effected/memfs/index.ts:53
- class: schema   severity: backlog
- standard: D2 (Added exports listed under Port notes; exportsAdded); D5 (identity-annotated executable schemas as the end state); standards/ARCHITECTURE.md Schemas Are Executable Contracts   evidence: Round 1 turned `MemoryFileSystemVolumeStat`, `MemoryFileSystemSeedFile`, `MemoryFileSystemSeedDirectory`, `MemoryFileSystemSeedSymlink`, `MemoryFileSystemSeedEntry` and `MemoryFileSystemSeed` into `export const` schemas in MemoryFileSystem.ts, but index.ts:53-62 re-exports only their `type` facet, so the barrel exposes no runtime schema for them; the ledger `exportsAdded` and the README Added-exports table list only the two error classes. The property tests reach the values only by importing MemoryFileSystem.ts directly.
- failure: An entry-point consumer cannot decode or guard a seed/stat payload with the executable contract the port now owns, and the added-export bookkeeping omits six value facets.
- fix: Drop the `type` modifier for those six names in index.ts and add six `kind: "both"` rows to the ledger `exportsAdded` and the README table (or record in Port notes why the value facets stay module-private).

### fable-2-7
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1247
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md laws 21 and 22 (tersest equivalent helper form; generators for reusable functions)   evidence: `layerFaulty` builds `Effect.gen(function* () { const base = yield* FileSystem.FileSystem; return wrapFaulty(base, faults); })` whose only work is one yield and a map. volume.ts:308 `getInode` is an `Effect.fnUntraced` generator that never yields (`return state.inodes.pipe(HashMap.get(inode), O.getOrThrow)`) and keeps the now-unused `_method`/`_path` parameters, allocating a generator on the hottest engine path (every resolve component, every getDirectory). volume.ts:1982 (`child?._tag`) and the glob walk (`entry?._tag`) keep optional chaining on values that `O.getOrThrow` already made non-optional.
- failure: Residue from the branch removals: needless generator allocation and dead parameters on the hot path, and a layer body that is a `map` spelled as a generator.
- fix: `Layer.effect(FileSystem.FileSystem, Effect.map(Effect.service(FileSystem.FileSystem), (base) => wrapFaulty(base, faults)))`; make `getInode` a plain `(state, inode) => Effect.sync(() => ...)` (or inline `HashMap.get` + `O.getOrThrow` at callers) and drop the two dead parameters; remove the `?.` at :1982 and in the glob loop.

### fable-2-8
- file: scratchpad/effected/memfs/internal/seed.ts:45
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 5 (Predicate guards over runtime type tests) and law 21; effect/Predicate exposes `isUint8Array` (reference Predicate.ts:1273) and `isError` (:1242)   evidence: seed.ts:45 keeps `entry instanceof Uint8Array` next to `P.isString(entry)`; NodeSyncFileSystem.ts:178 keeps `err instanceof Error ? err.message : String(err)` in the `stat` conversion catch while `fail` at :104, two functions above, extracts the same description with `P.hasProperty(err, "message") && P.isString(err.message)`.
- failure: Two remaining native type tests in a module otherwise converted to Predicate guards, and two different message-extraction rules for the same error shape inside one file.
- fix: `P.isUint8Array(entry)` at seed.ts:45; reuse `fail`'s extraction (or `P.isError(err) ? err.message : String(err)`) at NodeSyncFileSystem.ts:178.

### fable-2-9
- file: scratchpad/test/memfs/internal/errno.property.test.ts:8
- class: test   severity: backlog
- standard: AGENTS.md Discovery & Reuse; .patterns/testing-patterns.md shared helpers; section 11.4 property floor   evidence: The `roundTrips` helper (Arbitrary.schema -> encodeEffect -> decodeEffect -> `S.toEquivalence` -> re-encode equality, with `fcRuns(100)`) is pasted verbatim into errno.property.test.ts:8, faults.property.test.ts:8, ports.property.test.ts:8 and MemoryFileSystem.property.test.ts:8 (and the same body recurs across the other scratchpad modules' property tests). No shared helper exists in `@beep/test-utils` or `@beep/fc-runs`.
- failure: Four copies of the module's D10 property contract that will drift independently when the assertion (for example the equivalence or re-encode step) needs changing.
- fix: Hoist `roundTrips` into scratchpad/test/memfs/helpers.ts (or a shared scratchpad/test helper usable by every module) and import it from the four files.

REQUIRED: 1
BACKLOG: 8
