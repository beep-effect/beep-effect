# Pack yaml-public — round 1 inventory

- reviewer: jsdoc-annotation-specialist
- scope: `scratchpad/yaml/` excluding `yaml/internal/`
- census: 11 modules, 80 owning exports, 16 barrel re-exports

Census mechanical findings are confirmed for every open module and every owning export. `yaml/index.ts` is a barrel (0 owning exports) and must not grow per-symbol docs, but its module block still violates header law (`@remarks`, missing `@since 0.0.0`) even though census `findings` is empty.

Rejected false positive: census `tags` on `YamlStringifyOptions` includes `@parcel` because the lead cites `@parcel/watcher`; that is prose, not a JSDoc tag.

## Items

### yaml-public-R1-001: Yaml.ts module header, legacy carriers, missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/Yaml.ts:1
- `symbol`: YamlParseOptions, YamlStringifyOptions, YamlParseError, YamlStringifyError, YamlBoundCodec, Yaml
- `kind`: module
- `evidence`: File opens with a `//` architecture comment, not a JSDoc lead with `@packageDocumentation` and `@since 0.0.0` (census `missing-module-summary|missing-packageDocumentation|missing-module-since`). Owning exports all carry `@public` without `@category` or `@since 0.0.0`. Value exports lack titled `**Example** (Title)`: `YamlParseOptions` (55), `YamlStringifyOptions` (113), `YamlParseError` (186), `YamlStringifyError` (206), `Yaml` (458). `YamlBoundCodec` (423, type) is missing `@category`/`@since` only. Retired carriers on owning exports: `@example` on `YamlParseOptions`/`YamlStringifyOptions`/`Yaml`; `@remarks` on `Yaml`. Whole-file ratchet also hits method blocks census does not own: `Yaml.stringify` `@remarks` (503), `parseResult` `@remarks`/`@example` (521), `parseAllResult` `@remarks`/`@example` (560), `stringifyResult` `@example` (608), `bind` `@remarks`/`@example` (817).
- `impact`: jsdoc-ratchet zero-legacy fails on `@example`/`@remarks`; docgen cannot score this facade; callers of the kit entry points have no compilable Examples.
- `suggestedFix`: Replace the `//` header with a useful module lead, `@packageDocumentation`, and `@since 0.0.0` (never `@module`). On every owning export add a useful lead (keep the existing semantics), `@category` (`configuration` for options, `errors` for the tagged errors, `type-level` for `YamlBoundCodec`, `codecs` for `Yaml`), `@since 0.0.0`. Convert every `@example` into a titled `**Example** (Title)` with one `ts` fence and an observable result; move every `@remarks` into `**Details**` or `**Gotchas**` (do not drop `lineWidth` inertness, `<<` quoting, Effect-vs-Result, or schema-producing bind). Keep `@public` before `@category`/`@since`. Type-level `YamlBoundCodec` needs prose + tags, not an Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-002: YamlDiagnostic.ts module header and missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlDiagnostic.ts:1
- `symbol`: YamlLexErrorCode, YamlParseErrorCode, YamlComposerErrorCode, YamlStringifyErrorCode, YamlModifyErrorCode, YamlErrorCode, YamlDiagnostic
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. All 13 owning exports (`const`+`type` pairs at 29/36, 43/50, 57/64, 71/78, 86/93, 101/114, class at 129) miss `@category`/`@since`. Value schemas miss a titled Example. `YamlDiagnostic` uses retired `@remarks` (122) and has no Example.
- `impact`: Diagnostic and error-code schemas are the typed-error vocabulary for every fallible YAML entry point; missing tags and the `@remarks` carrier fail the ratchet and leave fatality undocumented in the canonical grammar.
- `suggestedFix`: JSDoc module header with `@packageDocumentation` `@since 0.0.0`. Value schemas: `@category schemas` plus one titled Example decoding or matching a code. Same-name types: `@category type-level`, described `@see` to the runtime schema, no Example. `YamlDiagnostic`: `@category diagnostics`; move jsonc five-field parity into `**Details**`; add an Example constructing a diagnostic and calling `YamlDiagnostic.isFatal`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-003: YamlDocument.ts module header and missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlDocument.ts:1
- `symbol`: YamlDirective, YamlDocument, documentFromRaw
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. `YamlDirective` (28), `YamlDocument` (50), and `@internal` `documentFromRaw` (235) miss `@category`/`@since` and a titled Example. Method `YamlDocument.stringify` uses `@remarks` (134) for the `lineWidth` inertness contract.
- `impact`: Callers choosing AST parse vs value parse have no Example, and the stringify folding gotcha lives on a retired carrier that the file-level ratchet will fail.
- `suggestedFix`: Module JSDoc header. `YamlDirective`/`YamlDocument`: `@category models`, titled Examples (`parse`/`parseAll`/`stringify`/`toValue` with `Effect` run or `console.log`). Keep `@internal` on `documentFromRaw`, add `@category utilities` `@since 0.0.0`, and a small Example showing recovered-document materialization (lint’s use). Move stringify `@remarks` into class or method `**Gotchas**`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-004: YamlEdit.ts module header, remarks, missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlEdit.ts:1
- `symbol`: YamlSegment, YamlPath, YamlRange, YamlEdit
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. Types `YamlSegment` (22) and `YamlPath` (30) miss `@category`/`@since`. Values `YamlRange` (39) and `YamlEdit` (55) miss those plus a titled Example. `YamlEdit` uses `@remarks` (48) for jsonc parity.
- `impact`: The non-mutating edit vocabulary is the differentiator over round-trip stringify; without tags/Examples and with `@remarks`, callers cannot learn `applyAll` from hover docs that pass the ratchet.
- `suggestedFix`: Module JSDoc header. Types: `@category type-level` with described `@see`. `YamlRange`: `@category models`. `YamlEdit`: `@category models`; move jsonc parity into `**Details**`; add a titled Example of insert/replace/delete plus `YamlEdit.applyAll`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-005: YamlFormat.ts module header, legacy carriers, missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlFormat.ts:1
- `symbol`: YamlRangeLike, YamlFormattingOptions, YamlModificationError, YamlFormat
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. `YamlRangeLike` (38, type) misses `@category`/`@since`. `YamlFormattingOptions` (81) has `@example` and misses `@category`/`@since`. `YamlModificationError` (103) and `YamlFormat` (492) miss `@category`/`@since` and a titled Example. Retired `@remarks` on `YamlFormat` (463) and methods `format` (519) and `modify` (596).
- `impact`: Format vs modify contracts (total vs typed error, stream vs single-document, directive refusal) live on forbidden carriers; the one existing example cannot compile under docgen.
- `suggestedFix`: Module JSDoc header. Categories: `type-level`, `configuration`, `errors`, `formatting`. Convert the options `@example` and add a class-level Example for `YamlFormat.formatToString` / `modify`. Move every `@remarks` into `**Details**`/`**Gotchas**` without dropping stream, directive, range-precedence, `requoteScalars`, or `<<` rules.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-006: YamlLint.ts module header, remarks, missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlLint.ts:1
- `symbol`: YamlLintRuleSetting, YamlLintConfig, StyleVoteTally, StyleFloorTally, StyleEvidence, StyleConflict, YamlStyleConflictError, YamlLintInference, YamlLint
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. Ten owning exports (30/40, 96, 199, 218, 263, 343, 359, 473, 527) all miss `@category`/`@since`. Every value export misses a titled Example. `YamlLint` uses `@remarks` (520). Type `YamlLintInference` is tags-only.
- `impact`: The lint facade is the public rule loop; without Examples callers cannot see `run`/`fix`/`inferStrict` vs `inferLenient`, and `@remarks` fails zero-legacy.
- `suggestedFix`: Module JSDoc header. Categories: `schemas`/`type-level` for the setting, `configuration` for `YamlLintConfig`, `models` for tallies/evidence/conflict/inference, `errors` for `YamlStyleConflictError`, `utilities` for `YamlLint`. Add titled Examples on values (preset spread, `run` finding, `fix` Result, `inferLenient` residual). Move the pure-half `@remarks` into `**Details**`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-007: YamlLintRule.ts module header and missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlLintRule.ts:1
- `symbol`: YamlLintSeverity, YamlLintDiagnostic, LintLine, LintContext, StyleVote, StyleFloor, StyleObservation, YamlRule
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. Nine owning exports (22/29, 43, 61, 83, 110, 132, 143, 164) miss `@category`/`@since`. Values `YamlLintSeverity`, `YamlLintDiagnostic`, `StyleVote`, `StyleFloor` miss titled Examples. No legacy `@example`/`@remarks` on these owning exports (census accurate).
- `impact`: Custom-rule authors implement `YamlRule` against this module; missing tags/Examples leave severity, `_tag` discrimination, and the lint-vs-engine diagnostic split hover-invisible.
- `suggestedFix`: Module JSDoc header. Values: `@category schemas`/`diagnostics`/`models` plus titled Examples (make a vote/floor/diagnostic, show `"off"` never appears on a diagnostic). Types/interfaces: `@category type-level` with described `@see` to `YamlLint` / `YamlDiagnostic`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-008: YamlNode.ts module header, remarks, missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlNode.ts:1
- `symbol`: ScalarStyle, CollectionStyle, QuoteStyle, QuoteCompat, ScalarChomp, YamlScalar, YamlAlias, YamlScalarEncoded, YamlMapEncoded, YamlSeqEncoded, YamlAliasEncoded, YamlNode, YamlPair, YamlMap, YamlSeq, AliasExpansionBudgetExceeded, aliasExpansionLimit, nodeToJsValue
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. All 24 owning exports miss `@category`/`@since`. Value schemas/classes/functions miss titled Examples. `YamlNode` runtime schema uses `@remarks` (261) for `.make` vs `new`. Encoded interfaces are type-level (Example optional) — census correctly omits `@example` there.
- `impact`: The AST is the largest public surface; ratchet fails on `@remarks`, and there is no Example showing `YamlScalar.make` or union decoding.
- `suggestedFix`: Module JSDoc header. Literal kits: `@category schemas` + Example of `S.decodeUnknownSync`/`S.is`. Node classes: `@category models` + one Example per class (or one `YamlNode` Example covering make/find/toValue). Encoded interfaces and the `YamlNode` type: `@category type-level` with `{@link}`. Move `.make` vs `new` into `**Gotchas**`. Tag `AliasExpansionBudgetExceeded` `@category errors` (note it is not barrel-exported); `aliasExpansionLimit`/`nodeToJsValue` `@category utilities` with Examples and `@throws` on `nodeToJsValue`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-009: YamlToken.ts module header, method legacy carriers, missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlToken.ts:1
- `symbol`: YamlTokenKind, YamlToken, YamlTokens
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. `YamlTokenKind` const/type (21/51), `YamlToken` (65), `YamlTokens` (119) miss `@category`/`@since`; values miss titled Examples on the owning declarations. Census does not flag `YamlTokens.tokenize` `@remarks`/`@example` (128) or `stream` `@remarks` (156), but the file-level zero-legacy gate will.
- `impact`: LSP/lint consumers tokenize through this class; the reserved-failure contract is on a retired carrier, and the class itself has no Example.
- `suggestedFix`: Module JSDoc header. Categories: `schemas`/`type-level`/`models`/`utilities`. Promote the tokenize sample into a class-level titled Example (and keep a method Example if it stays). Move reserved-failure and error-kind-in-success into `**Gotchas**`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-010: YamlVisitor.ts module header and missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlVisitor.ts:1
- `symbol`: YamlVisitorEvent, YamlVisitor
- `kind`: module
- `evidence`: `//` file header, no `@packageDocumentation`/`@since`. Type `YamlVisitorEvent` (33) and value `YamlVisitorEvent` (84) plus `YamlVisitor` (91) miss `@category`/`@since`. Values miss titled Examples. `YamlVisitor.visit` uses `@remarks` (101) for the infallible Error-event contract.
- `impact`: SAX consumers have no compilable Example of `Stream.take` + event matching; `@remarks` fails the ratchet.
- `suggestedFix`: Module JSDoc header. Type `@category type-level`; const `@category constructors`; class `@category utilities`. Add a titled Example that runs `YamlVisitor.visit` far enough to observe `DocumentStart`/`Scalar`. Move infallibility into `**Gotchas**`. Rewrite the stale `//` note that the tokenizer is still internal — `YamlTokens` is public.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-011: index.ts barrel header still uses @remarks and omits @since

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/index.ts:1
- `symbol`: (package entry)
- `kind`: module
- `evidence`: Census `findings: []` despite `hasRemarks: true` and `hasSince: false`. The file has a useful lead and `@packageDocumentation` (15) but uses retired `@remarks` (4) for the facade map and has no `@since 0.0.0`. Owning export count is 0 (re-exports only) — do not invent per-symbol Examples on the barrel.
- `impact`: Package entry is the first hover surface; `@remarks` fails zero-legacy once this tree is under `{packages,apps}/**/src`, and missing `@since` fails module-header law now.
- `suggestedFix`: Keep the lead. Fold the `@remarks` facade map into `**Details**` (or a described `@see` list). Add `@since 0.0.0` after `@packageDocumentation`. Do not document re-exports as new symbols.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-001
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-012: Rewrite Examples off @effected/yaml and make them observable

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/Yaml.ts:45, scratchpad/yaml/YamlFormat.ts:68, scratchpad/yaml/YamlToken.ts:136
- `symbol`: YamlParseOptions, YamlStringifyOptions, Yaml, YamlFormattingOptions, YamlTokens.tokenize
- `kind`: value
- `evidence`: Every fenced example imports from `"@effected/yaml"` (Yaml.ts 47/102/447/535/577/610/824, YamlFormat.ts 70, YamlToken.ts 138). Law forbids non-compiling Examples and placeholder `import { fn } from "..."; console.log(fn)` shapes. Current fences: `Yaml.parse`/`stringify` results are unused `Effect`s never run; `Effect.gen` programs are never executed; `YamlFormattingOptions` binds `formatted` and only comments the expected YAML; `Yaml.bind` uses `import { Effect, Schema } from "effect"` (named `Schema`, not `import * as S from "effect/Schema"`); `parseResult`/`tokenize` inspect members only in comments.
- `impact`: `bun run docgen:local` cannot typecheck these fences (package `@effected/yaml` is not this tree). Vacuous unused bindings fail the observable-result bar even after the import path is fixed.
- `suggestedFix`: Import from this module (`./Yaml.ts`, `./YamlFormat.ts`, `./YamlToken.ts`) until a `@beep/*` package exists. Convert to titled `**Example** (Title)` with one `ts` fence. Run Effects (`Effect.runPromise` / `Effect.runSync`) or use `Result` and assert with `console.log` or `// =>`. Show success and failure for parse/stringify. Use `import * as S from "effect/Schema"` in the bind Example; keep `import { Effect, Result } from "effect"`. Do not add `void x`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-001, yaml-public-R1-005, yaml-public-R1-009
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-013: Yaml facade Gotchas and sibling @see

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/Yaml.ts:55, scratchpad/yaml/Yaml.ts:186, scratchpad/yaml/Yaml.ts:458
- `symbol`: Yaml, YamlParseError, YamlStringifyError, YamlParseOptions, YamlStringifyOptions
- `kind`: value
- `evidence`: Implementation and method docs already warn: `lineWidth` folds only on `Yaml.stringify` / `stringifyResult` and is inert on `YamlDocument#stringify` and `YamlFormat`; schema factories encode with default stringify options (never fold); `"<<"` object keys are quoted on the value path but left unquoted on the document/format path; `parse` is `Effect.fromResult(parseResult)` (Result is the sync primitive); `equals` treats alias-expansion blow-ups as malformed (`false`) rather than throwing; `stripComments` is quote-aware; `YamlParseError`/`YamlStringifyError` have no `code` field (`diagnostics[0].code`). There is no described `@see` helping a caller choose `Yaml.parse` vs `YamlDocument.parse` vs `YamlVisitor.visit` vs `YamlTokens.tokenize`, or `Yaml.stringify` vs `YamlFormat.format`.
- `impact`: Callers will pass `lineWidth` to format/document stringify and see no wrap, or emit a merge-key from a plain object, or look for `error.code`. Sibling entry points are easy to confuse.
- `suggestedFix`: On `Yaml` add `**Gotchas**` covering lineWidth, `<<`, schema-producing bind-to-const, equals-on-alias-bomb, and no `code` field. Add described `@see {@link YamlDocument.parse}` (AST + warnings-as-data), `@see {@link YamlFormat.format}` (comment-preserving edits), `@see {@link YamlVisitor.visit}` (SAX events), `@see {@link Yaml.parseResult}` (sync Result). Error-class Examples must construct/handle the tagged error and read `diagnostics[0].code`. Options Examples must use `.make`, never `new`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-001
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-014: YamlDiagnostic Gotchas (fatality, fromRaw, jsonc parity)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlDiagnostic.ts:129
- `symbol`: YamlDiagnostic
- `kind`: value
- `evidence`: `@remarks` already states five-field jsonc parity. Lead points at `YamlDiagnostic.isFatal`, but the class Example is missing. File header notes `fromRaw` derives `line`/`character` from `offset` (engine records have no line/column). `YamlModifyErrorCode` is not a parse/stringify code — it is `YamlFormat.modify` navigation only. Same-name type leads (`The union of all lexer-stage error code string literals`) restate the signature.
- `impact`: Callers may treat every `YamlDocument.errors` entry as fatal, or expect modify codes on parse failures, or call `fromRaw` without source text.
- `suggestedFix`: `**Gotchas**`: fatality is a property of `code` via `isFatal`, not of the array it sits in; `fromRaw` is advanced (parse/stringify already materialize); modify codes never come from the parser. Described `@see` to `YamlParseError`, `YamlFormat.modify`, and jsonc’s parse-error detail if that symbol is in-tree. Rewrite type-companion leads to “Decoded literal union produced by {@link YamlLexErrorCode}.” with a purpose-phrase `@see`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-002
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-015: YamlDocument Gotchas (lineWidth, comments, internal parse)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlDocument.ts:50, scratchpad/yaml/YamlDocument.ts:235
- `symbol`: YamlDocument, documentFromRaw
- `kind`: value
- `evidence`: `stringify` `@remarks` (134): `lineWidth` is threaded but never read; folding requires `Yaml.stringify(doc.toValue(), options)` at the cost of framing/styles. Lead already distinguishes `commentBefore` vs `comment` and marker-less headers. `documentFromRaw` lead already says it is not a second public parse (lint recovered path; not in `index.ts`). `parseAll` fails the whole Effect on any fatal in any document.
- `impact`: Callers asking the document path to fold scalars, or using `documentFromRaw` as a public parse, will mis-round-trip or bypass fatal aggregation.
- `suggestedFix`: Class `**Gotchas**` for lineWidth, comment-slot ownership, and whole-stream fatal aggregation. Described `@see {@link Yaml.parse}` (value) and `@see {@link Yaml.stringify}` (folding). Keep `documentFromRaw` `@internal`; Example should not present it as a package entry point.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-003
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-016: YamlEdit.applyAll overlap throws as a defect

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlEdit.ts:55
- `symbol`: YamlEdit
- `kind`: value
- `evidence`: `applyAll` JSDoc (60) states overlapping edits throw as a defect because `YamlFormat` never produces them. Implementation throws `new Error(...)` (72). Reverse-offset apply is the byte-minimal comment-preserving contract. Class `@remarks` is jsonc field-parity only — the throw is not lifted onto the class.
- `impact`: Hand-built edit arrays that overlap abort outside any typed error channel; without `@throws` and a Gotcha, callers treat `applyAll` as total.
- `suggestedFix`: Class `**Gotchas**` plus method `@throws` (no hyphen, no `{Type}`): overlapping edits are programmer defects. Example: two non-overlapping edits applied to `"a: 1\nb: 2\n"` yielding a visible string. Described `@see {@link YamlFormat.format}` as the producer that never overlaps.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-004
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-017: YamlFormat Gotchas (total format, single-doc modify, directives)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlFormat.ts:81, scratchpad/yaml/YamlFormat.ts:492
- `symbol`: YamlFormat, YamlFormattingOptions, YamlModificationError
- `kind`: value
- `evidence`: Class and method `@remarks` already encode: `format`/`formatToString` are total (malformed → `[]` / byte-identical); multi-document formats whole; `modify` is single-document (`MultiDocumentStream`); every path refuses `%YAML`/`%TAG` (`DirectiveCarryingDocument` vs `[]`); positional `range` wins over `options.range`; `requoteScalars` is format-only; plain `<<` stays unquoted (opposite of `Yaml.stringify`); `lineWidth` is inert here. File header: `StringifyFailure` would be an internal defect, not a user error. `YamlModificationError` has no `code` field.
- `impact`: Kubernetes/pnpm multi-doc callers will guess modify-document-1; directive files will look “unformatted” or fail typed; `lineWidth`/`requoteScalars` will be passed on the wrong entry point.
- `suggestedFix`: Preserve all of the above as class `**Gotchas**` when stripping `@remarks`. Described `@see` to `Yaml.stringify` (value-path fold/`<<`), `Yaml.parseAll` (split streams before modify), `YamlRangeLike` (plain literals OK). Options Example must show `indentSequences` with an asserted `formatToString` result, and mention `requoteScalars` skip rules in Details rather than a second empty section.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-005
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-018: YamlLint Gotchas (always-on parse-validity, first document, overlapping fixes)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlLint.ts:96, scratchpad/yaml/YamlLint.ts:263, scratchpad/yaml/YamlLint.ts:527
- `symbol`: YamlLint, YamlLintConfig, StyleEvidence
- `kind`: value
- `evidence`: Config validation rejects demoting `parse-validity`. `buildContext` composes with `uniqueKeys: false` so duplicate-key policy belongs to `key-duplicates` and `parse-validity` does not double-report. `run`/`fix` document-driven rules see only the first stream document; token/line rules cover full source. `fix` drops overlapping or same-offset surgical fixes (earlier `run` order wins) and fails with `YamlParseError` on a fatal first document. `StyleEvidence` is a monoid (`empty`/`combine`); strict inference fails only on observed disagreement; `"off"` in base outranks inference. Floors never become config options. Facade `@remarks`: no IO/discovery/config-file loading.
- `impact`: Callers will try to disable `parse-validity`, lint only document 1 of a stream and think the rest was checked, or expect `fix` to apply every diagnostic.fix.
- `suggestedFix`: `**Gotchas**` on `YamlLint`/`YamlLintConfig`/`StyleEvidence` with described `@see` among `run`, `fix`, `observe`, `resolveStrict`, `inferLenient`. Examples: default preset spread; `run` on a trailing-space input; `combine` of two `observe` results; a strict conflict vs unobserved fallback.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-006
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-019: YamlLintRule sibling split and _tag discriminator

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlLintRule.ts:43, scratchpad/yaml/YamlLintRule.ts:110, scratchpad/yaml/YamlLintRule.ts:164
- `symbol`: YamlLintDiagnostic, StyleVote, StyleFloor, YamlRule, LintContext
- `kind`: value
- `evidence`: `YamlLintDiagnostic` lead already says it is not `YamlDiagnostic` (no engine fatality, carries severity/fix). `StyleVote`/`StyleFloor` warn that class instances are structurally assignable so evidence must branch on `_tag`, never `instanceof`. `LintContext.document` is always present, including for unparseable input, and is the first stream document. `"off"` never reaches a diagnostic. No described `@see` tying these to `YamlLint` / `YamlDiagnostic`.
- `impact`: Custom rules that `instanceof StyleVote` drop plain-object votes; authors may extend `YamlDiagnostic` with severity or assume `ctx.document` is every document in a stream.
- `suggestedFix`: Keep the `_tag` warning as `**Gotchas**` on `StyleVote`/`StyleFloor`/`StyleObservation`. Described `@see {@link YamlDiagnostic}` (engine) vs `{@link YamlLintDiagnostic}` (lint). `YamlRule` Example: a minimal `id`+`check` yielding one diagnostic (no empty When-to-use). `LintContext` prose: full `text`/`lines`/`tokens`, first `document` only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-007
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-020: YamlNode Gotchas (.make, aliases, budget throw, QuoteStyle vs ScalarStyle)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlNode.ts:131, scratchpad/yaml/YamlNode.ts:269, scratchpad/yaml/YamlNode.ts:538, scratchpad/yaml/YamlNode.ts:581
- `symbol`: YamlNode, YamlScalar, QuoteStyle, AliasExpansionBudgetExceeded, nodeToJsValue
- `kind`: value
- `evidence`: `@remarks` on `YamlNode`: construct via `.make`, never `new` (engine hot path is the recorded exception). Nodes have no parent pointers. `toValue` resolves aliases incrementally; unresolvable aliases yield `null`. `pathOf` is reference identity; `find` only string scalar keys. `nodeToJsValue` throws `AliasExpansionBudgetExceeded` synchronously (facade maps it to `AliasCountExceeded`); that class is exported from the module but not the barrel. `QuoteStyle`/`QuoteCompat` are stringify-option vocabularies, never node fields (unlike `ScalarStyle`). `__proto__` keys become own data properties. `aliasExpansionLimit` lead restates the name.
- `impact`: Synthetic AST authors using `new` skip validation; callers catching parse errors will never see `AliasExpansionBudgetExceeded` from `Yaml.parse`; quoting options will be set on nodes that cannot hold them.
- `suggestedFix`: `**Gotchas**` on `YamlNode`/`YamlScalar` for `.make`, no parents, alias `null`, identity `pathOf`. `@throws` on `nodeToJsValue`. Described `@see` between `QuoteStyle` and `ScalarStyle`, and from `AliasExpansionBudgetExceeded` to `YamlParseError` (`AliasCountExceeded`). Mark the three non-barrel exports `@internal` if they should stay engine-only, still with `@category`/`@since`/Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-008
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-021: YamlTokens reserved failure and raw-slice fidelity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlToken.ts:65, scratchpad/yaml/YamlToken.ts:119
- `symbol`: YamlTokens, YamlToken
- `kind`: value
- `evidence`: `tokenize` `@remarks`: failure channel is reserved and never fires; lexical errors are `"error"`-kind tokens in the success array so `parse-validity` can lint malformed input — do not “fix” the method to fail on those tokens. `stream` derives from tokenize and would `Stream.die` the reserved failure. Promotion derives `line`/`character` from offset (internal `column` is indent on synthetic block-start tokens). Public `text` is the raw source slice (`source.slice(offset, offset+length) === text`); internal `value` is processed (quotes stripped). Hot path uses `new YamlToken` not `make`. Class lead is “Tokenizer statics. Not instantiable.”
- `impact`: Callers treating `Result` failure as the malformed-input path will never see it; using internal `column` semantics on public tokens mis-positions diagnostics.
- `suggestedFix`: Rewrite the class lead to the problem it solves (positioned token stream for lint/LSP). `**Gotchas**` for reserved failure, error tokens in success, derived positions, raw `text`. Example: `Result.isSuccess` plus an observable `kinds` array, including an `"error"` token on malformed input. Described `@see {@link YamlVisitor.visit}` (AST events) and `{@link YamlLint}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-009
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-022: YamlVisitor Error events, Pair scalar-only, stale CST comment

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlVisitor.ts:1, scratchpad/yaml/YamlVisitor.ts:91
- `symbol`: YamlVisitor, YamlVisitorEvent
- `kind`: value
- `evidence`: `visit` `@remarks`: the stream is type-level infallible; fatal and non-fatal compose diagnostics (including `AliasCountExceeded`) are `Error` events. `walkPair` resolves only scalar key/value into the `Pair` event (`null` for complex keys) but still walks nested nodes. Comments live on key/value nodes and must not be re-emitted on the pair (implementation comment 237). v3 `visitCollect` is dropped (`Stream.filter` + `Stream.runCollect`). File `//` header still says the tokenizer/CST stay internal, which is stale after `YamlTokens`.
- `impact`: Callers `Stream.run` expecting failure on bad YAML will hang on a successful stream of `Error` events; complex-key maps look like `Pair.key === null`.
- `suggestedFix`: Class `**Gotchas**` for Error-in-band, Pair scalar resolution, comment ownership. Example: `Stream.take` on `DocumentStart` plus matching an `Error` event for malformed input. Described `@see {@link YamlTokens.tokenize}` and `{@link YamlDocument.parse}`. Drop the stale “no public tokenizer” sentence from the new `@packageDocumentation` lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-010
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-023: Missing $I.annote / $I.annoteSchema on exported schemas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/yaml/Yaml.ts:55, scratchpad/yaml/YamlDiagnostic.ts:29, scratchpad/yaml/YamlDocument.ts:28, scratchpad/yaml/YamlEdit.ts:39, scratchpad/yaml/YamlFormat.ts:81, scratchpad/yaml/YamlLint.ts:30, scratchpad/yaml/YamlLintRule.ts:22, scratchpad/yaml/YamlNode.ts:18, scratchpad/yaml/YamlToken.ts:21
- `symbol`: (all exported Schema.Class / Literals / Union / TaggedError / TaggedClass schemas)
- `kind`: value
- `evidence`: No `$I` composer exists under `scratchpad/yaml/`. Class schemas use `Schema.Class`/`TaggedClass`/`TaggedError` with a bare identifier; literal kits use `Schema.Literals` without `.annotate($I.annote(...))`; unions (`YamlErrorCode`, `YamlNode`, `YamlLintRuleSetting`) lack `$I.annoteSchema`. Same-name type aliases already exist for the literal/union schemas (do not duplicate Examples onto those aliases).
- `impact`: Schema identity annotations never reach JSON Schema / editor metadata; once this kit is a workspace package the annotation law will reject the definitions.
- `suggestedFix`: When a package identity exists, add file-local `const $I = $PackageId.create(...)` and annotate every exported schema (`$I.annote` on classes/LiteralKit, `$I.annoteSchema` in `.pipe` for unions). Keep same-name type aliases as type-level prose + described `@see`. Do not invent `$I` against a missing identity in this pass if the kit is still scratchpad-only — record the gap and apply on package lift.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R1-024: Thin facade leads that restate “statics, not instantiable”

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/Yaml.ts:434, scratchpad/yaml/YamlFormat.ts:460, scratchpad/yaml/YamlLint.ts:518, scratchpad/yaml/YamlToken.ts:115, scratchpad/yaml/YamlVisitor.ts:87
- `symbol`: Yaml, YamlFormat, YamlLint, YamlTokens, YamlVisitor
- `kind`: value
- `evidence`: Leads are “Static entry points… Not instantiable.” / “Formatting and modification statics. Not instantiable.” / “Linting statics. Not instantiable.” / “Tokenizer statics. Not instantiable.” / “SAX-style YAML AST visitor statics. Not instantiable.” Law: the lead explains the problem the symbol solves, not the name or constructability. Semantics currently sit in `@remarks` that must move anyway.
- `impact`: Hover shows a constructability footnote instead of which entry point to pick for value parse vs AST vs edits vs tokens vs events vs lint.
- `suggestedFix`: One-paragraph leads, e.g. `Yaml` — “Parse, stringify, compare and schema-bind YAML 1.2 as plain values with typed errors.” `YamlFormat` — “Compute comment-preserving text edits that reformat or modify a document without round-tripping through a serializer.” Fold “not instantiable” into Details only if needed. Do not add empty When-to-use sections.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R1-001, yaml-public-R1-005, yaml-public-R1-006, yaml-public-R1-009, yaml-public-R1-010
- `status`: open
- `fixedCommit`: pending

## Pack verdict

- files reviewed: 11
- owning exports reviewed: 80
- confirmed mechanical items: 11
- editorial items: 13
- rejected false positives: 1
- accepted findings: 24
