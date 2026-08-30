# Pack jsonl — round 1 JSDoc inventory

Kit-port of `@effected/jsonl`. Same debt shape as jsonc: useful kit-era leads and some teaching examples, zero canonical `@category` / `@since 0.0.0`, titled `**Example**` carriers, or `$I` schema annotations. Module headers use `@since 0.1.0` (or omit `@since`) and lack `@packageDocumentation` except the barrel. Nested member `@remarks` / `@example` evade the owning-export census but fail the file-level zero-legacy gate.

## Confirmed mechanical

### jsonl-R1-001: Envelope.ts module header and all owning exports missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Envelope.ts:1, jsonl/Envelope.ts:42, jsonl/Envelope.ts:59, jsonl/Envelope.ts:78, jsonl/Envelope.ts:88, jsonl/Envelope.ts:95, jsonl/Envelope.ts:180
- `symbol`: Envelope.ts (module + EnvelopeFrame, Envelope interface, EnvelopeOf, EnvelopeUnion, EnvelopeWithTag, Envelope const)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Module `@since 0.1.0` (law is exactly `0.0.0`). Value exports `EnvelopeFrame` and `Envelope` missing `@category`, `@since`, titled Example. Type exports `Envelope`, `EnvelopeOf`, `EnvelopeUnion`, `EnvelopeWithTag` missing `@category`, `@since`. Leads exist and are useful.
- `impact`: Ratchet/census stay open for every public envelope symbol; callers get no category index and no compilable Example of two-stage decode vs encode.
- `suggestedFix`: Add `@packageDocumentation` and `@since 0.0.0` on the fileoverview. On each export: useful lead (keep), `@category` (`schemas` for `EnvelopeFrame`, `models` for the interface, `type-level` for the derived aliases, `codecs` or `decoding` for the `Envelope` const), `@since 0.0.0`. One titled Example on `EnvelopeFrame` (decode a raw line’s frame with `data` still unknown) and one on `Envelope` (registry decode + encode of a tagged payload, including `Schema.Void` → `null`). Do not add per-member Examples on `frameResult` / `decodeResult` / `encodeResult`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-002: Journal.ts module header and all owning exports missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Journal.ts:1, jsonl/Journal.ts:48, jsonl/Journal.ts:63, jsonl/Journal.ts:70, jsonl/Journal.ts:80, jsonl/Journal.ts:216, jsonl/Journal.ts:1108, jsonl/Journal.ts:1163
- `symbol`: Journal.ts (module + JournalWriteError, JournalReadError, AppendOptions, JournalShape, JournalConfig, JournalClass, Journal)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Module `@since 0.1.0`. Types missing `@category`/`@since`. `Journal` const missing `@category`/`@since` and uses retired `@example` (`legacy-example`).
- `impact`: The service factory is the package’s main runtime export and still fails jsdoc-ratchet on carrier plus required tags.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0`. Types: `@category` `errors` / `models` / `services` / `configuration` as appropriate, `@since 0.0.0`. Convert `Journal`’s `@example` to a titled `**Example**` (see jsonl-R1-015). Keep a single Example on `Journal`; do not invent Examples for the type-only companions.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-015
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-003: JsonlError.ts module header and all owning exports missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/JsonlError.ts:1, jsonl/JsonlError.ts:50, jsonl/JsonlError.ts:71, jsonl/JsonlError.ts:98, jsonl/JsonlError.ts:124, jsonl/JsonlError.ts:147, jsonl/JsonlError.ts:178, jsonl/JsonlError.ts:207, jsonl/JsonlError.ts:244, jsonl/JsonlError.ts:268
- `symbol`: JsonlError.ts (module + MalformedLine, UnknownEvent, InvalidData, TerminalViolation, JournalNotFound, UnserializableData, JournalClosed, JournalResync, JsonlError)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Module `@since 0.1.0`. Eight error classes missing `@category`/`@since`; seven also missing a titled Example. `MalformedLine` has `legacy-example`. `JournalResync` has `legacy-remarks` plus missing Example. `JsonlError` union missing `@category`/`@since` only (type-level).
- `impact`: Zero-legacy gate fails on `@example`/`@remarks`; callers cannot distinguish recovery per tag from hover docs that lack category and examples.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0`. Each class: `@category errors`, `@since 0.0.0`, one titled Example constructing or matching the tag (torn unterminated line vs terminated hole for `MalformedLine`; inode/`truncated` vs `replaced` for `JournalResync`). Move `@remarks` on `JournalResync` into `**Gotchas**`. Union: prose + `@see` members; no Example required.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-017
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-004: JsonlEvent.ts module header and owning-export tag gaps

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/JsonlEvent.ts:1, jsonl/JsonlEvent.ts:32, jsonl/JsonlEvent.ts:39, jsonl/JsonlEvent.ts:46, jsonl/JsonlEvent.ts:59, jsonl/JsonlEvent.ts:86, jsonl/JsonlEvent.ts:154
- `symbol`: JsonlEvent.ts (module + DataSchema, JsonlEventTypeId type/value, JsonlEvent interface/namespace/const)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Module `@since 0.1.0`. Confirmed missing `@category`/`@since` on all six owning exports. Value-level `JsonlEventTypeId` const missing titled Example. `JsonlEvent` const is `legacy-example`. Census also flags the `export declare namespace JsonlEvent` for `@example`; that part is a false positive (see Rejected).
- `impact`: Event factory is the registration API and still uses a retired carrier; type-id and interface cannot be indexed.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0`. `@category` `type-level` / `type-ids` / `models` / `factories` as appropriate, `@since 0.0.0`. Titled Example on `JsonlEvent` (make + registry; see jsonl-R1-019) and a small identity Example on the `JsonlEventTypeId` const. Namespace: prose + tags only, no Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-019
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-005: Line.ts module header and owning exports missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Line.ts:1, jsonl/Line.ts:26, jsonl/Line.ts:47
- `symbol`: Line.ts (module + ParsedLine, Line)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Module `@since 0.1.0`. `ParsedLine` and `Line` missing `@category`, `@since`, titled Example on the owning declaration. Nested `Line.byteLength` `@example` is not attached to the class export, so census correctly reports class-level missing Example while missing the nested legacy carrier (jsonl-R1-016).
- `impact`: The synchronous hook-script surface has no owning Example of split/parse/lastValid.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0`. `ParsedLine`: `@category models`, `@since 0.0.0`, Example of `Line.parseResult` success. `Line`: `@category parsing`, `@since 0.0.0`, one titled Example covering `split` offsets + `lastValid` walk-back. Fold `byteLength` into that Example or into `**Gotchas**`; do not leave a member `@example`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-021
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-006: LineSlice.ts module header and LineSlice missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/LineSlice.ts:1, jsonl/LineSlice.ts:36
- `symbol`: LineSlice
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Module `@since 0.1.0`. `LineSlice` class missing `@category`/`@since` and `legacy-example`.
- `impact`: Cursor type is the persisted offset unit; retired carrier plus missing tags fail ratchet and leave the CRLF/`end !== offset + length` teaching example non-canonical.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0`. Class: `@category models`, `@since 0.0.0`, convert the existing CRLF walk-through to `**Example** (CRLF byte offsets)` and fix imports (jsonl-R1-022).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-022
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-007: Slice.ts module header and owning exports missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Slice.ts:1, jsonl/Slice.ts:24, jsonl/Slice.ts:52, jsonl/Slice.ts:73
- `symbol`: Slice.ts (module + Slice, CursoredSlice, matchesFrame)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Module `@since 0.1.0`. `Slice` / `CursoredSlice` missing `@category`/`@since`. `matchesFrame` (`@internal` value) missing `@category`, `@since`, titled Example.
- `impact`: Filter-before-decode is the package headline; `matchesFrame` has no observable Example of empty `events: []`, missing `scope`, or half-open `to`.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0`. Interfaces: `@category models`, `@since 0.0.0`. `matchesFrame`: `@category predicates` (keep `@internal`), `@since 0.0.0`, one titled Example over `EnvelopeFrame` fields. No Example required on the interfaces.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-023
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-008: jsonl/index.ts barrel header is the only `@packageDocumentation` and still fails law

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/index.ts:1
- `symbol`: jsonl (package entry)
- `kind`: module
- `evidence`: Fileoverview has useful lead and `@packageDocumentation` but no `@since`, uses retired `@example`, `declare const sourceText`, `import { Line } from "@effected/jsonl"`, named `import { Option } from "effect"`, and bare `@see {@link https://effect.website | Effect}` (link text is not a purpose phrase). Census `findings: []` on the module because `owningExportCount === 0`; it instead tagged the first re-export with `legacy-carrier` (rejected as an owning-export finding).
- `impact`: Barrel is the published entry; legacy carrier + `declare` + `@effected/*` + named Option import fail Example law even though census hid the module row.
- `suggestedFix`: Keep `@packageDocumentation`. Add `@since 0.0.0`. Convert the snapshot-read walk-through to `**Example** (Read last valid line without a runtime)` using `import * as O from "effect/Option"` and a concrete JSONL string (no `declare`, no `@effected/*`). Replace the bare `@see` with a described link to `Line` / `Journal`, or drop it.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-009: jsonl/internal/merge.ts module header and all owning exports missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/internal/merge.ts:1, jsonl/internal/merge.ts:44, jsonl/internal/merge.ts:52, jsonl/internal/merge.ts:77, jsonl/internal/merge.ts:109
- `symbol`: merge.ts (module + isRecordLike, isPlainRecord, canMerge, shallowMerge)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation` and `missing-module-since`. All four value exports missing `@category`, `@since`, titled Example. Leads exist (`@internal` present).
- `impact`: `appendPatch` correctness depends on these guards; without Examples a caller (or future inliner) will use `Object.assign` / symmetric `canMerge` and re-open prototype pollution or silent replacement.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0` (keep `@internal`). Each export: `@category predicates` or `utilities`, `@since 0.0.0`, one titled Example (class instance is record-like; plain patch merges into class base; `__proto__` does not become the result prototype).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-024
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-010: jsonl/internal/tail.ts module header and all owning exports missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/internal/tail.ts:1, jsonl/internal/tail.ts:38, jsonl/internal/tail.ts:45, jsonl/internal/tail.ts:78, jsonl/internal/tail.ts:116, jsonl/internal/tail.ts:164, jsonl/internal/tail.ts:202
- `symbol`: tail.ts (module + DEFAULT_WINDOW, TailWindow, probeBomBytes, readTail, readTailUntil, readRangeText)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation` and `missing-module-since`. Five value exports missing `@category`/`@since`/titled Example. `TailWindow` missing `@category`/`@since` only.
- `impact`: Tail-window discipline is the cost bound for `latest`; undocumented internals hide BOM/offset and unclamped-window contracts.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0` (keep `@internal`). Constants/functions: `@category constants` / `utilities` / `resource-management`, `@since 0.0.0`, titled Examples that observe window `start` rebasing or BOM byte count (memfs/`FileSystem` layer, not a void-discard). `TailWindow`: prose only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-025
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-011: jsonl/internal/utf8.ts module header and utf8Length missing required tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/internal/utf8.ts:1, jsonl/internal/utf8.ts:25
- `symbol`: utf8Length
- `kind`: module
- `evidence`: Census `missing-packageDocumentation` and `missing-module-since`. `utf8Length` missing `@category`, `@since`, titled Example. Lead already teaches the emoji `String.length` trap.
- `impact`: Offsets are file bytes; a missing Example leaves the UTF-16 trap only in prose.
- `suggestedFix`: Fileoverview `@packageDocumentation` + `@since 0.0.0`. `utf8Length`: `@category utilities`, `@since 0.0.0`, titled Example `"\u{1F600}"` → 4 vs `.length` 2, plus unpaired surrogate → 3.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-026
- `status`: open
- `fixedCommit`: pending

## Editorial

### jsonl-R1-012: EnvelopeFrame lacks `$I.annoteSchema` and a same-name type alias

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: jsonl/Envelope.ts:42
- `symbol`: EnvelopeFrame
- `kind`: value
- `evidence`: `export const EnvelopeFrame = Schema.Struct({ ... })` with no `.pipe($I.annoteSchema(...))` and no `export type EnvelopeFrame = typeof EnvelopeFrame.Type`.
- `impact`: Non-class exported schemas must carry identity annotations and a same-name decoded alias; without them docgen/schema identity and the `Envelope` interface collide in the reader’s head (`EnvelopeFrame.Type` vs `Envelope`).
- `suggestedFix`: Pipe `$I.annoteSchema("EnvelopeFrame", { description: ... })` and add a type-level same-name alias with prose + described `@see {@link EnvelopeFrame}`. Keep the runtime Example on the const, not the alias.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-001
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-013: Envelope missing Gotchas and described `@see` for two-stage decode vs encode vs Line.lastValid

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Envelope.ts:28, jsonl/Envelope.ts:171, jsonl/Envelope.ts:314
- `symbol`: Envelope
- `kind`: value
- `evidence`: Implementation already warns: (1) never put a `Schema.Union` on the read path — filtering must decode `EnvelopeFrame` first; (2) `JSON.stringify` drops `undefined` `data` from `Schema.Void`, so encode must emit `null`; (3) unguarded stringify throws at `Effect.fromResult` construction; (4) `Line.lastValid` accepts a torn scalar (`4` from `42`) that is not an envelope. None of that is a `**Gotchas**` / described `@see` on the owning `Envelope` / `EnvelopeFrame` blocks. Types `EnvelopeOf` / `EnvelopeUnion` / `EnvelopeWithTag` have no `@see` to the interface they derive.
- `impact`: A caller who filters after `decodeResult` or who uses `Line.lastValid` for journal state silently inverts the package contract.
- `suggestedFix`: On `EnvelopeFrame` and `Envelope`, add `**Gotchas**` for union-eager decode, Void→null, and torn-scalar walk-back. Described `@see {@link Line.lastValid}` / `{@link Envelope.lastValidResult}` (or the const member), `{@link JsonlEvent}`, `{@link UnserializableData}`. Thin derived aliases: one-sentence lead + `@see {@link Envelope}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-001
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-014: JournalShape / JournalClass nested `@remarks` and a loose `ts` fence (census miss)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Journal.ts:135, jsonl/Journal.ts:161, jsonl/Journal.ts:1115
- `symbol`: JournalShape.query, JournalShape.changes, JournalClass.layer
- `kind`: type
- `evidence`: Member JSDoc uses retired `@remarks`. `JournalClass.layer` then includes a fenced `ts` block inside `@remarks` (correct vs WRONG `MailJournal.layer` identity), which is a loose fence outside `**Example**`. Census only inspects the interface’s top block, so these did not appear as `legacy-remarks`.
- `impact`: File-level jsdoc-ratchet fails on any `@remarks`; the layer-identity trap is the in-process form of the cooperative-writer bug and currently sits in an illegal fence.
- `suggestedFix`: Move query cost, changes delivery/filter guarantees, and layer memoization-by-reference into `**Gotchas**` on `JournalShape` / `JournalClass` (or `Journal`). Turn the layer identity snippet into the titled Example on `Journal` (or a second uniquely titled Example), not a loose fence.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-002
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-015: Journal.Service example imports `@effected/jsonl` and named `Schema`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Journal.ts:1149
- `symbol`: Journal
- `kind`: value
- `evidence`: ```ts import { Journal, JsonlEvent } from "@effected/jsonl"; import { Schema } from "effect";``` then `class MailJournal extends Journal.Service<MailJournal>()(...) {}` and `export const layer = MailJournal.layer(...)`. Meaningful, not vacuous, but forbidden import path and named Schema import; retired `@example` carrier.
- `impact`: Docgen Examples must compile under beep namespace-import law; `@effected/*` will not resolve in this workspace.
- `suggestedFix`: Titled `**Example** (Define a journal service and bind its layer)`. Use `import * as S from "effect/Schema"` and relative or future `@beep/*` imports (not `@effected/*`). Keep `export const layer = MailJournal.layer({ path })` as the observable bind-once lesson from jsonl-R1-014. Do not add a second Example unless the title is unique and teaches append/query.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-002
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-016: Journal type leads restate the name; write/query Gotchas stay in field comments

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Journal.ts:4, jsonl/Journal.ts:59, jsonl/Journal.ts:66, jsonl/Journal.ts:76, jsonl/Journal.ts:212, jsonl/Journal.ts:1104
- `symbol`: JournalReadError, AppendOptions, JournalShape, JournalConfig, JournalClass
- `kind`: type
- `evidence`: Leads such as “The failure channel of a read operation.”, “Options for one append.”, “Configuration for one journal layer.”, “A per-registry `Journal` service class.” restate the symbol. `JournalWriteError` already documents that any `PlatformError` from append is a possibly-torn tail (`writeAll` reports no byte count) — that belongs in `**Gotchas**` plus `@see {@link MalformedLine}`. `appendPatch` is shallow and uses transient `Object.create` instances (merge.ts); `JournalConfig.directory` derivation breaks drive-relative Windows paths.
- `impact`: Callers treat `PlatformError` as “nothing written”, double-mint `layer()`, or deep-merge patches and lose nested state.
- `suggestedFix`: Rewrite thin leads to state the decision (read vs write channels; stamp `scope` only; layer config including activation watch). Lift torn-tail, bind-layer-once, unsliced-`query` allocation, and shallow/transient patch into `**Gotchas**` with described `@see` to `JournalWriteError`, `JournalResync`, `canMerge` / `shallowMerge`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-002
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-017: MalformedLine example uses `@effected/jsonl` and a non-null assertion

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/JsonlError.ts:36
- `symbol`: MalformedLine
- `kind`: value
- `evidence`: `@example` imports `Line` from `@effected/jsonl` and uses `line!`. Teaching content is good (`terminated` false = torn tail). Named `Result` from `effect` is allowed (core combinator).
- `impact`: Type assertions and `@effected/*` imports are forbidden in Examples; the best error Example in the pack will fail docgen.
- `suggestedFix`: Titled `**Example** (Torn tail vs terminated hole)`. Import `Line` from the package path that docgen will resolve; index `Line.split(...)[0]` without `!` (guard or known single-element pattern). Observe `Result.isFailure` and `failure.line.terminated`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-003
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-018: JsonlError classes lack `$I.annote`; recovery Gotchas and `@see` are missing on the union

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md; .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/JsonlError.ts:50, jsonl/JsonlError.ts:71, jsonl/JsonlError.ts:98, jsonl/JsonlError.ts:124, jsonl/JsonlError.ts:147, jsonl/JsonlError.ts:178, jsonl/JsonlError.ts:207, jsonl/JsonlError.ts:244, jsonl/JsonlError.ts:268
- `symbol`: JsonlError
- `kind`: type
- `evidence`: All eight `Schema.TaggedError` classes omit the `$I.annote` third argument. `UnserializableData` comments that `message` must not render a cyclic `cause` and that a raw `TypeError` escapes `Effect.fromResult` at construction. `JournalResync` `@remarks` (inode `Option` — replacement undetectable without identity) is the real Gotcha. `JsonlError` explicitly excludes `PlatformError` with no `@see`. Inline `{@link InvalidData}` / `{@link TerminalViolation}` exist; no described `@see` pairs for recovery choice (`InvalidData` vs `UnserializableData`, `TerminalViolation` vs `JournalClosed`).
- `impact`: Callers stringify cyclic causes, wrap platform IO into this union, or treat closed vs terminal as the same recovery.
- `suggestedFix`: Annotate each tagged error with `$I.annote`. Convert remarks into `**Gotchas**`. On the union and sibling classes, described `@see` for the recovery pair and a note that `PlatformError` stays untranslated. Keep `MalformedLine` torn-tail vs hole as Gotchas (already in the lead’s bold sentence — move out of the lead).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-003
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-019: JsonlEvent.make example is unused-registry, `@effected/*`, named Schema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/JsonlEvent.ts:138
- `symbol`: JsonlEvent
- `kind`: value
- `evidence`: `@example` builds `MailReceived` / `Unlinked` / `Relinked` then `const registry = [...] as const` with no observation of `tag` literals or `terminal`/`reopen`. `import { JsonlEvent } from "@effected/jsonl"`; `import { Schema } from "effect"`.
- `impact`: Placeholder-adjacent Example (unused binding) plus forbidden imports; does not show why `const` type parameters are load-bearing.
- `suggestedFix`: Titled `**Example** (Register terminal and reopen events)`. `import * as S from "effect/Schema"`. Observe `Unlinked.terminal` / `Relinked.reopen` / `MailReceived.tag` (and optionally `satisfies` a `JsonlEvent.Registry`). No `any`, assertions, or `declare`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-004
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-020: JsonlEvent TypeId lead restates the name; nested namespace members untagged; missing Gotchas/`@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/JsonlEvent.ts:34, jsonl/JsonlEvent.ts:41, jsonl/JsonlEvent.ts:86, jsonl/JsonlEvent.ts:96, jsonl/JsonlEvent.ts:126
- `symbol`: JsonlEventTypeId, JsonlEvent (namespace)
- `kind`: type
- `evidence`: Type and const TypeId leads are “Unique/Runtime type identifier marking a JSONL event definition.” Nested exported members `Any`, `Registry`, `Events`, `Tag`, `WithTag`, `Data`, `TerminalTags`, `ReopenTags` lack `@category`/`@since` (census listed only the namespace). Implementation already states `data` is required (typo in options must not become void) and `Schema.Top` is not the `DataSchema` bound.
- `impact`: Hover on `JsonlEvent.Tag<R>` has almost no prose; a payload schema with services fails at registration, not at the hook read path — that contract is easy to miss.
- `suggestedFix`: TypeId: one sentence on branding/`[JsonlEventTypeId]` plus `@see` the const/type twin. While touching the namespace, tag nested exports `@category type-level` `@since 0.0.0`. On `JsonlEvent` / `DataSchema`: `**Gotchas**` that `data` is mandatory (`S.Void` for payload-less) and codecs are `never`-service. Described `@see {@link Envelope}`, `{@link TerminalViolation}`, `{@link DataSchema}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-004
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-021: Line.byteLength nested `@example` plus ParsedLine `$I.annote` and lastValid Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: jsonl/Line.ts:26, jsonl/Line.ts:60, jsonl/Line.ts:197
- `symbol`: Line, ParsedLine
- `kind`: value
- `evidence`: `Line.byteLength` has `@example` importing `@effected/jsonl` (file-level ratchet; census miss). `ParsedLine extends Schema.Class` without `$I.annote`. `lastValid` already documents that a torn scalar parses as a different JSON value and only the envelope layer closes that hole — not lifted to the `Line` owning block as `**Gotchas**` / `@see {@link Envelope}`.
- `impact`: Hook scripts using `Line.lastValid` as “current journal state” accept corruption; nested `@example` keeps the file dirty after a class-level upgrade.
- `suggestedFix`: Remove member `@example`; put the UTF-8 vs `String.length` trap in `**Gotchas**` or the single `Line` Example. Annotate `ParsedLine` with `$I.annote`. Described `@see {@link LineSlice}`, `{@link MalformedLine}`, `{@link Envelope}` (`lastValidResult`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-005
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-022: LineSlice example imports `@effected/jsonl`; class lacks `$I.annote`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: jsonl/LineSlice.ts:22, jsonl/LineSlice.ts:36
- `symbol`: LineSlice
- `kind`: value
- `evidence`: Existing example is the right job (CRLF `length` 7 vs `end` 9) but `import { Line } from "@effected/jsonl"`. `Schema.Class` has no `$I.annote` third argument. Lead already contains the `String.length` / unterminated-final-line Gotchas inline rather than as `**Gotchas**`. No `@see {@link Line.split}`.
- `impact`: Best offset Example in the pack will not compile under beep imports; schema identity missing.
- `suggestedFix`: Keep one titled Example; fix imports; `$I.annote("LineSlice", ...)`. Move UTF-8 / `end - offset !== length` / torn `terminated: false` into `**Gotchas**`. Described `@see {@link Line}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-006
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-023: Slice empty-array / half-open `to` / frame-only matching need Gotchas and `@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/Slice.ts:15, jsonl/Slice.ts:48, jsonl/Slice.ts:65
- `symbol`: Slice, CursoredSlice, matchesFrame
- `kind`: type
- `evidence`: Lead already says empty `events: []` matches nothing and `to` is exclusive; `matchesFrame` “Takes the **frame**, never a decoded envelope”; `CursoredSlice.cursor` is post-BOM and should persist `line.end`. None of that is a `**Gotchas**` section or described `@see {@link EnvelopeFrame}` / `{@link Envelope.decodeSelectedResult}`. `CursoredSlice` lead is “A Slice plus a resume point.”
- `impact`: Callers who decode then filter, or who persist `line.offset` instead of `line.end`, double-deliver or skip lines; empty arrays look like “no restriction”.
- `suggestedFix`: `**Gotchas**` on `Slice`/`matchesFrame` for AND-combination, empty arrays, half-open `to` under `TestClock` collisions, and frame-only matching. Rewrite `CursoredSlice` lead around resume-from-`line.end`. Described `@see` to `EnvelopeFrame` and the envelope selected-decode operation.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-007
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-024: merge.ts implementation comments are the missing Gotchas/`@see` for appendPatch

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/internal/merge.ts:36, jsonl/internal/merge.ts:60, jsonl/internal/merge.ts:85
- `symbol`: isRecordLike, canMerge, shallowMerge
- `kind`: value
- `evidence`: Comments already warn: `Schema.Class` instances are record-like on purpose; `canMerge` is asymmetric unlike `@effected/config-file` (plain patch vs class base); `result[key] =` / `Object.assign` reassign `__proto__`; merged value is TRANSIENT (`Object.create` + `defineProperty`, constructor never ran). No `**Gotchas**` and no `@see {@link JournalShape.appendPatch}`.
- `impact`: Future refactors that return the merged object to callers bypass class invariants; a “fix” that symmetrizes `canMerge` silently replaces patches.
- `suggestedFix`: Lift those three comments into `**Gotchas**` on the owning exports. Described `@see` among `isRecordLike` / `canMerge` / `shallowMerge` and `appendPatch`. Examples must show pollution keys dropped and nested objects replaced, not deep-merged.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-009
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-025: tail.ts BOM / unclamped window / historical-read / streaming-decoder Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/internal/tail.ts:1, jsonl/internal/tail.ts:67, jsonl/internal/tail.ts:107, jsonl/internal/tail.ts:193
- `symbol`: probeBomBytes, readTail, readRangeText
- `kind`: value
- `evidence`: Module lead states historical `query` still reads the requested region in one allocation (effected#233) — a property of tail reads only. `probeBomBytes` exists because inferring BOM from window position silently shifted every offset by 3. `readTail` does not clamp `window`. `readRangeText` uses `TextDecoder` `{ stream: true }` because naive per-chunk decode corrupts non-ASCII at chunk boundaries. None promoted to `**Gotchas**` / described `@see {@link Line.lastValid}`.
- `impact`: Callers (or a later paging rewrite) that skip BOM probe or decode chunks independently emit wrong cursors or U+FFFD payloads.
- `suggestedFix`: `**Gotchas**` on the module or on `probeBomBytes` / `readTail` / `readRangeText`. Described `@see` to `DEFAULT_WINDOW`, `readTailUntil`, `Line.lastValid`. Do not document `CHUNK` (unexported).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-010
- `status`: open
- `fixedCommit`: pending

### jsonl-R1-026: utf8Length needs `@see Line.byteLength` (public wrapper)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonl/internal/utf8.ts:11
- `symbol`: utf8Length
- `kind`: value
- `evidence`: Lead already matches `TextEncoder#encode(...).length` including unpaired-surrogate U+FFFD (3 bytes). Public API is `Line.byteLength`; no described `@see`.
- `impact`: External callers should not import internals; without `@see` the leaf looks like the supported measuring API.
- `suggestedFix`: Described `@see {@link Line.byteLength}` for the public wrapper. Put the unpaired-surrogate rule in `**Gotchas**` if the Example does not already show it.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonl
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonl-R1-011
- `status`: open
- `fixedCommit`: pending

## Rejected false positives

1. **`JsonlEvent` declare-namespace required Example** (`jsonl/JsonlEvent.ts:86`). Census `kind: value` / `exportKind: namespace` / missing `@example`. Law: namespaces are pure type-level; Example optional. Confirm missing `@category`/`@since` only (jsonl-R1-004).
2. **`jsonl/index.ts` re-export `legacy-carrier` as an owning-export rewrite** (`jsonl/index.ts:34`). Graph edge; the JSDoc is the fileoverview leaking onto the first `export type { ... }`. Do not document barrel re-exports. Fix the module header instead (jsonl-R1-008).
3. **Per-member Examples** on `Envelope.*`, `Line.*`, `JournalShape.*`. One titled Example per owning value export is enough; extra Examples are out of scope.

## Pack verdict

- files reviewed: 11
- owning exports reviewed: 45
- confirmed mechanical items: 11
- editorial items: 15
- rejected false positives: 3
- accepted findings: 26
