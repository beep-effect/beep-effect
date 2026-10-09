I'll review the toml port against the pinned upstream oracle and the binding decisions, and report only findings. First I'm loading the decision record, port notes, and the module surface.The S1 gates are already green, so I'll diff the port against the pinned oracle and look for behaviour or idiom problems those gates would miss.The `Set` used for cycle detection is already allowlisted. Next I’ll compare the rewritten parser, semantic, and stringify paths against the pinned oracle for behaviour changes the tests can miss.The review is still open on the unread format, visitor, and edit paths. I will finish those comparisons against the pinned oracle, then report only findings the gates do not already enforce.Named literal schemas and the parser import are confirmed. Next I will check whether the format, visitor, and edit rewrites change behaviour the oracle still has.### grok-1-1
- file: scratchpad/effected/toml/TomlNode.ts:42
- class: schema   severity: required
- standard: effect-laws-v1.md law 19; standards/schema-first-development-prompt.md (LiteralKit for a named discriminator); D5 kit bar (jsonc: `JsoncParseErrorCode = LiteralKit(...)`)   evidence: `TomlKeyKind` (line 42) and `TomlStringStyle` (line 72) are exported, annotation-bearing `S.Literals(...).pipe($I.annoteSchema(...))` domains. `NonFiniteSpelling` (line 18) is a named internal literal domain used by the float codecs. The four beep-law checks do not enforce LiteralKit, so a green S1 gate does not cover this.
- failure: Callers get a bare literals schema, without `LiteralKit`'s `.Enum`, `.is`, and `.$match`. Decode of the same strings stays the same.
- fix: `import { LiteralKit } from "@beep/schema/LiteralKit"` and replace those three with `LiteralKit(...)`, keeping the existing `$I.annoteSchema` pipe on the two exports. Do not add `as const` on the inline arrays. Leave the anonymous newline unions at `Toml.ts:41` and `TomlFormat.ts:71` as `S.Literals`.

### grok-1-2
- file: scratchpad/effected/toml/TomlDiagnostic.ts:25
- class: schema   severity: required
- standard: effect-laws-v1.md law 19; D5   evidence: `TomlLexErrorCode` (line 25), `TomlParseErrorCode` (line 39), `TomlSemanticErrorCode` (line 53), and `TomlStringifyErrorCode` (line 67) are exported named schemas: `S.Literals(TOML_*_ERROR_CODES).pipe($I.annoteSchema(...))`. The source arrays in `internal/diagnostics.ts` are already `as const`.
- failure: The public error-code domains are named and annotated, so law 19 requires `LiteralKit`. Accepted codes do not change.
- fix: `LiteralKit(TOML_LEX_ERROR_CODES)` (and the three sibling arrays), then the same `$I.annoteSchema` pipe.

### grok-1-3
- file: scratchpad/effected/toml/TomlDateTime.ts:36
- class: schema   severity: required
- standard: effect-laws-v1.md law 18   evidence: `isRealCalendarDate` is the shared class filter for every `{ year, month, day }` value, and its annotation is only `{ title: "a real calendar date" }` (line 41). No beep-law checker requires `identifier` or `description` on `S.makeFilter`.
- failure: A failed calendar check has no stable filter identifier or description. The predicate's own message (`day N does not exist in ...`) is unchanged.
- fix: Add `identifier` and `description` next to the existing `title`. Leave the predicate body as it is.

### grok-1-4
- file: scratchpad/effected/toml/internal/parser.ts:47
- class: law   severity: required
- standard: effect-laws-v1.md law 1 (`import * as S from "effect/Schema"`)   evidence: This file imports `import * as Schema from "effect/Schema"` and calls `Schema.is` at lines 278–281. `effect-imports` rewrites root `effect` barrel imports and keeps the local binding (`EffectImports.ts` writes `namespaceImport: localName`); it does not require the `effect/Schema` binding to be `S`. The other three S1 laws do not either, which is why the green gate missed it. `SchemaIssue` and `SchemaTransformation` bindings in the sibling files match their module names and are fine.
- failure: The Schema namespace violates the A/O/P/R/S alias law. Runtime checks are the same `S.is` calls.
- fix: Rename the binding to `S` and update the four `Schema.is` calls.

### grok-1-5
- file: scratchpad/effected/toml/Toml.ts:181
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (carrier policy: `**Example** (Title)` and `**Details**` / `**Gotchas**`; `@example` and `@remarks` are forbidden); AGENTS.md JSDoc law   evidence: S2 has not run. `@example` / `@remarks` / `@public` remain on the public surface, including `Toml.ts:173` and `:181`, `index.ts:4`, `TomlDocument.ts:58` and `:70`, `TomlFormat.ts:852` and `:866`, `TomlEdit.ts:55`, `TomlDiagnostic.ts:101`, and `TomlVisitor.ts:192` and `:216`.
- failure: Published docs still use the upstream TSDoc carriers, so they fail the beep JSDoc law once S2 runs.
- fix: During S2, convert those blocks to a lead paragraph plus `**Details**` / `**Gotchas**` and titled `**Example**` sections. Keep the example bodies.

### grok-1-6
- file: scratchpad/effected/toml/README.md:158
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 and D9   evidence: Port notes and the `w1-toml` ledger row both say deviations are none. These accepts/defects differ from the pinned oracle and are law-forced, so they must be recorded and not reverted:
  - `TomlNode.ts:101` `TomlInteger.value` is `S.Union([S.Finite, S.BigInt])` where upstream is `Schema.Union([Schema.Number, Schema.BigInt])`. The same `S.Finite` replacement covers span `offset`/`length` on the node classes, `TomlDiagnostic.ts:112`, and `TomlEdit.ts:47` and `:64`. `Class.make` and schema decode now reject `NaN` and infinities on those fields. Parsed documents are unchanged because the scanner only emits finite spans and finite integers. Cause: tsgo `schemaNumber`. The float value path stays `IeeeNumber` under the recorded suppression in `DIAGNOSTIC_EXCEPTIONS.md`.
  - `internal/limits.ts:49` `assertCap` throws `TomlCapError` where upstream throws `TypeError`, with the same message. Nothing in this module calls it. Cause: law 7.
  - `TomlEdit.ts:87` overlap defects throw `TomlEditInvariantError` where upstream throws `Error`. The message text matches. Cause: law 7.
  - `internal/stringifyValue.ts:304` a hole in an array-of-tables throws `TomlStringifyInvariantError`. Upstream casts the array and then throws `TypeError` from emitting `undefined`. `Array.every` skips holes, so classify still treats that array as an array of tables. Cause: D15 plus law 7. The same pattern is the `TomlSemanticInvariantError` / `TomlFormatInvariantError` throws on missing keys the semantic pass treats as impossible.
- failure: A later reader treats the port as byte-for-byte with upstream. Non-finite schema input and those defect carriers are different.
- fix: Add one ledger `deviations` row per difference with `reason: "law:schemaNumber"`, `"law:7"`, or `"law:D15"`, and mirror them under README Port notes. Do not widen the schemas back to `S.Number` or restore `TypeError` / `Error`.

### grok-1-7
- file: scratchpad/effected/toml/README.md:50
- class: docs   severity: backlog
- standard: effect-laws-v1.md law 2 (no root `effect` barrel, including Markdown examples)   evidence: Quick-start fences import `{ Effect, Schema } from "effect"` at lines 50, 70, 85, and 118, and import `Toml` from `@effected/toml`.
- failure: The README examples teach the barrel import law 2 forbids. Docgen will reject them when S2 checks Markdown fences.
- fix: During S2, split those imports into `effect/Effect` and `effect/Schema` (`import * as Effect` / `import * as S`). Point the package import at the lab entry the port actually publishes.

REQUIRED: 4
BACKLOG: 3
