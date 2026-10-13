# memfs round-3 inventory

Seats read: `grok.md`, `sol.md`, `fable.md`, with adjacent `BRIEF.md` and `BRIEF.grok3.md`. No part directories contain additional reports. Six seat findings are accounted for; grok reports no findings. **Required: 5 · Backlog: 1 · Codemod: 0 · Rejected: 0 · Groups: 3.**

Seat commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. Live checkout: `@lab/effected-2` at `576451bec24c6452dc359a863b5c99e4f7888fef`, rather than the requested `@lab/effected`. The reported source files and witness tests have no diff between the seat commit and live HEAD. Oracle: `~/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/memfs`. This inventory merge runs no tests, compiler, coverage, audit or ledger command and changes no branch.

The complete operator revision block, including both 2026-10-09 ruling blocks, D1–D20, §12.5 and §14 govern these dispositions. The merge instruction defers documentation, JSDoc, coverage and vitest-canon findings regardless of the briefs' green-S2/S3 claim. Neither the live nor seat-commit `standards/effect-laws.allowlist.jsonc` contains a memfs entry, so there are no `allow-*` findings. Historical removed entries are not reissued. Recording law-derived identities, errors, exports and native-runtime replacements remains central.

Required groups own disjoint source and test files. `g1` owns `internal/volume.ts` and its two test files; `g2` owns `internal/seed.ts` and its property test; `g3` owns `NodeSyncFileSystem.ts` and its conversion-failure test. Each group has one source file. No group owns configuration, PORT_LEDGER.json or README Port notes.

## Required

### sol-3-1
- file: scratchpad/test/memfs/internal/volume.property.test.ts:15; scratchpad/test/memfs/internal/volume.property.test.ts:29
- class: test   severity: required
- standard: D11, test correctness; D10 and §11.4 meaningful properties.
- evidence: `Name` at :9 accepts every lowercase name of length 1–12, including `dir` and `tmp`. The first property creates `/tree/dir` before writing `/tree/${name}`; the second writes `/${name.toUpperCase()}` on a case-insensitive engine that already has `/tmp`. Sol reports read-only probes against both lab and pinned oracle returning `BadResource writeFile EISDIR` for these cases before any property assertion. The source independently confirms both collisions. A randomized green run can miss these valid generator outputs.
- failure: A correct filesystem can fail either property because the generated file path names a fixture directory. Test success depends on random selection.
- fix: Make fixture and generated file names disjoint. Use a navigation directory outside the generator's alphabet in the first property, updating its traversal and symlink paths. Prefix the generated filename in the second property, updating the stored spelling, glob alternatives, copy/link paths and expectations consistently. Retain all fidelity and idempotence assertions. This is a concrete fixture bug, not a request to expand coverage or complete the property floor.
- seats: sol-3-1
- group: g1

### sol-3-2
- file: scratchpad/effected/memfs/internal/volume.ts:2700; scratchpad/effected/memfs/internal/volume.ts:2900
- class: schema   severity: required
- standard: D5, D11; standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-33.
- evidence: Exported `EngineOptions` is a plain interface for `caseSensitive: boolean`; exported `VolumeEntrySnapshot` independently declares path, entry kind, data, modification time, target and size. Both are representable data payloads, not service contracts or type-level utilities. The current declarations confirm the seat evidence. They were not among the earlier converted seed/stat/inode/glob models. Compiler and four-law gate success do not establish ownership of these payloads by executable schemas.
- failure: Engine configuration and inspection data maintain handwritten contracts without schemas from which validation, equivalence and other schema behavior can be derived.
- fix: Define identity- and field-annotated structural schemas for `EngineOptions` and `VolumeEntrySnapshot`, deriving the existing types from them. Preserve plain-object results, required keys whose values may be `undefined`, existing field domains, and live byte references. Do not add decoding or copies to each snapshot read. Add focused contract assertions in `internal/volume.coverage.test.ts` for required keys, valid payloads and retained reference behavior. Central accounting handles any law-derived value exports.
- seats: sol-3-2
- group: g1

### sol-3-3
- file: scratchpad/effected/memfs/internal/seed.ts:127; scratchpad/effected/memfs/internal/seed.ts:157
- class: schema   severity: required
- standard: D5, D11; standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-33.
- evidence: `SeedRootError` is a two-string interface returned by exported `applyRoot`. The success payload `{ readonly seed: MemoryFileSystemSeed; readonly root: string | undefined }` is repeated in both overloads and the implementation at :157–162. The declarations remain in current source; no schema owns either payload. The green gates accept them without enforcing this domain-model rule.
- failure: Root application duplicates its success contract and defines both success and failure data independently of executable schemas.
- fix: Define identity- and field-annotated structural schemas for `SeedRootError` and the applied-seed payload, derive their types, and reuse the success type in every signature. Preserve the existing Result variants, description/subject strings, required `root` key accepting `undefined`, seed identity when no root is supplied, and all root/key validation behavior. Extend `internal/seed.property.test.ts` with focused payload-contract and applyRoot assertions; no public error tag or class conversion is needed. Added-export accounting remains central.
- seats: sol-3-3
- group: g2

### sol-3-4
- file: scratchpad/effected/memfs/internal/volume.ts:799; scratchpad/effected/memfs/internal/volume.ts:2110
- class: schema   severity: required
- standard: D5, D11; standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b.
- evidence: `validateMode` and `validateOwner` independently express `Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff`. Their consumers include directory creation, opening, chmod and both chown fields. Existing finite-number metadata schemas do not own this integer/range constraint. These are distinct from the already-fixed OpenFlag guard, and the four-law scanners do not detect this duplicated schema obligation.
- failure: A named, reused filesystem domain constraint is maintained twice as imperative validation rather than owned by one schema.
- fix: Introduce one internal identity-annotated unsigned 32-bit integer schema with built-in integer and inclusive-range checks, and derive its guard with `S.is`. Use it in both validators, retaining optional-mode acceptance and the exact existing typed BadArgument messages. Extend existing regressions in `internal/volume.coverage.test.ts` for accepted boundaries and rejected fractional/out-of-range inputs through the existing deliberatelyInvalid helper where needed. Do not widen the accepted number domain or add public exports unnecessarily.
- seats: sol-3-4
- group: g1

### fable-3-1
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:178; scratchpad/test/memfs/NodeSyncFileSystem.coverage.test.ts:64
- class: bug   severity: required
- standard: D9, D11, D15; §14; later operator ruling restoring unforced oracle divergence.
- evidence: Oracle `src/NodeSyncFileSystem.ts:120–122` uses `(err as Error).message`: a string throw yields `undefined`, while `{ message: "busy" }` yields `"busy"`. The lab uses `err instanceof Error ? err.message : String(err)`, producing `"conversion failed"` and `"[object Object]"` for the seat's witnesses. The coverage test explicitly expects the first changed result. History was checked with file-scoped `git log` and `git log --all`, then the step-2/S1/law diffs. Commit `79492e0db6` (step 2) removes the unsafe cast and also introduces this fallback; `55c305a412`, `03bf79d41b`, `91dfd36af4` and `64cbf8dc39` supply no mandate for changed description semantics. D15 forces safe narrowing, but the diff shows additional behavior changes that safe property narrowing can avoid. The seat demonstrates a wrong adaptation, not merely missing deviation bookkeeping. Round-2 fable-2-8 supplied only guard-style advice; these witnesses are new evidence.
- failure: Stat conversion failures expose different typed BadArgument descriptions than the oracle, and a lab-added assertion locks in the divergence.
- fix: Use `P.hasProperty(err, "message") && P.isString(err.message) ? err.message : undefined` for the stat conversion catch. Retarget the string-throw assertion to `undefined`, and add the message-bearing non-Error witness expecting `"busy"` in the same test file. Restore oracle behavior with safe narrowing, preserving the law-forced cast removal and tagged errors. Leave the separate `fail` helper unchanged. There is no rewritten upstream test line to restore here; the incorrect expectation is in a lab-added test.
- seats: fable-3-1
- group: g3

## Backlog

### sol-3-5
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:195; scratchpad/effected/memfs/MemoryFileSystem.ts:633; scratchpad/effected/memfs/MemoryFileSystem.ts:673
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md Effect-pattern examples; standards/effect-first-development.md EF-3; Effect TSGo schemaSync / TS377130; merge instruction's S2 deferral.
- evidence: The seat identifies three schema examples calling `S.decodeUnknownSync` without explaining a synchronous boundary. Comment bodies are not ordinary source diagnostic input, so a green compiler or docgen gate does not reject this finding on its own.
- failure: Public examples teach throwing synchronous decoding as the default schema codec pattern.
- fix: During S2, replace these calls with `S.decodeUnknownEffect`, running the resulting effects at each example's runtime boundary while retaining the demonstrated inputs and outputs.
- seats: sol-3-5
- backlog reason: JSDoc/documentation is deferred by the merge instruction; this finding does not enter the required repair groups.

## Handled by the deviation codemod

None of the round-3 seat findings solely requests systemic deviation bookkeeping. Law-derived schema/value additions from the required fixes will be recorded centrally. fable-3-1 remains required because its evidence shows that the adaptation itself changes descriptions unnecessarily; merely recording it would not fix the parity bug.

## Rejected

None. Every reported finding supplies evidence and a concrete fix. The concrete fixture and parity bugs are not enforced by green gates; the cited schema obligations are not covered by the listed scanners. sol-3-5 is deferred to backlog rather than rejected. Grok's no-findings report contributes no finding record.

REQUIRED: 5  BACKLOG: 1  CODEMOD: 0  REJECTED: 0  GROUPS: 3
