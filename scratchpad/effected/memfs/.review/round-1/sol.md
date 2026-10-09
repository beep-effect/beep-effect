### sol-1-1
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1086
- class: law   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9 and §14 (behaviour deviation protocol).   evidence: A read-only `bun --eval` differential probe importing both the pinned oracle and the lab returned `oracle failTimes RangeError true undefined` versus `lab failTimes InvalidFaultCountError false InvalidFaultCountError`. Unknown fault keys likewise changed from `RangeError` to `UnknownFaultKeyError` at `internal/faults.ts:55`. The corresponding upstream assertions were changed in `scratchpad/test/memfs/FaultInjection.test.ts:307` and `scratchpad/test/memfs/Ports.test.ts:198`, while README *Deviations* says `None` and the memfs ledger row has `"deviations": []`.
- failure: Callers catching `RangeError` observe different behavior, and the adjusted tests accept that difference without the mandatory deviation registration. The typed-error law can justify the conversion, but green tests do not satisfy §14.
- fix: Register the conversions as `law:` deviations in the memfs ledger and README, identifying the original and new error behavior and citing the adjusted tests. Retain the typed errors.

### sol-1-2
- file: scratchpad/effected/memfs/internal/errno.ts:83
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 7; `AGENTS.md` typed-error rule; D5.   evidence: `ErrnoException` directly extends `Data.TaggedError`, not `S.TaggedError`. A read-only runtime probe returned `S.isSchema(ErrnoException) === false`, while both new fault-error classes returned `true`. Thus this concrete site remains outside the schema contract despite the reported green gates. The differential probe also showed an upstream errno cause with keys `["code", "path"]` versus lab keys `["code", "path", "_tag", "name"]`.
- failure: The production errno error has no schema-derived contract or canonical schema identity. Its new observable `_tag` and enumerable `name` also change the error-cause shape without a recorded D9 deviation.
- fix: Define the error with `S.TaggedError` and a `$ScratchpadId` composer, preserving its message, code, path, and displayed name; update construction sites to use the schema constructor. Record the resulting cause-shape deviation under D9.

### sol-1-3
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:469
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `AGENTS.md` schema-first domain-model rule.   evidence: `MemoryFileSystemSeedFile`, `MemoryFileSystemSeedDirectory`, and `MemoryFileSystemSeedSymlink` are interfaces, and `MemoryFileSystemSeedEntry` is a handwritten union. Other pure-data models have the same gap: `MemoryFileSystemVolumeStat` at line 176, inode variants and `Data.taggedEnum<InodeEntry>()` in `internal/volume.ts:105–135`, and glob-token variants in `internal/volume.ts:2340–2362`. These declarations provide no runtime schemas; the compiler gates accept them because they are valid TypeScript.
- failure: Pure domain data remains defined independently of runtime schemas, so its guards, codecs, and arbitraries cannot derive from a single executable contract. These shapes are data models, rather than the service contracts and port signatures permitted to remain interfaces.
- fix: Introduce named schemas for the pure-data shapes and derive their existing types and unions from those schemas. Use the documented `S.Struct` boundary exception where necessary to preserve upstream plain-object behavior, and retain interfaces for service and port contracts.

### sol-1-4
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:59
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements and carrier policy; operator deferral of S2.   evidence: The exported volume interface uses `@remarks`; the public class example at line 863 uses `@example`; exported data declarations such as `MemoryFileSystemVolumeStat` lack canonical `@category` and `@since`. These are present in the reviewed commit.
- failure: The carried documentation does not yet satisfy the required section grammar and export metadata, so it remains unfinished work for the S2 documentation gate.
- fix: During S2, convert `@remarks` to the appropriate prose section and `@example` to titled `**Example** (Title)` sections, preserving the upstream content. Add canonical categories and `@since 0.0.0`, then validate the examples through docgen.

### sol-1-5
- file: scratchpad/test/memfs/FileSystemContract.ts:584
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; operator deferral of S3.   evidence: EOF is asserted with `assert.isTrue(O.isNone(yield* file.readAlloc(1)))`. Similar container-predicate assertions remain, including `assert.isTrue(Result.isFailure(result))` in `MemoryFileSystem.test.ts:79`.
- failure: Option and Result assertions still use tag predicates instead of the canonical Vitest utilities; the Result assertion also omits the expected failure payload.
- fix: During S3, replace the EOF assertion with `assertNone(...)` from `@effect/vitest/utils`. Convert Result assertions to `assertFailure` or `assertSuccess` with their expected payloads.

### sol-1-6
- file: scratchpad/test/memfs/FaultInjection.test.ts:306
- class: test   severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D10 (property floor); operator deferral of S3.   evidence: A read-only search for `Arbitrary|FastCheck|fcRuns|property\(` across `scratchpad/test/memfs` returned no matches. The exported `InvalidFaultCountError` and `UnknownFaultKeyError` schemas have example-based checks but no schema-derived round-trip properties.
- failure: The current tests do not meet the required property floor for exported schemas.
- fix: During S3, add schema-derived encode/decode round-trip properties for the exported error schemas, using `fcRuns(n)` and assertions that preserve the relevant error fields.

REQUIRED: 3
BACKLOG: 3