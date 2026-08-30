# Pack jsonc — round 1 JSDoc review

Kit-port of `@effected/jsonc` under `scratchpad/jsonc/`. Public examples must
import `@beep/scratchpad/jsonc` (docgen path alias in `scratchpad/docgen.json`),
never `@effected/jsonc`. `//` file headers are not JSDoc module docs.

Census open modules: 12 (index skipped because `owningExportCount === 0`).
Owning exports: 55. Re-exports: 9 (not documented as symbols).

## Mechanical (one item per file)

### jsonc-R1-001: Barrel module header missing `@since`; census skipped the file

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/index.ts:1
- `symbol`: jsonc/index.ts
- `kind`: module
- `evidence`: Fileoverview has a useful lead and `@packageDocumentation` but no `@since 0.0.0`. Census `hasSince: false` / `hasLegacyExample: true` with `findings: []` because module findings run only when `owning.length > 0`. Re-exports are graph edges, not owning symbols.
- `impact`: The package entry point is the first surface callers and docgen see; missing `@since` fails the module-header law even though the census pack README lists `moduleFindings=none`.
- `suggestedFix`: Keep the lead. Add `@since 0.0.0` after `@packageDocumentation`. Do not attach this block to the `JsoncBoundCodec` re-export. Convert the legacy `@example` in jsonc-R1-014 (same block).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-014
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-002: `Jsonc.ts` `//` header and 11 owning exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/Jsonc.ts:1
- `symbol`: Jsonc.ts module + owning exports
- `kind`: module
- `evidence`: Module findings `missing-module-summary|missing-packageDocumentation|missing-module-since` (`//` header at L1–13, not `/**`). `@public` without `@category`/`@since` on every owning export. Value-level also lack a titled `**Example** (Title)` except `Jsonc` (legacy `@example` only). Symbols: `JsoncParseErrorCode` value L33 (`constants`) + type L40 (`type-level`); `JsoncParseErrorDetail` L49 (`errors`); `JsoncParseError` L65 (`errors`); `JsoncParseOptions` L90 (`configuration`); `JsoncStringifyErrorCode` value L109 (`constants`) + type L116 (`type-level`); `JsoncStringifyOptions` L129 (`configuration`); `JsoncStringifyError` L144 (`errors`); `JsoncBoundCodec` L240 (`type-level`); `Jsonc` L268 (`parsing`).
- `impact`: Zero-legacy/docgen ratchet: no canonical category/since, and value exports are not example-complete under the titled-Example carrier.
- `suggestedFix`: Promote the `//` header into a JSDoc lead plus `@packageDocumentation` `@since 0.0.0`. On each export keep useful leads, add `@category` (slugs above) and `@since 0.0.0` after `@public`. Add one titled observable Example per value export (types: prose only). Class `Jsonc` Example conversion is jsonc-R1-014. Drop signature-echo `@returns` on members when touching those blocks.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-014, jsonc-R1-015, jsonc-R1-016
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-003: `JsoncEdit.ts` `//` header and 4 owning exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncEdit.ts:1
- `symbol`: JsoncEdit.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–12. Missing module lead/`@packageDocumentation`/`@since`. `@public` without `@category`/`@since`/titled Example on `JsoncRange` L23 (`models`), `JsoncFormattingOptions` L45 (`configuration`), `JsoncEdit` L79 (`models`). Type `JsoncFormattingOptionsLike` L63 missing `@category`/`@since` (`type-level`).
- `impact`: Shared edit/range vocabulary has no compilable Examples and no categories for the formatter/modifier callers.
- `suggestedFix`: Convert the `//` header to JSDoc module docs. Tag exports; one Example on `JsoncRange.make`, `JsoncFormattingOptions.make`, and `JsoncEdit.applyAll` (non-overlapping insert/replace). Type alias: described `@see {@link JsoncFormattingOptions}` only. Prose mention of `@effected/yaml` may stay as a parity note.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-017
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-004: `JsoncFingerprint.ts` `//` header and 5 owning exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncFingerprint.ts:1
- `symbol`: JsoncFingerprint.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–14. Missing module tags. `@public` without `@category`/`@since` on `JsoncCanonicalizeErrorCode` value L48 (`constants`) + type L62 (`type-level`); `JsoncCanonicalizeError` L74 (`errors`); `JsoncTextHashOptions` L95 (`configuration`); `JsoncFingerprint` L288 (`utilities`). Value exports except the class lack any Example; the class has only legacy `@example`.
- `impact`: Canonicalize/hash API is undocumented under repo grammar; callers cannot tell it from `Jsonc.stringify` from tags alone.
- `suggestedFix`: Module JSDoc from the `//` header. Add tags. Examples: literals schema, `JsoncCanonicalizeError.make`, `JsoncTextHashOptions.make`, and class Example per jsonc-R1-018. Type companion: prose + `@see` to the const.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-018
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-005: `JsoncFormatter.ts` `//` header and `JsoncFormatter` missing tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncFormatter.ts:1
- `symbol`: JsoncFormatter
- `kind`: value
- `evidence`: `//` header L1–7 (symmetry with yaml, pure/total). Class L19 lead is thin ("Pure JSONC formatting statics. Not instantiable."). `@public` only. Census `missing-required-tags` `@category` `@since` `@example`.
- `impact`: Callers cannot see `format` vs `formatToString` or that edits must be applied with `JsoncEdit.applyAll`.
- `suggestedFix`: Module JSDoc from the `//` header. Expand the class lead with that purpose. `@category formatting` `@since 0.0.0`. One titled Example: `format` then `JsoncEdit.applyAll`, or `formatToString`, with a comment in the source. Described `@see {@link JsoncEdit.applyAll}` and `{@link JsoncFormattingOptions}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-006: `JsoncModifier.ts` `//` header and 3 owning exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncModifier.ts:1
- `symbol`: JsoncModifier.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–6. `@public` without `@category`/`@since` on `JsoncModificationError` L37 (`errors`, also legacy `@remarks` — jsonc-R1-019), `JsoncModifyOptions` L54 (`type-level`), `JsoncModifier` L69 (`utilities`). Class lead is thin. Value exports missing titled Example.
- `impact`: Path modify/delete is the comment-preserving alternative to parse/stringify round-trip and currently has no Example.
- `suggestedFix`: Module JSDoc from the `//` header. Tags as above. Example: `JsoncModifier.modify` then `JsoncEdit.applyAll` to set a key and to delete with `undefined`. Type interface: prose + `@see {@link JsoncFormattingOptionsLike}`. Move `@remarks` in jsonc-R1-019.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-019
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-007: `JsoncNode.ts` `//` header and 6 owning exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncNode.ts:1
- `symbol`: JsoncNode.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–9 (no parent pointers; `Schema.suspend` children). Missing module tags. `@public` without `@category`/`@since` on `JsoncSegment` L20 (`type-level`), `JsoncPath` L28 (`type-level`), `JsoncNodeType` value L37 (`constants`) + type L44 (`type-level`), `JsoncNode` L65 (`models`). `makeNodeUnsafe` L165 is an owning value with no `@category`/`@since`/Example; census `tags: ["@4"]` is a false `@(\w+)` hit on `effect@4.0.0-beta.97` in the lead (jsonc-R1-020).
- `impact`: AST construction/navigation has no Examples; `makeNodeUnsafe` looks public-ish without `@internal`.
- `suggestedFix`: Module JSDoc from the `//` header. Tags; `@internal` on `makeNodeUnsafe` plus `@category constructors`. Examples: `JsoncNodeType` literal, `JsoncNode.make` + `find`/`toValue`. Types: described `@see` only. Rewrite `makeNodeUnsafe` lead in jsonc-R1-020.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-020
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-008: `JsoncVisitor.ts` `//` header and 3 owning exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncVisitor.ts:1
- `symbol`: JsoncVisitor.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–11 (in-band `Error` events; no `visitCollect`). `@public` without `@category`/`@since` on `JsoncVisitorEvent` type L40 (`type-level`) + value L64 (`constructors`), `JsoncVisitor` L71 (`streams`). Class lead is thin. Values missing titled Example.
- `impact`: Callers will treat `visit` like `parseTree` (failing Effect) unless the stream contract is tagged and exemplified.
- `suggestedFix`: Module JSDoc from the `//` header. Tags. Example: `JsoncVisitorEvent.LiteralValue(...)` and `Stream.runCollect(JsoncVisitor.visit(text))` showing a `Comment` plus an in-band `Error`. Type: `@see` to the const. Gotcha in jsonc-R1-021.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-021
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-009: `internal/limits.ts` missing module tags; `MAX_NESTING_DEPTH` missing tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/internal/limits.ts:1
- `symbol`: MAX_NESTING_DEPTH
- `kind`: value
- `evidence`: `//` header L1–6. Census `missing-packageDocumentation|missing-module-since` (lead exists on the const, so no `missing-module-summary`). Const L22: useful lead, no `@category`/`@since`/Example. Census tags include `@link`/`@effected` from prose `` `@effected/yaml` ``, not real tags.
- `impact`: The shared 256 cap is the DoS bound for parser, `toValue`, `equals`, visitor, and canonicalize; it needs a constant Example and `@category constants`.
- `suggestedFix`: Turn the `//` header into module JSDoc (`@packageDocumentation` `@since 0.0.0`). On the const: `@category constants` `@since 0.0.0` `@internal`. Example: `MAX_NESTING_DEPTH === 256`. Described `@see` to `JsoncParseErrorCode` / visitor `Error` `NestingDepthExceeded`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-010: `internal/navigate.ts` `//` header and 6 owning exports missing tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/internal/navigate.ts:1
- `symbol`: navigate.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–9 (scanner tokens, not `lastIndexOf`). Missing module tags. Types with leads but no `@category`/`@since`: `Located` L17, `Insert` L38, `Mismatch` L50, `NoOp` L57, `NavigateResult` L62 (`type-level`). `navigate` L69 missing `@category utilities` `@since` and titled Example.
- `impact`: Modifier authors (and the next port) cannot see `Located` vs `Insert` vs `Mismatch` vs `NoOp` as a closed result without tags/Example.
- `suggestedFix`: Module JSDoc from the `//` header. Tag all six. One Example for `navigate`: locate a key, insert-miss, and mismatch. Interfaces: described `@see {@link navigate}` / `{@link NavigateResult}`. Mark `@internal`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-011: `internal/parser.ts` `//` header and 9 owning exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/internal/parser.ts:1
- `symbol`: parser.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–13 (raw `{ code, offset, length }`; must not import `Jsonc.ts`). Missing module tags. Values: `JSONC_PARSE_ERROR_CODES` L28 (`constants`), `scanErrorToCode` L81 (`mapping`), `parseValue` L563 (`parsing`), `parseTree` L569 (`parsing`) — no `@category`/`@since`/Example. Types: `ParseCode` L49, `RawParseError` L52, `ParseFlags` L59, `ParseValueResult` L66, `ParseTreeResult` L72 — no `@category`/`@since`.
- `impact`: Internal parse still returns recovered `value`/`root` plus `errors`; without Examples, facades will be documented as if that pair were public.
- `suggestedFix`: Module JSDoc from the `//` header (cycle firewall belongs in Details). Tag exports `@internal`. Examples: codes array includes `NestingDepthExceeded`; `scanErrorToCode("None")` is `undefined`; `parseValue("{ bad }")` has `errors.length > 0` and a recovered `value`. Types: `@see` to `JsoncParseError` (facade maps raw records) and to `parseValue`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-015
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-012: `internal/scanner.ts` missing module tags; 4 owning exports missing tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/internal/scanner.ts:1
- `symbol`: scanner.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–12 (no public tokenizer; line/character derived in the facade). Census `missing-packageDocumentation|missing-module-since`. Types `SyntaxKind` L15, `ScanError` L35, `Scanner` L46 missing `@category type-level` `@since`. `createScanner` L75 has `@param` but no `@category constructors` `@since`/Example.
- `impact`: Offset-only scanner vs facade `line`/`character` is easy to miss; `ignoreTrivia` changes whether comments exist as tokens (`stripComments` depends on `false`).
- `suggestedFix`: Module JSDoc from the `//` header. Tag four exports `@internal`. Example: scan `{ // c\n }` with `ignoreTrivia` false vs true and log `LineComment` presence. `@see {@link JsoncParseErrorDetail}` for why the scanner does not track lines.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-013: `internal/skip.ts` `//` header and 2 owning exports missing tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/internal/skip.ts:1
- `symbol`: skip.ts module + owning exports
- `kind`: module
- `evidence`: `//` header L1–10 (iterative bracket skip; security-relevant). Missing module tags. `SkipCursor` L21 (`type-level`) and `skipBalancedValue` L46 (`utilities`) missing required tags; the function has no Example. Lead already documents the closer/EOF guard — keep it, do not invent empty Gotchas.
- `impact`: Parser, navigator, and visitor share this skip; an Example of the empty-range closer case is the contract.
- `suggestedFix`: Module JSDoc from the `//` header. Tags `@internal`. Example: cursor on `}` returns `tokenStart()` without advancing. `@see {@link SkipCursor}` on the function.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial

### jsonc-R1-014: Kit-port `@example` / `@effected/jsonc` / named `Schema`/`Option` on the barrel and `Jsonc`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/index.ts:9, jsonc/Jsonc.ts:255, jsonc/Jsonc.ts:280, jsonc/Jsonc.ts:348, jsonc/Jsonc.ts:422, jsonc/Jsonc.ts:589, jsonc/Jsonc.ts:635, jsonc/Jsonc.ts:675
- `symbol`: Jsonc
- `kind`: value
- `evidence`: Retired `@example` on `jsonc/index.ts` L9, `Jsonc` L255, `parseResult` L286, `parseTreeResult` L348, `stringifyResult` L422, `bind` L675. Retired `@remarks` on `parseResult` L280, `parseTreeResult` L342, `stringifyResult` L416, `fromString` L589, `schema` L635, `bind` L670. Every fence is `import { Jsonc } from "@effected/jsonc"` plus named `Schema`/`Option` from `"effect"` (`index.ts` L12, `bind` L678, `parseTreeResult` L351). `Effect.gen` programs are bound and never run (`index.ts` L17–20, `Jsonc` L260–263) — vacuous. `index.ts` L23 `@see {@link https://effect.website | Effect}` has no purpose phrase after the link.
- `impact`: Zero-legacy ratchet fails on `@example`/`@remarks`. Examples will not compile under scratchpad docgen (`@beep/scratchpad/jsonc` alias). Named `Schema`/`Option` violate namespace-import law. Unused `program` bindings hide the actual parse result.
- `suggestedFix`: Convert the barrel and `Jsonc` class to one titled `**Example** (Parse JSONC with a line comment)` each, importing `import { Jsonc } from "@beep/scratchpad/jsonc"` and `import * as S from "effect/Schema"` / `import * as O from "effect/Option"` as needed. Run or `console.log` an observable value (`Effect.runSync` / `Result.getOrThrow`). Move each `@remarks` into **Details** (Result twin vs Effect twin; bind `fromString`/`schema` to a `const`). Keep useful member Examples in place as titled sections — do not pile them onto the class. Replace the barrel `@see` with `@see {@link Jsonc} for the parse/stringify/schema facade.`
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-001, jsonc-R1-002
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-015: Aggregate `JsoncParseError` discards recovered values — missing Gotchas/`@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/Jsonc.ts:65, jsonc/Jsonc.ts:308, jsonc/Jsonc.ts:371, jsonc/internal/parser.ts:563
- `symbol`: JsoncParseError
- `kind`: value
- `evidence`: Lead says one failure reports the whole batch. Implementation: `parseValueInternal`/`parseTreeInternal` always return recovered `value`/`root` plus `errors`; `parseResult`/`parseTreeResult` then `Result.fail` whenever `errors.length > 0`, dropping the recovered value (L310–313, L376–378). `message` joins every `code at line:character`. File header L9–12: facade maps raw `{ code, offset, length }` and derives `line`/`character`. No **Gotchas**, no `@see` to `JsoncParseErrorDetail` / `parseResult` / internal `parseValue`. Schema factories wrap the same aggregate as `SchemaIssue.InvalidValue`.
- `impact`: Callers expecting Microsoft jsonc-parser `{ value, errors }` or a partial `JsoncNode` on failure get neither. Diagnostics live only on `JsoncParseError.errors`; `equals`/`equalsValue` treat any parse error as `false` rather than comparing recovery artifacts.
- `suggestedFix`: On `JsoncParseError` add **Gotchas**: any recovered value/tree is discarded; inspect `errors` (and `input`) on the tagged failure; `line`/`character` are derived from `offset` in the facade, not the scanner. Described `@see {@link JsoncParseErrorDetail}` for per-span codes; `@see {@link Jsonc.parseResult}` for the Result twin; `@see {@link parseValue}` only if internals stay documented as the recovery pair the public API does not expose. Example: `Jsonc.parseResult("{ bad }")` logs `_tag` and `errors.length > 1` or a multi-error input. Mirror a short Gotcha on `Jsonc.parse`/`parseTree` pointing at this error. Do not add empty When to use.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-002
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-016: `Jsonc.stripComments` offset contract missing Gotchas/`@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/Jsonc.ts:499
- `symbol`: Jsonc.stripComments
- `kind`: value
- `evidence`: `@param replaceCh` already says omitted deletes comments and offsets shift; with a character, replacements keep offsets and keep `\n`/`\r` inside block comments. Implementation L526–531 replaces every comment code unit with `replaceCh` except `0x0a`/`0x0d` (LS/PS `0x2028`/`0x2029` are replaced). Type is `string`, not a 1-char schema — a multi-character `replaceCh` expands offsets. Scanner tokenization means `//` inside strings is not stripped. No **Gotchas**. No `@see` to `JsoncEdit` / `JsoncParseErrorDetail` (those offsets are against the original document). Member is undocumented as an owning export (class-level Example will not show this unless the class Example or a member Example does).
- `impact`: Applying `JsoncEdit` or parse-error spans to stripped text without `replaceCh` silently mis-aligns. Passing `"  "` (two spaces) as `replaceCh` is typed but not offset-preserving.
- `suggestedFix`: Add **Gotchas** on `stripComments` (and mention in the `Jsonc` class Details if the class Example stays parse-only): omit `replaceCh` only when no later offset is used; pass a single character (typically `" "`) to keep `JsoncEdit`/`JsoncParseErrorDetail` offsets valid; block-comment line breaks stay; `replaceCh` is not length-checked. **Example** (Preserve offsets vs shift): strip `'{ "a": 1 // c\n }'` with and without `" "` and compare `.length` / index of `"a"`. `@see {@link JsoncEdit}` for edits that assume original offsets; `@see {@link Jsonc.parse}` when the goal is a value rather than JSON text.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-002, jsonc-R1-014
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-017: `JsoncEdit.applyAll` overlapping edits throw a defect — missing `@throws`/Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncEdit.ts:84
- `symbol`: JsoncEdit
- `kind`: value
- `evidence`: Method JSDoc L85–88: overlapping edits are a programmer error and throw; `JsoncFormatter` never produces them. Implementation L96–103 `throw new Error("JsoncEdit.applyAll received overlapping edits...")` after sorting reverse-offset. No `@throws`, no **Gotchas**. Law: `@throws` only for synchronous throws outside the typed error channel — this is one.
- `impact`: Callers synthesizing edits (not just formatter output) can hit an untyped throw. Reverse-offset application is the reason unsorted input is OK if spans do not overlap.
- `suggestedFix`: On `applyAll` add **Gotchas**: input order is irrelevant; overlap throws. `@throws` overlapping edits throw an `Error` (defect), not a tagged schema error. Class Example should apply two non-overlapping edits and show the result. Described `@see {@link JsoncFormatter.format}` for a producer that never overlaps.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-003
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-018: `JsoncFingerprint` legacy `@example`/`@remarks`, `@effected/jsonc`, vacuous hash

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncFingerprint.ts:271, jsonc/JsoncFingerprint.ts:303, jsonc/JsoncFingerprint.ts:416
- `symbol`: JsoncFingerprint
- `kind`: value
- `evidence`: Class `@example` L271 imports `@effected/jsonc`; `hash` is yielded inside `Effect.gen` that is never provided `Crypto.Crypto` and never run (`return a === b; // true`). `canonicalizeResult` `@remarks` L303 + `@example` L309 (`@effected/jsonc`). `hashText` `@example` L416 same import. Prose L386/L412 `@effected/sbom` is a digest-format note, not an example import.
- `impact`: Examples fail the kit-port import rule and the observable-result bar. `hash` without `Effect.provide` does not typecheck as a runnable program.
- `suggestedFix`: One class **Example** (Canonicalize key order) using `JsoncFingerprint.canonicalizeResult` and `Result` — no Crypto. Convert `canonicalizeResult` `@remarks` to Details (Effect twin vs Result twin). Keep `hash`/`hashText` as separate titled Examples only if they `Effect.provide` a `Crypto` layer or stay un-run composition with an explicit comment that R includes `Crypto.Crypto`; otherwise document hashing in Details + `@see`. Import `@beep/scratchpad/jsonc`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-004
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-019: `JsoncModificationError` retired `@remarks`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncModifier.ts:27
- `symbol`: JsoncModificationError
- `kind`: value
- `evidence`: Census `legacy-remarks`. Block L27–33: structure-preserving fields vs `YamlModificationError`; `offset` currently always omitted. That content is real, but the carrier is forbidden.
- `impact`: Zero-legacy on `@remarks`. The reserved `offset` field is the actual caller trap and is buried in the tag.
- `suggestedFix`: Move the yaml-parity sentence into **Details**. **Gotchas**: `offset` is reserved and currently omitted — navigation is structural. Example: construct or catch `JsoncModifier.modify` mismatch and log `expected`/`depth`. `@category errors` `@since 0.0.0`. `@see {@link JsoncModifier.modify}` for the only producer.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-006
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-020: `makeNodeUnsafe` lead is refactor history

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncNode.ts:141
- `symbol`: makeNodeUnsafe
- `kind`: value
- `evidence`: Lead L141–163 narrates issue #13, measured `~4s` at depth 20, and `effect@4.0.0-beta.97`. Law: documentation describes the symbol for its next reader — never the refactor that produced it. The contract (trusted parser only; omit absent optionals, never pass explicit `undefined`; not re-exported) is the reader-facing part and is currently mixed with history. Census `tags: ["@4"]` is the `@4.0.0` substring.
- `impact`: Callers (and grep for `@internal`) cannot see the undefined-omit contract quickly; a fake `@4` tag pollutes census.
- `suggestedFix`: Rewrite the lead around the contract. **Gotchas**: omit missing optionals; external code uses `JsoncNode.make`. Drop issue/version/benchmark sentences. `@internal` `@category constructors` `@since 0.0.0`. Small Example constructing a leaf `string` node (or skip a large tree Example). `@see {@link JsoncNode}` for the validating constructor.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-007
- `status`: open
- `fixedCommit`: pending

### jsonc-R1-021: `JsoncVisitor.visit` in-band errors and options subset — missing Gotchas/`@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncVisitor.ts:74
- `symbol`: JsoncVisitor
- `kind`: value
- `evidence`: Method L75–84: stream is infallible; malformed input is `Error` events. Implementation L86 uses only `options?.disallowComments` (`allowTrailingComma` / `allowEmptyContent` are ignored). File header and L94–97: at `MAX_NESTING_DEPTH` one in-band `Error` and iterative skip. No **Gotchas**. No `@see` to `Jsonc.parseTree` (AST) vs `visit` (stream).
- `impact`: Passing full `JsoncParseOptions` looks like parse parity but trailing-comma/empty-content flags do nothing. Pulling the stream will not fail; forgetting to match `Error` drops diagnostics.
- `suggestedFix`: **Gotchas**: only `disallowComments` is read; failures are `JsoncVisitorEvent.Error`, including `NestingDepthExceeded` with a skipped subtree. `@see {@link Jsonc.parseTree}` when a complete tree or aggregate `JsoncParseError` is required; `@see {@link JsoncVisitorEvent}` for the union. Example should `Stream.take` or collect and show both a `Comment` and an `Error`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R1-008
- `status`: open
- `fixedCommit`: pending

## Rejected (do not open)

- `jsonc/index.ts:28` `JsoncBoundCodec` re-export `legacy-carrier`: TypeScript attaches the fileoverview to the first export. Document the module (jsonc-R1-001 / jsonc-R1-014), not the re-export.
- Extra class-level Examples cloned from `parseResult` / `parseTreeResult` / `stringifyResult` / `bind` / `canonicalizeResult` / `hashText` when the class already has one titled Example. Convert member fences in place or drop them if the class Example already teaches the job.
- Type-level exports flagged only for `@category`/`@since` (no `@example`): census is correct; do not add placeholder Examples.
- Empty `**When to use**` / `**Details**` on thin facade classes (`JsoncFormatter`, `JsoncModifier`, `JsoncVisitor`): promote the `//` header into the lead/module block instead.
- `$I.annote` / `$I.annoteSchema` on these `Schema.Class` / `Schema.Literals` values: scratchpad jsonc has no package `$I` composer. Same-name type aliases already exist for the Literals schemas. Not doctrine for this kit-port until identity wiring exists.

## Pack verdict

- files reviewed: 13
- owning exports reviewed: 55
- confirmed mechanical items: 13
- editorial items: 8
- rejected false positives: 1
- accepted findings: 21

Every exporting module and every owning export was reviewed. Index barrel re-exports were not treated as documentation subjects. All 55 census `missing-required-tags` rows are confirmed. Census module findings on 12 files are confirmed (`//` headers). Index module `findings: []` is a census skip (`owningExportCount === 0`), not cleanliness — jsonc-R1-001. No file was skipped.
