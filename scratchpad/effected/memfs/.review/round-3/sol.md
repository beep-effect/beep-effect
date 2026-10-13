### sol-3-1
- file: scratchpad/test/memfs/internal/volume.property.test.ts:15
- class: test   severity: required
- standard: D10; scratchpad/EFFECTED_PORT_GOAL.md §11.4, meaningful property tests.   evidence: The `Name` schema accepts both `"dir"` and `"tmp"`. Read-only, in-memory probes reproduced the property setup against both the lab and the pinned oracle: `"dir"` with the first property's setup returns `BadResource writeFile EISDIR`; `"tmp"` with the second property's case-insensitive setup returns `BadResource writeFile EISDIR`. The first property creates `/tree/dir` before writing `/tree/${name}`. The second writes `/${name.toUpperCase()}`, which resolves to the engine's pre-created `/tmp` when `name === "tmp"`. Neither failure reaches the property assertions. A successful randomized gate run does not exclude these valid generated counterexamples.
- failure: Both properties can fail on a correct implementation because generated file names collide with fixture directories. Their result depends on whether the random run selects a reserved name.
- fix: Keep generated names disjoint from fixture directory names. Use a navigation-directory name outside the generator's alphabet in the first property, and prefix the generated file name in the second property; update the corresponding paths, glob patterns, and expected spelling.

### sol-3-2
- file: scratchpad/effected/memfs/internal/volume.ts:2700
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; D5 and D11.   evidence: `EngineOptions` at line 2700 is an exported, pure configuration payload containing `caseSensitive: boolean`. `VolumeEntrySnapshot` at line 2900 is an exported, pure inspection payload containing path, entry kind, bytes, timestamps, target, and size. Both remain handwritten interfaces without owning schemas. These are additional declarations beyond the seed/stat/inode/glob declarations identified in round-1 req-3. The recorded schema-first deviation does not grant an exception for them. Typechecking accepts the interfaces, and the four beep-law gates do not enforce schema ownership of these payloads.
- failure: Engine configuration and inspection data have compile-time contracts but no executable schema from which validation, annotations, equivalence, or arbitraries can be derived.
- fix: Define identity-annotated schemas for `EngineOptions` and `VolumeEntrySnapshot`, then derive their existing type names from those schemas. Preserve the current plain-object payloads, required `undefined` fields, and live byte references; schema construction need not be added to every inspection read.

### sol-3-3
- file: scratchpad/effected/memfs/internal/seed.ts:127
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md §5; standards/effect-first-development.md EF-33; D5 and D11.   evidence: `SeedRootError` is a handwritten two-string data interface returned by the exported `applyRoot` function. Its success payload is also repeated as an inline `{ readonly seed: MemoryFileSystemSeed; readonly root: string | undefined }` type in the overloads and implementation at lines 157–162. Neither payload has an owning schema. They are ordinary data shapes, rather than service contracts or type-level utilities, and no accepted deviation exempts them. The green compiler and four beep-law gates accept these declarations without checking this schema-first obligation.
- failure: The root-application boundary maintains its success and failure payload contracts independently of executable schemas; the success shape is duplicated across signatures.
- fix: Introduce identity-annotated structural schemas for the existing `SeedRootError` and applied-seed payloads, derive their types, and reuse the derived success type in all signatures. Preserve the existing `Result` variants and payload fields.

### sol-3-4
- file: scratchpad/effected/memfs/internal/volume.ts:799
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b; D5 and D11.   evidence: `validateMode` independently implements the unsigned 32-bit integer constraint with `Number.isInteger(mode) && mode >= 0 && mode <= 0xffff_ffff`. `validateOwner` at line 2110 repeats the same constraint for uid and gid. The mode validator is reused by directory creation, opening, and chmod; the owner validator is reused for both ownership fields. The existing `S.Finite` metadata schemas do not express this constraint. These handwritten checks remain after the separate round-2 OpenFlag finding was fixed; the green gates do not enforce schema ownership of arbitrary validation expressions.
- failure: A named, reused filesystem constraint is defined twice in imperative validation logic instead of being owned by a schema and consumed through a derived guard.
- fix: Define one identity-annotated unsigned 32-bit integer schema using built-in integer and inclusive-range checks, then derive its guard with `S.is`. Use that guard in both validators while retaining optional-mode acceptance and the exact existing typed `BadArgument` messages.

### sol-3-5
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:195
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md, Hard requirements: examples use Effect patterns; standards/effect-first-development.md EF-3; Effect TSGo rule `schemaSync` / `TS377130`.   evidence: Newly authored schema examples call `S.decodeUnknownSync` at lines 195, 633, and 673. None documents a deliberate synchronous compatibility boundary. The referenced TSGo rule identifies this API as throwing synchronous decoding and recommends `S.decodeUnknownEffect`. These calls live inside comments, so ordinary source diagnostics do not inspect them; successful docgen compilation does not establish their compliance with the Effect-first codec convention.
- failure: The public schema examples teach throwing synchronous decoding as the default usage, contrary to the prescribed Effect-based decoding pattern.
- fix: Replace the three example calls with `S.decodeUnknownEffect`, run the resulting effects at the example's runtime boundary, and retain the current demonstrated inputs and outputs.

REQUIRED: 5
BACKLOG: 0