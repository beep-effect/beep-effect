# memfs — round-2 merged inventory

Read `grok.md` (1 finding), `sol.md` (2), `fable.md` (9) and their adjacent `BRIEF.md`; no `part-N` reports exist. All 12 findings are accounted for, with mixed implementation/bookkeeping items split. **Required: 4 · Backlog: 8 · Codemod: 2 · Rejected: 0 · Groups: 2.**

Seat commit: `a12bef261998d2ad92153dada46373be06950692`. Pinned oracle: `~/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/memfs`. Live checkout: `@lab/effected-2` at `2f515ae2519cc72223c94917019bf7ebfe92a4a5`, with no tracked memfs source/test diff against the seat commit. This merge reads history and source; it performs no test, compiler, gate or ledger run.

The complete operator revision block, D1–D20, §12.5 and §14 bind these dispositions. Documentation, JSDoc, coverage and canon stay backlog under the merge instruction's S2/S3 deferral. History checks precede required restorations. Both live and seat-commit allowlists have **zero memfs entries**, so no `allow-*` findings are added; round 1's three replaced entries are not reissued. Central bookkeeping remains outside dispatch. `g1` owns one source file and two regression files; `g2` owns only FileSystemContract.ts. Every write surface is non-overlapping.

## Required

### grok-2-1
- file: scratchpad/effected/memfs/internal/volume.ts:709
- class: bug   severity: required
- standard: D9, D11; §11.1 and §14; pinned oracle `src/internal/volume.ts:704–707`.
- evidence: Grok supplies the concrete public witness `writeFile("/missing/.", bytes)` with the default `w` flag: absent-parent resolution reaches `resolveParent`, then `validateEntryName`, which fails with typed `InvalidData` without an errno cause. `withOperationError` forwards this to `withSystemErrorPath`, whose `O.getOrThrow(O.filter(O.some(error.reason.cause), S.is(ErrnoException)))` throws. Allocation failure from `allocateBytes` supplies a second typed, non-errno `BadResource` path. Oracle and S1 `64cbf8dc39` preserve non-errno causes; `bdca1c58e5` deletes that fallback. Fable independently lists the deletion in fable-2-2 but incorrectly calls it unreachable; Grok's caller-level witness supersedes that safety claim. Coverage can execute the same line with an errno cause without exposing this hole.
- failure: A typed PlatformError becomes a fiber defect, escaping typed `Effect.catch` handling and losing the oracle's InvalidData/BadResource result.
- fix: Restore the oracle's conditional cause passthrough: reconstruct with `ErrnoException.from(code, path)` only when `S.is(ErrnoException)(cause)` succeeds; otherwise preserve the original cause, including undefined. Retain the law-forced tagged error and schema guard. In `internal/volume.coverage.test.ts`, add a regression for `/missing/.` that asserts the typed InvalidData reason, writeFile method, caller path and description and excludes defects. Cover a deterministic non-errno allocation failure without a real huge allocation if a local seam permits it.
- seats: grok-2-1, fable-2-2 (cause-passthrough deletion only; safety assertion superseded)
- group: g1

### sol-2-1
- file: scratchpad/test/memfs/FileSystemContract.ts:400
- class: test   severity: required
- standard: D9; §11.1 forbids weakening upstream tests; later operator ruling restores unforced lab changes and rewritten upstream test lines.
- evidence: Oracle `__test__/FileSystemContract.ts:387–394` creates and inspects the unscoped directory inside an inner `Effect.scoped`, returns its path, then inspects it after that scope closes. The lab has two consecutive stat assertions without the inner scope. Sol's reported mutation probe registers erroneous makeTempDirectory cleanup on the ambient scope: the lab sequence succeeds, while the oracle sequence fails with NotFound. The step-2/S1 diffs retain the original scope; the actual removal is the `bdca1c58e5` S3 checkpoint hunk, with no law, diagnostic or ruling requiring it. Canon migration does not authorize dropping lifecycle assertions.
- failure: Incorrect scoped cleanup of an unscoped temporary directory now passes the shared filesystem contract; line coverage cannot detect the lost scope boundary.
- fix: Restore the upstream inner `Effect.scoped` around makeTempDirectory, the first stat assertion and the returned directory path. Leave the second stat assertion outside it. Preserve import rewrites and independent, forced assertion migrations. The test's original lifecycle meaning must be restored rather than recorded as an accepted deviation.
- seats: sol-2-1
- group: g2

### sol-2-2
- file: scratchpad/effected/memfs/internal/volume.ts:644
- class: schema   severity: required
- standard: D5, D11; standards/effect-laws-v1.md laws 17 and 19; operator step 4 schema identities.
- evidence: `isOpenFlag` is a named handwritten type predicate enumerating ten literals; `openDescriptorUnlocked:1577` uses it to validate runtime input before `openMode` interprets the same domain. Effect FileSystem supplies a type-only OpenFlag union, not a runtime schema. The existing green law scanners do not enforce predicate-to-schema ownership; the source still contains the independent literal enumeration.
- failure: A reused runtime constraint has no executable schema and separately maintains the open-flag domain, contrary to the schema-first law.
- fix: Define an internal identity-annotated OpenFlag `LiteralKit` with exactly r, r+, w, wx, w+, wx+, a, ax, a+ and ax+; derive `isOpenFlag` through `S.is(OpenFlag)`. Preserve the accepted set and current BadArgument behavior. Extend the existing open-flag regressions in `internal/volume.coverage.test.ts` to exercise accepted flags and rejected runtime input through the sanctioned deliberatelyInvalid helper. No public export or configuration edit is necessary.
- seats: sol-2-2
- group: g1

### fable-2-1
- file: scratchpad/effected/memfs/internal/volume.ts:403
- class: perf   severity: required
- standard: D11 permits measured regression or algorithmic-class evidence; D9; schema-derived tagged-union narrowing.
- evidence: The seat reports a read-only 2,000-entry/300-iteration probe: full `S.is(DirectoryInode)` costs 1325.3 microseconds/call versus 0.3 for a discriminant check; chmod on `/sub/g` costs 1363.3 microseconds/op. Independently of those reported measurements, DirectoryInode contains a HashMap schema, so a structural guard visits directory entries, while the oracle's kind check is constant time. Full kind guards occur at :403, :515, :696, :1057, :1634/:1643 and :2947, introduced by `bdca1c58e5`. The Effect TaggedUnion API exposes a typed discriminant-only `isAnyOf`; the existing InodeEntry already provides that API. Gate success does not enforce cost scaling. Measurements are seat evidence, not a benchmark rerun by this merger.
- failure: Metadata updates, descriptor operations and inspection walks repeatedly traverse and validate unrelated inode contents, introducing O(k) work into formerly O(1) kind discrimination and amplifying whole-tree walks.
- fix: Replace the listed internal inode-kind `S.is(DirectoryInode)`/`S.is(FileInode)` guards with `InodeEntry.isAnyOf(["Directory"])`/`InodeEntry.isAnyOf(["File"])` against the already-typed InodeEntry values. Retain typed narrowing and invariant checks, and keep `S.is(ErrnoException)` for unknown error causes. Preserve inode construction and validation boundaries; the seat's optional object-literal construction proposal is not part of this required fix. Add high-fanout directory, descriptor-operation and inspection-order regressions in `internal/volume.coverage.test.ts` and `VolumePathsOrder.test.ts`; assess scaling without a machine-sensitive timing threshold.
- seats: fable-2-1
- group: g1

## Backlog

### fable-2-2
- file: scratchpad/effected/memfs/internal/volume.ts:308
- class: docs   severity: backlog
- standard: §11.3 and §14 accounting; documentation/coverage deferral in the merge instruction.
- evidence: The seat lists deleted fallback/error arms in getInode, attachDirectory, detachEntry, getOpenFile, openDescriptorUnlocked, closeDescriptorUnlocked, fileInfo, withSystemErrorPath, makeDirectory and copy, and asks for invariant comments and a simplification record. The actual removals are in the `bdca1c58e5` S3 diff. Its withSystemErrorPath safety assertion is disproved and merged into grok-2-1; the remaining sites have no concrete reachable failure in this report.
- failure: Safe simplifications and several O.getOrThrow invariants are under-explained. This accounting concern does not prove that every removed branch must be restored.
- fix: During the documentation/coverage pass, add concise source invariant comments where warranted and centrally account for authorized unreachable-branch simplifications. Exclude the erroneous withSystemErrorPath simplification, which grok-2-1 restores. PORT_LEDGER.json and README Port-notes bookkeeping remain central.
- seats: fable-2-2 (remaining documentation/invariant-accounting portion)
- backlog reason: Documentation/coverage deferral; ledger and Port-notes edits are outside the port's write surface for repair groups.

### fable-2-3-docs
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:31; scratchpad/effected/memfs/index.ts:26; scratchpad/effected/memfs/README.md:289
- class: docs   severity: backlog
- standard: D4; carried prose accuracy; documentation deferral.
- evidence: NodeSync now obtains node:fs through `process.getBuiltinModule`, while README and index prose still describe it as importing node:*; the report supplies the exact adapter and prose sites. The missing native-runtime deviation record is separately assigned to codemod-native-runtime below.
- failure: API prose describes the former static import shape.
- fix: During the prose pass, describe NodeSync's node:fs builtin-registry access accurately in README API prose and index package documentation. Preserve the adapter behavior; this report supplies no behavior bug in the replacement itself.
- seats: fable-2-3 (prose portion)
- backlog reason: Documentation deferral; central deviation accounting is not a source repair.

### fable-2-4
- file: scratchpad/test/memfs/NodeSyncFileSystem.coverage.test.ts:11
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md EV010; §11.1; vitest-canon deferral.
- evidence: The test reaches node:fs through `process.getBuiltinModule` and spies on accessSync/statSync, without an EV010-equivalent exception or a reason comment. The EV010 detector scans import specifiers and misses this route; the integration oracle records a reason for its static node:fs use.
- failure: Canon accounting omits the host-builtin dependency and the justification for platform-adapter spies.
- fix: During canon work, add a one-line local reason that the subject is the node:fs adapter and no Effect service seam exists to stub; record the EV010-equivalent exception through the central canon/ledger owner. Do not dispatch an edit to the module's repo-level canon registry or PORT_LEDGER.json.
- seats: fable-2-4
- backlog reason: Vitest-canon deferral; registry/ledger edits are outside the port's write surface.

### fable-2-5
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:462; scratchpad/effected/memfs/MemoryFileSystem.ts:1129; scratchpad/effected/memfs/README.md:105; scratchpad/effected/memfs/README.md:228
- class: docs   severity: backlog
- standard: D4; .patterns/jsdoc-documentation.md accurate API prose; documentation/JSDoc deferral.
- evidence: Four current prose sites still name RangeError although `internal/faults.ts:79` throws UnknownFaultKeyError and Handle/Ports tests assert that class. This carries forward the still-open round-1 back-4 concern rather than reopening a closed required item.
- failure: Consumers are told to catch an error class that the law-forced implementation no longer throws.
- fix: During S2 prose work, replace these RangeError references with UnknownFaultKeyError, retaining InvalidFaultCountError where failTimes is the subject. Keep the typed-error implementation and centrally generated deviation entry.
- seats: fable-2-5
- backlog reason: Documentation/JSDoc deferral.

### fable-2-6-values
- file: scratchpad/effected/memfs/index.ts:53
- class: schema   severity: backlog
- standard: D2 superset rule; D5 executable contracts; D11 limits required findings.
- evidence: MemoryFileSystem.ts exports six executable seed/stat schemas, but the barrel re-exports their type facets. The original public type exports still exist. The report supplies no missing upstream value export, runtime failure or standard requiring every new implementation-file schema to be added to the barrel.
- failure: Barrel consumers lack convenient access to these additional runtime schemas; this is an API expansion opportunity rather than demonstrated upstream export loss.
- fix: Consider re-exporting the value facets of MemoryFileSystemVolumeStat, MemoryFileSystemSeedFile, MemoryFileSystemSeedDirectory, MemoryFileSystemSeedSymlink, MemoryFileSystemSeedEntry and MemoryFileSystemSeed, with a barrel regression in Exports.test.ts. Added-export bookkeeping is handled by codemod-added-exports, not a repair group's ledger or Port-notes edit.
- seats: fable-2-6 (barrel-value proposal)
- backlog reason: Outside D11: no required upstream value export or mandatory barrel contract is shown.

### fable-2-7
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1247; scratchpad/effected/memfs/internal/volume.ts:308; scratchpad/effected/memfs/internal/volume.ts:1982
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md laws 21/22; D11 requires a demonstrated violation or measured/algorithmic performance evidence.
- evidence: layerFaulty uses a one-yield generator as a Layer.effect argument; getInode already uses Effect.fnUntraced and retains unused method/path parameters; optional chaining remains on invariant-guaranteed values. Law 22 bans reusable functions directly returning bare Effect.gen: layerFaulty returns a Layer, and getInode uses an allowed wrapper. The report supplies no measured regression for these sites and no mandate banning these particular generator/optional-chain forms.
- failure: Additional simplification is possible, but no incorrect observable behavior, actual diagnostic or violated direct-Effect.gen rule is demonstrated.
- fix: Consider mapping the FileSystem service directly in layerFaulty, simplifying getInode to Effect.sync while adjusting its private callers, and removing redundant optional chains. Preserve laziness, error behavior and fault-factory evaluation timing; measure the claimed hot-path benefit before treating it as a performance requirement.
- seats: fable-2-7
- backlog reason: Outside D11: permitted generator forms and unmeasured simplification opportunities.

### fable-2-8
- file: scratchpad/effected/memfs/internal/seed.ts:45; scratchpad/effected/memfs/NodeSyncFileSystem.ts:178
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md laws 5/21; D9; D11.
- evidence: seedVolume uses `instanceof Uint8Array`, while the NodeSync stat catch uses `instanceof Error`; Predicate has isUint8Array/isError helpers. Law 5 explicitly forbids runtime typeof comparisons, not instanceof expressions. The report demonstrates different extraction styles but no failure or mandated behavior-preserving replacement.
- failure: Guard spelling and error-message extraction are inconsistent; no actual forbidden typeof site or behavioral regression is supplied.
- fix: Consider P.isUint8Array/P.isError where their semantics preserve the oracle. Do not widen stat's Error-only message extraction to arbitrary message-bearing objects without a law-forced reason or verified upstream bug; that would change behavior under D9. Retain the current fallback stringification where required.
- seats: fable-2-8
- backlog reason: Outside D11: style preferences rather than a demonstrated violation of the cited typeof law.

### fable-2-9
- file: scratchpad/test/memfs/internal/errno.property.test.ts:8; scratchpad/test/memfs/internal/faults.property.test.ts:8; scratchpad/test/memfs/internal/ports.property.test.ts:8; scratchpad/test/memfs/MemoryFileSystem.property.test.ts:8
- class: test   severity: backlog
- standard: AGENTS.md Discovery & Reuse; §11.4 property floor; coverage/test consolidation deferral.
- evidence: Four local roundTrips helpers repeat schema-derived encode/decode, equivalence, re-encode and fcRuns(100) assertions. The seat reports no existing shared helper in @beep/test-utils or @beep/fc-runs and no failing or vacuous property.
- failure: Repeated property scaffolding can drift, but current contract checks still run.
- fix: During test consolidation, hoist the local helper into scratchpad/test/memfs/helpers.ts and import it from the four files, preserving every assertion and fcRuns. A shared cross-module/package helper would be outside the port's write surface and belongs to a separate backlog task.
- seats: fable-2-9
- backlog reason: Coverage/test consolidation deferral; no lost property contract is demonstrated.

## Handled by the deviation codemod

### codemod-native-runtime
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:31
- class: docs   severity: backlog
- disposition: handled centrally by the deviation codemod
- standard: Later operator ruling: one generated deviation entry per module per systemic class; §14 native-runtime accounting.
- evidence: fable-2-3 identifies node:fs builtin-registry access and the inline BigIntStats type without a corresponding native-runtime deviation site. This is a request to record the replacement; it supplies no concrete failure of the adapter itself.
- failure: The systemic native-runtime accounting omits NodeSync's replacement of the static node:fs import.
- fix: The central codemod adds NodeSync's builtin-registry access, rationale, source site and applicable adjusted tests to the module's native-runtime deviation record and README Port notes. The independent stale API prose remains fable-2-3-docs. No local dispatch group edits the ledger, registry or Port notes.
- seats: fable-2-3 (deviation-record portion)

### codemod-added-exports
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:203; scratchpad/effected/memfs/index.ts:53
- class: schema   severity: backlog
- disposition: handled centrally by the deviation codemod
- standard: D2 added-export accounting; later operator ruling: law-derived additions go to exportsAdded, generated per module/class.
- evidence: fable-2-6 identifies six seed/stat schema value facets introduced by schema-first conversion, while the ledger and README Added-exports table list only the two public error classes. The barrel-value expansion proposal is separately evaluated as fable-2-6-values.
- failure: Existing law-derived value exports and any later accepted barrel additions need accurate added-export accounting.
- fix: The central codemod inventories MemoryFileSystemVolumeStat, MemoryFileSystemSeedFile, MemoryFileSystemSeedDirectory, MemoryFileSystemSeedSymlink, MemoryFileSystemSeedEntry and MemoryFileSystemSeed at their actual export surfaces and records their value/type facets in exportsAdded and README Port notes. Do not imply that optional barrel-value additions have already landed.
- seats: fable-2-6 (added-export accounting portion)

## Rejected

None. Every seat finding supplies evidence and a concrete fix; mixed suggestions outside D11 or deferred stages are backlog rather than wholesale rejections. Fable's incorrect non-errno-unreachability assertion is superseded inside grok-2-1, and neither native-error restoration nor a repo-level repair is assigned.

REQUIRED: 4  BACKLOG: 8  CODEMOD: 2  REJECTED: 0  GROUPS: 2
