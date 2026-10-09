# memfs — round-1 merged inventory

Read all three reports and their adjacent BRIEF.md: `grok.md` (7 findings), `sol.md` (6), `fable.md` (15); no part-N reports exist for memfs. Seat commit: `3fa5876691901fccf3d1cd29e9324564df134b56`. The brief's pinned oracle is `~/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/memfs`.

**Required: 13 · Backlog: 9 · Codemod: 2 · Rejected: 5 · Groups: 4.** All 28 seat findings are accounted for, with overlapping defects merged, mixed findings separated, and all three memfs allowlist entries added individually. The complete operator revision block, D1–D20, §12.5 and §14 bind these dispositions; the later 2026-10-09 grilling supersedes earlier allowlist-preservation advice. S2/S3 have not run. This inventory merges the seat evidence; it does not claim a new gate run.

`required.json` is the dispatch surface. `g1` owns six connected source files and their tests; `g2` owns the barrel; `g3` owns the view; `g4` owns NodeSync. Independent portions of fable-1-6 and fable-1-7 are split by file ownership to keep the six-source-file cap. `Exports.test.ts` and `VolumePathsOrder.test.ts` are proposed new local regression files. NodeSync annotation changes require no test-file edits. Cross-group validation may read other groups' files, but may not edit them. Ledger/README Port-notes bookkeeping and standards allowlist cleanup stay central; no group owns a repo-level configuration file.

Classification notes: fable-1-15 is merged with sol-1-3 and promoted because executable domain/variant schemas have cited authoritative standards and escape the stated green gates. fable-1-11 remains backlog: law 22 permits either Effect.fn or Effect.fnUntraced, and the seat supplies no measured regression. Annotation defects concern the already-required step-4 schema contract, not deferred JSDoc. Grok's native-error restoration requests are rejected while its independent missing-export evidence is retained. Codemod work never substitutes for fixing an incorrect implementation.

## Required

### req-1
- file: scratchpad/effected/memfs/internal/errno.ts:25
- class: schema   severity: required
- standard: D5, D11; standards/effect-laws-v1.md law 19.
- evidence: The named ErrnoCode union lists 15 literals and is reused by errnoMessages, ErrnoException and engine calls. The four green runner laws do not inspect literal domains.
- failure: The errno domain has no executable schema, derived guard or annotation carrier.
- fix: Define an identity-annotated ErrnoCode LiteralKit containing exactly the upstream codes; derive the type from it and use it in the ErrnoException code field. Preserve messages and errno mapping.
- seats: fable-1-1
- group: g1

### req-2
- file: scratchpad/effected/memfs/internal/errno.ts:83
- class: law   severity: required
- standard: D5, D11; standards/effect-laws-v1.md law 7; .patterns/error-handling.md; later operator ruling on memfs errno.
- evidence: sol-1-2's probe reports S.isSchema(ErrnoException) === false. ErrnoException extends Data.TaggedError, while the scanner matches native constructor calls and therefore misses this carrier. fable-1-2 identifies construction sites at errno.ts:106 and volume.ts:713 and instanceof checks in volume.ts and MemoryFileSystem.ts.
- failure: Engine errno causes lack a schema contract and IdentityComposer annotations.
- fix: Replace Data.TaggedError with an identity-annotated S.TaggedError using the ErrnoCode schema, message and path fields; preserve current message formatting, displayed Error name, optional-path behavior and instanceof classification. Update errno.ts and volume.ts construction sites through a typed factory. Deviation recording belongs to codemod-1.
- seats: sol-1-2, fable-1-2
- group: g1

### req-3
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:469
- class: schema   severity: required
- standard: D5, D11; standards/ARCHITECTURE.md Schemas Are Executable Contracts; standards/schema-first-development-prompt.md Schema owns pure data; standards/effect-laws-v1.md laws 17, 19, 20.
- evidence: sol-1-3 identifies seed interfaces/union at MemoryFileSystem.ts:469 onward, volume stat at :176, inode variants/Data.taggedEnum at volume.ts:105–135 and glob variants at :2340–2371. fable-1-15 identifies Resolved at ports.ts:33, stat-kind literals, mutation-method literals at ports.ts:289–293 and access literals at volume.ts:684. These valid handwritten types are not caught by the green runner gates.
- failure: Pure data contracts and named variant domains are defined independently of executable schemas; Resolved uses key-presence branching instead of a discriminated internal outcome.
- fix: Introduce named identity-annotated schemas for seed entries, volume stats, inode and glob variants, deriving existing types from them. Use S.Struct where preserving upstream plain objects requires it; retain service/port interfaces. In ports.ts and volume.ts define kits for reused resolution errno, stat kind, mutation method and access domains, and a schema-backed discriminated internal Resolved result with exhaustive matching. Update its consumers in ports.ts and MemoryFileSystem.ts; keep public seed/stat payloads and behavior unchanged. Preserve the upstream test lines except where the cited law forces a change.
- seats: sol-1-3, fable-1-15
- group: g1

### req-4
- file: scratchpad/effected/memfs/internal/ports.ts:153
- class: bug   severity: required
- standard: D9, D11, D15; standards/effect-laws-v1.md law 6.
- evidence: grok-1-6 compares upstream enumerable/writable/configurable assignment with Object.defineProperty(out, name, { value }) in the port. Omitted descriptor flags default to false. fable-1-3 shows defineProperty is absent from the native-runtime scanner's Object-method set.
- failure: Faulted members disappear from Object.keys/spread, cannot be reassigned and are lost when wrappers are composed.
- fix: Build intercepted members with effect/Record.fromEntries and return an explicit spread/delegating object, preserving enumerable, writable and configurable own members and sync/Promise behavior. Avoid native reflection and assertions. Add regression assertions in Ports.test.ts for key enumeration, spread, reassignment and repeated wrapping.
- seats: grok-1-6, fable-1-3
- group: g1

### req-5
- file: scratchpad/effected/memfs/index.ts:35
- class: law   severity: required
- standard: D2; .patterns/error-handling.md public typed-error contract; D11.
- evidence: fable-1-5 shows exported InvalidFaultCountError and UnknownFaultKeyError are thrown by public APIs but absent from index.ts. FaultInjection.test.ts:19 and Ports.test.ts:6 import implementation files directly. grok-1-1 and grok-1-2 independently identify the absent barrel exports.
- failure: Entry-point consumers cannot import the replacement public error classes.
- fix: Re-export InvalidFaultCountError from MemoryFileSystem.ts and UnknownFaultKeyError directly from internal/faults.ts in index.ts; no declaration move is needed. Add a barrel-import regression in a new Exports.test.ts. Leave exportsAdded and README Port notes to codemod-2.
- seats: fable-1-5, grok-1-1, grok-1-2
- group: g2

### req-6a
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:49
- class: schema   severity: required
- standard: Operator step 4: IdentityComposer annotations on schemas and fields; .patterns/error-handling.md.
- evidence: fable-1-6 identifies bare S.TaggedError definitions at MemoryFileSystem.ts:49, internal/faults.ts:36 and internal/volume.ts:68, introduced after the step-4 pass. They have identity tags but no schema/field annotations; the green runner laws do not enforce these annotations.
- failure: InvalidFaultCountError, UnknownFaultKeyError and VolumeInvariantError omit schema identifier/title/description and field descriptions.
- fix: Add the IdentityComposer annoteError annotation argument and annoteKey field annotations to these three classes. Preserve tags and runtime payloads. This is executable schema identity work under step 4, rather than the deferred JSDoc carrier pass.
- seats: fable-1-6
- group: g1

### req-6b
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:36
- class: schema   severity: required
- standard: Operator step 4: IdentityComposer annotations on schemas and fields; .patterns/error-handling.md.
- evidence: fable-1-6 identifies bare S.TaggedError definitions at NodeSyncFileSystem.ts:36,40,44 for UnsafeIntegerError, ReadOnlyFileSystemError and InvalidPathArgumentError, introduced after the step-4 pass. Schema/field annotations are absent and not enforced by the green runner gates.
- failure: The three NodeSync tagged-error schemas omit schema identifier/title/description and field descriptions.
- fix: Add IdentityComposer annoteError arguments and annoteKey annotations to each message field and InvalidPathArgumentError.code. Preserve tags, name behavior and error payloads.
- seats: fable-1-6
- group: g4

### req-7a
- file: scratchpad/effected/memfs/internal/volume.ts:2010
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; D11.
- evidence: fable-1-7 enumerates native sorts at volume.ts:392,844,1220,1316,2010,2029,2720,2734,2947,2968,3021 and faults.ts:56. None of the four green runner laws scan Array.prototype.sort.
- failure: Twelve engine/fault sorts bypass the explicit Effect Order requirement.
- fix: Replace native sorts in volume.ts and faults.ts with effect/Array.sort and explicit Orders. Preserve default UTF-16 ordering with Order.string and preserve the localeCompare semantics at volume.ts:844,1220,1316 through a named normalized Order. Keep output ordering and existing upstream assertions; add targeted ordering regressions in the core group's tests where necessary.
- seats: fable-1-7
- group: g1

### req-7b
- file: scratchpad/effected/memfs/internal/view.ts:35
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; D11.
- evidence: fable-1-7 identifies the native .sort() at the end of MemoryFileSystem.Volume.paths; the green runner laws do not scan this method.
- failure: The public paths view uses native sorting instead of an explicit Effect Order.
- fix: Replace the final native sort with effect/Array.sort and Order.string, retaining the UTF-16 sorted-path promise. Add a focused unsorted-input paths-order regression in a new VolumePathsOrder.test.ts.
- seats: fable-1-7
- group: g3

### req-8
- file: scratchpad/effected/memfs/internal/errno.ts:94
- class: effect-idiom   severity: required
- standard: Later operator ruling: restore unforced lab changes and rewritten upstream test lines; D9; Dual-Arity Inventory Contract.
- evidence: fable-1-8 identifies dual overloads in errnoError/nodeErrno; seedVolume/applyRoot/seedWith; resolvePath/withFaults/runNode/runMutation; assertKnownFaultKeys/wrapFaulty; and test helpers suite/errnoSuite/caseInsensitiveSuite/denied. These upstream arrow helpers were single-signature and have no data-last callers. terse-effect only forces dual for pre-existing overloaded exported function declarations. The rewrite made optional description/path arguments mandatory undefined at volume.ts:232,249,768,943, MemoryFileSystem.ts:769 and ports.ts:172.
- failure: Lab-only overloads and arity predicates change helper contracts and upstream tests without a law, diagnostic or ruling forcing them.
- fix: Restore the pinned upstream single-signature arrow shapes and optional parameters for all listed helpers in errno.ts, seed.ts, ports.ts and faults.ts; remove rewrite-only explicit undefined arguments in volume.ts, MemoryFileSystem.ts and ports.ts. Restore upstream helper signatures and rewritten test lines in FileSystemContract.ts, ErrnoParityContract.ts, CaseInsensitiveContract.ts and helpers.ts, retaining import rewrites and law-forced Effect.fnUntraced bodies. Combine with schema/errno fixes without restoring unsafe assertions or native errors.
- seats: fable-1-8
- group: g1

### allow-1
- file: scratchpad/effected/memfs/internal/errno.ts:123
- class: law   severity: required
- kind: native-error
- standard: standards/effect-laws.allowlist.jsonc entry at :374–380; later operator ruling removing every effected native-runtime exception.
- evidence: The entry is rule beep-laws/no-native-runtime, file scratchpad/effected/memfs/internal/errno.ts, kind native-error, issue EFFECTED-MEMFS-NODE-ERRNO. nodeErrno still constructs new Error; Handle.test.ts:143,158 assert no _tag.
- failure: The native-error allowlist exception remains and preserves a public shape the operator explicitly authorized changing.
- fix: Replace nodeErrno's native Error with an identity-annotated S.TaggedError carrying message, code, errno, syscall and optional path; populate errno from a typed Node-compatible code-to-errno table, preserving message/code/syscall/path behavior. Retarget the two no-_tag assertions in Handle.test.ts to the new tagged representation and assert the carried fields. Keep nodeErrno's upstream single-signature shape per req-8. No standards-file edit is assigned to this group; central cleanup removes the registry entry after the site is replaced.
- seats: operator/allowlist
- group: g1

### allow-2
- file: scratchpad/effected/memfs/internal/errno.ts:123
- class: law   severity: required
- kind: object-method
- standard: standards/effect-laws.allowlist.jsonc entry at :382–388; later operator ruling removing every effected native-runtime exception.
- evidence: The entry is rule beep-laws/no-native-runtime, file scratchpad/effected/memfs/internal/errno.ts, kind object-method, issue EFFECTED-MEMFS-NODE-ERRNO. Object.assign attaches code/syscall/path to new Error in nodeErrno.
- failure: Object.assign keeps the second errno native-runtime exception alive.
- fix: Construct the S.TaggedError fields directly, including errno, instead of mutating an Error with Object.assign; implement with allow-1 and retain path omission for descriptor syscalls. Retarget Handle.test.ts assertions with allow-1. Central cleanup owns removal of the standards allowlist entry.
- seats: operator/allowlist
- group: g1

### allow-3
- file: scratchpad/effected/memfs/internal/volume.ts:2755
- class: law   severity: required
- kind: new-map-set
- standard: standards/effect-laws.allowlist.jsonc entry at :390–396; later operator ruling: subscriptions get ids keyed in MutableHashMap.
- evidence: The entry is rule beep-laws/no-native-runtime, file scratchpad/effected/memfs/internal/volume.ts, kind new-map-set, issue EFFECTED-MEMFS-WATCH-SUBSCRIPTIONS. Watchers use new Set<WatchSubscription>(); distinct subscriptions may have equal paths/options and mutable queues.
- failure: A native identity set remains; a structural collection keyed directly by subscriptions would collapse independent watchers.
- fix: Give each subscription a volume-owned monotonically allocated primitive id and store id-to-subscription entries in effect/MutableHashMap. Register/unregister by id and preserve independent queues, scoped cleanup and promised delivery order using explicit ordering where needed. Add regressions in WatchRecursive.test.ts for two same-path/same-option watchers and independent teardown. Central cleanup owns removal of the standards allowlist entry.
- seats: operator/allowlist
- group: g1

## Backlog

### back-1
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:59
- class: jsdoc   severity: backlog
- standard: S2 deferral; .patterns/jsdoc-documentation.md.
- evidence: grok-1-7 and sol-1-4 identify @remarks/@example carriers in MemoryFileSystem.ts, NodeSyncFileSystem.ts and index.ts and missing canonical category/since metadata on exported data declarations.
- failure: Carried API documentation has not completed the S2 grammar and metadata pass.
- fix: During S2 convert carriers to titled **Example** (Title) and **Details**/**Gotchas** sections without dropping bodies, add canonical categories/@since and validate examples with docgen.
- seats: grok-1-7, sol-1-4

### back-2
- file: scratchpad/test/memfs/FileSystemContract.ts:584
- class: test   severity: backlog
- standard: S3 deferral; goals/effect-vitest-canon/SPEC.md D5; .patterns/testing-patterns.md.
- evidence: sol-1-5 identifies assert.isTrue(O.isNone(readAlloc(...))) at EOF and Result.isFailure assertions in MemoryFileSystem.test.ts:79.
- failure: Container predicate assertions omit canonical utilities and expected Result payloads.
- fix: During S3 use assertNone and payload-checking assertFailure/assertSuccess from @effect/vitest/utils.
- seats: sol-1-5

### back-3
- file: scratchpad/test/memfs/FaultInjection.test.ts:306
- class: test   severity: backlog
- standard: S3 deferral; D10 property floor.
- evidence: sol-1-6's read-only search found no Arbitrary, FastCheck, fcRuns or property calls in the memfs tests; the two fault-error schemas have only example checks.
- failure: Exported schemas lack schema-derived round-trip properties.
- fix: During S3 add Arbitrary.schema encode/decode round-trip properties for the final exported schema set using fcRuns and field-preserving assertions.
- seats: sol-1-6

### back-4
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1054
- class: docs   severity: backlog
- standard: S2 deferral; section 10.1.
- evidence: fable-1-9 identifies stale RangeError text at MemoryFileSystem.ts:410,930,1054 and README.md:135,256 after the typed-error conversion.
- failure: Public prose names error types that the authorized implementation no longer throws.
- fix: During S2 replace the five stale error names with UnknownFaultKeyError/InvalidFaultCountError. Central deviation bookkeeping supplies the Port-notes citation; keep KNOWLEDGE.md verbatim.
- seats: fable-1-9

### back-5
- file: scratchpad/effected/memfs/README.md:3
- class: docs   severity: backlog
- standard: S2 deferral; section 10.3 README adaptation.
- evidence: fable-1-10 identifies npm/version/Node/TypeScript badges at :3–6, the pre-1.0 stability/pnpm-plugin-effect block at :13–22 and Install at :24–36.
- failure: The lab README advertises upstream publication and installation policy.
- fix: During S2 remove the badges, upstream stability/pnpm-plugin-effect block and Install section, preserving other carried prose.
- seats: fable-1-10

### back-6
- file: scratchpad/effected/memfs/internal/volume.ts:1208
- class: effect-idiom   severity: backlog
- standard: D11: performance needs a measurement or algorithmic-class win; laws 21/22 permit both Effect.fn and fnUntraced.
- evidence: fable-1-11 identifies traced File/Directory/SymbolicLink handlers inside recursive copyInode; no measured regression or algorithmic-class difference is supplied.
- failure: Generic per-inode trace names and possible constant-factor allocations are an unmeasured improvement opportunity, not a demonstrated law break.
- fix: Consider Effect.fnUntraced for the three arms after the required wave; measure before claiming a performance regression.
- seats: fable-1-11

### back-7
- file: scratchpad/effected/memfs/internal/seed.ts:45
- class: effect-idiom   severity: backlog
- standard: D11; law 21 preference; D9; explanatory comment work.
- evidence: fable-1-12 observes makeUnsafe(0) followed by stamp.setTime(entry.mtime), preserving invalid-Date input on the typed BadArgument path.
- failure: The reason for the behavior-preserving construction is not explained; no current failure is demonstrated.
- fix: Add a short comment explaining that makeUnsafe(0)+setTime preserves invalid mtime as typed BadArgument. Avoid the proposed behavior-changing simplification.
- seats: fable-1-12

### back-8
- file: scratchpad/effected/memfs/internal/volume.ts:572
- class: test   severity: backlog
- standard: S3 deferral; section 11.3 unreachable-source branches.
- evidence: fable-1-13 lists root-stack fallbacks at :572,577,581,589,620 and index guards at :2013,2019,2485,2526,2667,2951,2957 that invariants make unreachable.
- failure: Defensive branches complicate the future 100%-branch proof.
- fix: During S3 model the root stack as nonempty, use nonempty accessors and iterate/find elements directly where invariants permit, preserving the diagnostic fix and avoiding unsafe assertions.
- seats: fable-1-13

### back-9
- file: scratchpad/test/memfs/Handle.test.ts:1
- class: test   severity: backlog
- standard: S3 deferral; goals/effect-vitest-canon/SPEC.md D14; section 11.2.
- evidence: fable-1-14 identifies strictEffectProvide:skip-file in nine test files and asyncFunction:skip-file in Handle.test.ts. These suppressions hide suite-level provide diagnostics; nodeBuiltinImport integration suppressions serve the host-disk oracle.
- failure: Suite-level layers still need canonical it.layer migration; suppressed diagnostics alone do not complete S3.
- fix: During S3 migrate the nine suite-level layers to it.layer/layer and remove strictEffectProvide pragmas. Retain justified Promise-suite and nodeBuiltinImport suppressions.
- seats: fable-1-14

## Handled by the deviation codemod

### codemod-1
- file: scratchpad/effected/memfs/README.md:365
- class: law   severity: backlog
- disposition: handled centrally by the deviation codemod
- standard: Later operator ruling: one generated deviation entry per module per systemic class; section 14.
- evidence: sol-1-1 and fable-1-4 identify empty deviations despite law-forced fault errors, volume invariant errors, NodeSync errors and tagged errno causes, with adjusted FaultInjection/Ports/Handle tests. sol-1-2 also identifies the observable tagged errno cause shape.
- failure: Required deviation bookkeeping is absent for authorized law-forced tagged-error/native-runtime conversions.
- fix: The central per-module/per-class codemod records tagged-errors and native-runtime replacements, source sites and adjusted upstream tests in the ledger and README Port notes. No repair group owns those bookkeeping surfaces.
- seats: sol-1-1, fable-1-4, sol-1-2

### codemod-2
- file: scratchpad/effected/memfs/README.md:361
- class: law   severity: backlog
- disposition: handled centrally by the deviation codemod
- standard: D2 bookkeeping; later operator ruling: added exports go to exportsAdded.
- evidence: fable-1-5 identifies empty Added exports/exportsAdded while the two public fault-error classes need barrel exposure.
- failure: The added-export record will be incomplete after req-5 lands.
- fix: The central codemod records InvalidFaultCountError and UnknownFaultKeyError and any law-derived exports added by this wave in exportsAdded and README Port notes. The actual missing exports remain req-5.
- seats: fable-1-5

## Rejected

### grok-1-1
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1086
- class: bug   severity: backlog
- disposition: rejected; excluded from dispatch
- standard: D9 / section 14 as invoked by the seat, superseded by Grilling, 2026-10-09 (later).
- evidence: The oracle throws RangeError; the lab throws InvalidFaultCountError, with FaultInjection.test.ts:307 retargeted.
- failure: failTimes is no longer instanceof RangeError.
- fix: Restore RangeError, restore its assertion and add a native-error allowlist entry.
- seats: grok-1-1
- rejection: Contradicts the later ruling authorizing typed-error public changes and removing all effected native-runtime exceptions; the missing barrel export is retained in req-5.

### grok-1-2
- file: scratchpad/effected/memfs/internal/faults.ts:55
- class: bug   severity: backlog
- disposition: rejected; excluded from dispatch
- standard: D9 / section 14 as invoked by the seat, superseded by Grilling, 2026-10-09 (later).
- evidence: The oracle throws RangeError for unknown fault keys; the lab throws UnknownFaultKeyError, and Ports/Handle assertions were retargeted.
- failure: Unknown fault keys no longer throw RangeError.
- fix: Restore RangeError and its assertions and add a native-error allowlist entry.
- seats: grok-1-2
- rejection: Contradicts the later ruling authorizing typed-error public changes and removing all effected native-runtime exceptions; the missing barrel export is retained in req-5.

### grok-1-3
- file: scratchpad/effected/memfs/internal/errno.ts:83
- class: bug   severity: backlog
- disposition: rejected; excluded from dispatch
- standard: D9 / section 14 as invoked by the seat, superseded by Grilling, 2026-10-09 (later).
- evidence: Oracle errno causes have code/path; the lab Data.TaggedError adds _tag/name, and the existing allowlist rationale preserves no-_tag shape.
- failure: The errno cause shape differs from the oracle.
- fix: Restore class ErrnoException extends Error and retain nodeErrno's existing allowlist.
- seats: grok-1-3
- rejection: Contradicts the later ruling requiring S.TaggedError errno carriers and retargeted no-_tag assertions; carrier correctness remains req-2 and native sites remain allow-1/allow-2.

### grok-1-4
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:165
- class: bug   severity: backlog
- disposition: rejected; excluded from dispatch
- standard: D9 / section 14 as invoked by the seat, superseded by Grilling, 2026-10-09 (later).
- evidence: The oracle wraps TypeError with ERR_INVALID_ARG_TYPE; the lab uses InvalidPathArgumentError with TypeError display name, and the differential contract compares code/syscall.
- failure: The cause is no longer instanceof TypeError.
- fix: Restore TypeError with code assignment and add a native-error allowlist entry.
- seats: grok-1-4
- rejection: Contradicts the later ruling authorizing tagged errors and removal of all effected native-runtime exceptions; annotations remain req-6b.

### grok-1-5
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:129
- class: bug   severity: backlog
- disposition: rejected; excluded from dispatch
- standard: D9 / section 14 as invoked by the seat, superseded by Grilling, 2026-10-09 (later).
- evidence: The oracle read-only defect is new Error; the lab uses ReadOnlyFileSystemError and the test checks only Cause.hasDies.
- failure: The read-only defect has a new class/tag.
- fix: Restore new Error and add a native-error allowlist entry.
- seats: grok-1-5
- rejection: Contradicts the later ruling authorizing tagged errors and removal of all effected native-runtime exceptions; deviation recording is codemod-1.

REQUIRED: 13  BACKLOG: 9  CODEMOD: 2  REJECTED: 5  GROUPS: 4
