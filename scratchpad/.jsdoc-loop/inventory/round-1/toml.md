# Pack toml — round 1 inventory

- `reviewer`: jsdoc-annotation-specialist
- `scope`: `scratchpad/toml/` (15 exporting modules, 92 owning exports, 11 barrel re-exports)
- `law`: `.patterns/jsdoc-documentation.md`, `.agents/skills/jsdoc-annotation-specialist/references/conventions.md`, `.agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md`

Kit-port from `@effected/toml`. Every public and internal owning file still uses Effect-kit JSDoc (`@public`, `@remarks`, `@example`) rather than beep doctrine (`@packageDocumentation`, `@category`, `@since 0.0.0`, titled `**Example** (Title)`). File-top `//` banners already contain the module lead; they are not JSDoc.

## Rejected false positives

- `toml/index.ts:16` `TomlBoundCodec` (`kind: re-export`, rule `legacy-carrier`): the `@remarks` is the **module** fileoverview, not documentation on the type re-export. Do not open a barrel-symbol rewrite. The module `@remarks` / missing `@since` are real and filed as `toml-R1-009`.
- Type-level owning exports were correctly **not** flagged for a required Example (`TomlBoundCodec`, `TomlSegment`, `TomlPath`, `TomlRangeLike`, same-name Literal unions, `ScanResult`, `ScalarValue`, `SemanticVisitor`, `GuardReason`, `*Raw` aliases). Not defects.
- `Toml` / `TomlDocument` are not missing an example carrier in the census (`@example` is present). They still fail the titled-Example law; that is confirmed `legacy-example`, not a miss.

Re-export graph edges on `toml/index.ts` (11) are not owning documentation subjects.

---

### toml-R1-001: Toml.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/Toml.ts:1, scratchpad/toml/Toml.ts:33, scratchpad/toml/Toml.ts:45, scratchpad/toml/Toml.ts:64, scratchpad/toml/Toml.ts:143, scratchpad/toml/Toml.ts:179
- `symbol`: module, TomlStringifyOptions, TomlParseError, TomlStringifyError, TomlBoundCodec, Toml
- `kind`: module
- `evidence`: Census module findings `missing-module-summary|missing-packageDocumentation|missing-module-since` confirmed — file opens with a `//` cycle-firewall banner, not a JSDoc `@packageDocumentation` block. Owning exports: `TomlStringifyOptions` (value/class) missing `@category` `@since` titled Example, `legacy-remarks`; `TomlParseError` / `TomlStringifyError` (value/class) missing `@category` `@since` titled Example; `TomlBoundCodec` (type/interface) missing `@category` `@since`; `Toml` (value/class) missing `@category` `@since`, `legacy-example`, `legacy-remarks`. Non-owning methods `parseResult` / `stringifyResult` / `bind` also carry `@remarks` + `@example` (zero-legacy is whole-file). No `@category` anywhere. `@public` only.
- `impact`: jsdoc-ratchet zero-legacy fails on `@example`/`@remarks`; docgen `enforceExamples` fails every value export; callers get no canonical category/since in the published API.
- `suggestedFix`: Lift the `//` banner into a module block with a useful lead, `@packageDocumentation`, `@since 0.0.0`. On every owning export add `@category` (`configuration` / `errors` / `type-level` / `codecs`) and `@since 0.0.0`. Convert `@remarks` into `**Details**`/`**Gotchas**` and `@example` into titled `**Example** (Title)` with one `ts` fence, placed before tags. Rewrite method blocks in the same pass so the file has zero legacy carriers. Types keep prose only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-002: TomlDateTime.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlDateTime.ts:1, scratchpad/toml/TomlDateTime.ts:97, scratchpad/toml/TomlDateTime.ts:111, scratchpad/toml/TomlDateTime.ts:123, scratchpad/toml/TomlDateTime.ts:138
- `symbol`: module, TomlLocalDate, TomlLocalTime, TomlLocalDateTime, TomlOffsetDateTime
- `kind`: module
- `evidence`: Census module findings confirmed (`missing-module-summary|missing-packageDocumentation|missing-module-since`). All four `Schema.Class` value exports have a useful lead and `@public` only; each is missing `@category` `@since` and a titled Example. No legacy carriers in this file.
- `impact`: Four runtime date-time models ship without examples or taxonomy; docgen and the totals ratchet will count them open.
- `suggestedFix`: Lift the file-top `//` design note (Effect `DateTime` models none of the local-only variants) into `@packageDocumentation` + `@since 0.0.0`. Tag each class `@category models` `@since 0.0.0` and add one titled Example that constructs the class and shows `toString()` (include a leap-second `second: 60` case on `TomlLocalTime` / offset variants).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-003: TomlDiagnostic.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlDiagnostic.ts:1, scratchpad/toml/TomlDiagnostic.ts:22, scratchpad/toml/TomlDiagnostic.ts:29, scratchpad/toml/TomlDiagnostic.ts:36, scratchpad/toml/TomlDiagnostic.ts:43, scratchpad/toml/TomlDiagnostic.ts:50, scratchpad/toml/TomlDiagnostic.ts:57, scratchpad/toml/TomlDiagnostic.ts:64, scratchpad/toml/TomlDiagnostic.ts:71, scratchpad/toml/TomlDiagnostic.ts:79, scratchpad/toml/TomlDiagnostic.ts:91, scratchpad/toml/TomlDiagnostic.ts:106
- `symbol`: module, TomlLexErrorCode, TomlParseErrorCode, TomlSemanticErrorCode, TomlStringifyErrorCode, TomlErrorCode, TomlDiagnostic
- `kind`: module
- `evidence`: Census module findings confirmed. Value schemas `TomlLexErrorCode` / `TomlParseErrorCode` / `TomlSemanticErrorCode` / `TomlStringifyErrorCode` / `TomlErrorCode` (line 22/36/50/64/79) missing `@category` `@since` titled Example. Same-name type companions (line 29/43/57/71/91) missing `@category` `@since` only — Example correctly optional. `TomlDiagnostic` (value/class) missing `@category` `@since` titled Example and `legacy-remarks`. Same-name type aliases already exist (good).
- `impact`: Stage error-code schemas and the diagnostic class are the typed-error surface of every public entry point; missing examples and retired `@remarks` fail ratchet and hide how `code` discriminates stages.
- `suggestedFix`: Add module `@packageDocumentation` + `@since 0.0.0`. Tag runtime schemas `@category schemas` (or `diagnostics`) with a titled Example that `S.is` / decodes a literal; tag type companions `@category type-level` with a described `@see` to the runtime schema; convert `TomlDiagnostic` `@remarks` into Details and add an Example of `TomlDiagnostic.fromRaw` or a parse failure's `diagnostics[0]`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-004: TomlDocument.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlDocument.ts:1, scratchpad/toml/TomlDocument.ts:78
- `symbol`: module, TomlDocument
- `kind`: module
- `evidence`: Census module findings confirmed. `TomlDocument` (value/class) missing `@category` `@since`; `legacy-example` + `legacy-remarks` confirmed on the class block (`@remarks` at line 52, `@example` at line 64 importing `@effected/toml`).
- `impact`: The lossless-document facade is the caller choice versus `Toml.parse`; retired carriers fail zero-legacy and the existing example does not compile under beep import law.
- `suggestedFix`: Lift the `//` lossless/span-tiling banner into `@packageDocumentation` + `@since 0.0.0`. Tag the class `@category models`. Move `@remarks` into Details/Gotchas (parse vs `toValue`) and replace `@example` with a titled Example that actually runs `Effect` / logs `stringify()` and `toValue()`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-005: TomlEdit.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlEdit.ts:1, scratchpad/toml/TomlEdit.ts:21, scratchpad/toml/TomlEdit.ts:29, scratchpad/toml/TomlEdit.ts:38, scratchpad/toml/TomlEdit.ts:55
- `symbol`: module, TomlSegment, TomlPath, TomlRange, TomlEdit
- `kind`: module
- `evidence`: Census module findings confirmed. `TomlSegment` / `TomlPath` (type) missing `@category` `@since`. `TomlRange` (value/class) missing `@category` `@since` titled Example. `TomlEdit` (value/class) missing `@category` `@since` titled Example and `legacy-remarks` (jsonc/yaml parity note at line 47). `applyAll` has no `@throws` despite throwing `Error` on overlap.
- `impact`: Edit/Range/Path are the shared document-codec vocabulary; missing examples and `@remarks` fail doctrine, and the overlap throw is invisible in the class signature.
- `suggestedFix`: Module `@packageDocumentation` + `@since 0.0.0`. Types `@category type-level`; classes `@category models`. Convert `@remarks` to Details plus described `@see` to the jsonc/yaml counterparts once those symbols exist in-tree. Add a titled Example of `TomlEdit.applyAll` inserting/replacing a span. Document the overlap throw on `applyAll` with `@throws` (synchronous defect outside a typed channel).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-006: TomlFormat.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlFormat.ts:1, scratchpad/toml/TomlFormat.ts:51, scratchpad/toml/TomlFormat.ts:61, scratchpad/toml/TomlFormat.ts:74, scratchpad/toml/TomlFormat.ts:773
- `symbol`: module, TomlRangeLike, TomlFormattingOptions, TomlModificationError, TomlFormat
- `kind`: module
- `evidence`: Census module findings confirmed. `TomlRangeLike` (type) missing `@category` `@since`. `TomlFormattingOptions` / `TomlModificationError` (value/class) missing `@category` `@since` titled Example. `TomlFormat` (value/class) missing `@category` `@since` titled Example and `legacy-remarks` (line 762). Class lead is the thin restatement “Formatting and modification statics. Not instantiable.”
- `impact`: Format/modify is the preservation differentiator versus parse→stringify; retired `@remarks` and missing examples hide that `format` is total and `modify` is not.
- `suggestedFix`: Module `@packageDocumentation` + `@since 0.0.0`. `TomlRangeLike` `@category type-level`; options `@category configuration`; error `@category errors`; facade `@category formatting`. Replace the class lead with the purpose currently trapped in `@remarks`. Add one titled Example that formats a snippet and one that `modify`s a path (may live on the class; do not add extra Examples just to fill the shape).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-007: TomlNode.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlNode.ts:1, scratchpad/toml/TomlNode.ts:19, scratchpad/toml/TomlNode.ts:26, scratchpad/toml/TomlNode.ts:37, scratchpad/toml/TomlNode.ts:49, scratchpad/toml/TomlNode.ts:56, scratchpad/toml/TomlNode.ts:64, scratchpad/toml/TomlNode.ts:77, scratchpad/toml/TomlNode.ts:88, scratchpad/toml/TomlNode.ts:99, scratchpad/toml/TomlNode.ts:110, scratchpad/toml/TomlNode.ts:122, scratchpad/toml/TomlNode.ts:134, scratchpad/toml/TomlNode.ts:147, scratchpad/toml/TomlNode.ts:160, scratchpad/toml/TomlNode.ts:171, scratchpad/toml/TomlNode.ts:188, scratchpad/toml/TomlNode.ts:201, scratchpad/toml/TomlNode.ts:214, scratchpad/toml/TomlNode.ts:227, scratchpad/toml/TomlNode.ts:239, scratchpad/toml/TomlNode.ts:246
- `symbol`: module, TomlKeyKind, TomlKey, TomlStringStyle, TomlString, TomlInteger, TomlFloat, TomlBoolean, TomlDateTimeLiteral, TomlArray, TomlInlineEntry, TomlInlineTable, TomlValueNode, TomlKeyValue, TomlTableHeader, TomlArrayTableHeader, TomlTrivia, TomlExpression
- `kind`: module
- `evidence`: Census module findings confirmed. 21 owning exports, all missing `@category` `@since`; every value export also missing a titled Example. Type companions `TomlKeyKind` / `TomlStringStyle` / `TomlValueNode` / `TomlExpression` correctly not flagged for Example. Leads are generally useful (span contract, bigint narrowing, 1.1 multiline inline tables). No `@remarks`/`@example` in this file. Same-name aliases exist for the four union/literal schemas.
- `impact`: The lossless CST is 21 undocumented runtime schemas; a single missing-Example miss times 17 value symbols dominates the pack’s open-export count.
- `suggestedFix`: Module `@packageDocumentation` describing the span-tiling invariant + `@since 0.0.0`. Literal schemas `@category schemas`; node classes `@category models`; union schemas `@category schemas`; type companions `@category type-level` with described `@see` to the runtime schema. One titled Example per value export (construct a node, or `S.is(TomlValueNode, …)` / match `_tag`). Prefer namespace `import * as S from "effect/Schema"` inside Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-008: TomlVisitor.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlVisitor.ts:1, scratchpad/toml/TomlVisitor.ts:43, scratchpad/toml/TomlVisitor.ts:56, scratchpad/toml/TomlVisitor.ts:177, scratchpad/toml/TomlVisitor.ts:185
- `symbol`: module, TomlVisitorEvent, TomlVisitor
- `kind`: module
- `evidence`: Census module findings confirmed. `TomlVisitorEvent` type (line 43) missing `@category` `@since`; value constructors (line 56) missing `@category` `@since` titled Example; `TomlVisitor` class missing `@category` `@since` titled Example. Census did **not** flag `legacy-remarks` on the class because `@remarks` lives on non-owning `visit` (line 185) — still a whole-file zero-legacy defect. Class lead is the thin “SAX-style TOML visitor statics. Not instantiable.”
- `impact`: Callers cannot see that `visit` is eager; method `@remarks` will fail jsdoc-ratchet when the file lands under `packages/**/src`.
- `suggestedFix`: Module `@packageDocumentation` + `@since 0.0.0` (the `//` banner already explains document-order merge and Comment `#` offset). Type `@category type-level`; const `@category constructors`; class `@category streams` (or `parsing`). Convert `visit` `@remarks` into class/method Gotchas. Add a titled Example that `Stream.runCollect`s a small document.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-009: index.ts module header missing @since and uses retired @remarks

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/index.ts:1
- `symbol`: module
- `kind`: module
- `evidence`: Census module `findings: []` because `owningExportCount === 0` (census skips module rules when there are no owning exports). Confirmed misses against module-header law: useful lead and `@packageDocumentation` are present; `@since 0.0.0` is absent (`hasSince: false`); `@remarks` (line 4) is a retired carrier. Re-exports are graph edges — do not document them.
- `impact`: Package entry point will fail zero-legacy and the module-since check as soon as census treats barrels as modules (and the ratchet already scans the file for `@remarks`).
- `suggestedFix`: Keep the lead. Move the `@remarks` map (`Toml` facade, `TomlDiagnostic`, `TomlNode` CST, date-time classes, typed errors) into `**Details**`. Add `@since 0.0.0`. Do not add `@module`. Do not attach Examples to re-exports.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-010: internal/diagnostics.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/diagnostics.ts:1, scratchpad/toml/internal/diagnostics.ts:6, scratchpad/toml/internal/diagnostics.ts:17, scratchpad/toml/internal/diagnostics.ts:32, scratchpad/toml/internal/diagnostics.ts:40, scratchpad/toml/internal/diagnostics.ts:50, scratchpad/toml/internal/diagnostics.ts:51, scratchpad/toml/internal/diagnostics.ts:52, scratchpad/toml/internal/diagnostics.ts:53, scratchpad/toml/internal/diagnostics.ts:54, scratchpad/toml/internal/diagnostics.ts:61, scratchpad/toml/internal/diagnostics.ts:69, scratchpad/toml/internal/diagnostics.ts:78
- `symbol`: module, TOML_LEX_ERROR_CODES, TOML_PARSE_ERROR_CODES, TOML_SEMANTIC_ERROR_CODES, TOML_STRINGIFY_ERROR_CODES, TomlLexErrorCodeRaw, TomlParseErrorCodeRaw, TomlSemanticErrorCodeRaw, TomlStringifyErrorCodeRaw, TomlErrorCodeRaw, RawDiagnostic, RawTomlError, isRawTomlError
- `kind`: module
- `evidence`: Census module findings confirmed. Value consts `TOML_*_ERROR_CODES` and `isRawTomlError` have **no lead** (`missing-summary`) plus missing `@category` `@since` titled Example. Five `*Raw` type aliases (lines 50–54) have no lead and missing `@category` `@since`. `RawDiagnostic` / `RawTomlError` have a one-line lead but missing tags/Example. Shared-code comment on `IntegerOutOfRange` / `NestingDepthExceeded` is implementation-only.
- `impact`: Engine error vocabulary is the firewall the public modules materialize; undocumented codes and the unguarded `isRawTomlError` predicate make the catch sites guess.
- `suggestedFix`: Module `@packageDocumentation` stating public modules materialize these into `TomlDiagnostic` and the engine must not import public modules. Tag code arrays `@category constants`, raw aliases `@category type-level`, `RawTomlError` `@category errors`, `isRawTomlError` `@category guards`. Add leads on every export. One titled Example for the predicate and for `RawTomlError` construction.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-011: internal/limits.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/limits.ts:1, scratchpad/toml/internal/limits.ts:5, scratchpad/toml/internal/limits.ts:8, scratchpad/toml/internal/limits.ts:15, scratchpad/toml/internal/limits.ts:36, scratchpad/toml/internal/limits.ts:42
- `symbol`: module, MAX_NESTING_DEPTH, GuardReason, GuardExceeded, isGuardExceeded, assertCap
- `kind`: module
- `evidence`: Census `missing-packageDocumentation|missing-module-since` confirmed. `hasFileoverview: true` is a **census under-count**: `fileOverview()` picked up `MAX_NESTING_DEPTH`'s JSDoc via leading comments at offset 0, so `missing-module-summary` did not fire. There is still no dedicated module block. Exports: `MAX_NESTING_DEPTH` / `GuardExceeded` / `assertCap` missing `@category` `@since` titled Example; `GuardReason` missing `@category` `@since`; `isGuardExceeded` missing lead + `@category` `@since` titled Example.
- `impact`: Depth-guard contract is how adversarial input stays on the typed channel; without module identity and examples, public facades copy the catch boilerplate by folklore.
- `suggestedFix`: Add a real `@packageDocumentation` block (zero-dependency leaf, yaml/jsonc/glob parity) with `@since 0.0.0` so the first export’s JSDoc is not the fileoverview. `@category constants` / `type-level` / `errors` / `guards` / `assertions`. Example `MAX_NESTING_DEPTH` as `256`; Example `assertCap` showing the TypeError defect on `NaN`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-012: internal/parser.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/parser.ts:1, scratchpad/toml/internal/parser.ts:407
- `symbol`: module, parseExpressions
- `kind`: module
- `evidence`: Census module findings confirmed. `parseExpressions` has a useful lead (throws `RawTomlError` / `GuardExceeded`; facade materializes) but missing `@category` `@since` titled Example. Lead already mentions Task 7 — documentation describing the refactor that produced it; drop the task number when rewriting.
- `impact`: The only exported parser entry point has no compilable example and no category; callers of the engine (Toml, TomlDocument, TomlVisitor, TomlFormat) cannot learn the throw contract from the published page.
- `suggestedFix`: Module `@packageDocumentation` on the span-tiling invariant + `@since 0.0.0`. Tag `parseExpressions` `@category parsing`, add `@throws` for `RawTomlError` and `GuardExceeded` (synchronous throws outside the typed channel), and a titled Example of a one-line document’s expression list (or a `try/catch` of `RawTomlError`). Remove “Task 7” from the lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-013: internal/scanner.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/scanner.ts:1, scratchpad/toml/internal/scanner.ts:17, scratchpad/toml/internal/scanner.ts:23, scratchpad/toml/internal/scanner.ts:64, scratchpad/toml/internal/scanner.ts:68, scratchpad/toml/internal/scanner.ts:80, scratchpad/toml/internal/scanner.ts:93, scratchpad/toml/internal/scanner.ts:109, scratchpad/toml/internal/scanner.ts:127, scratchpad/toml/internal/scanner.ts:143, scratchpad/toml/internal/scanner.ts:213, scratchpad/toml/internal/scanner.ts:258, scratchpad/toml/internal/scanner.ts:312, scratchpad/toml/internal/scanner.ts:391, scratchpad/toml/internal/scanner.ts:475, scratchpad/toml/internal/scanner.ts:578
- `symbol`: module, ScanResult, ScalarValue, isBareKeyChar, skipBom, assertValidUnicode, scanWhitespace, scanNewline, scanComment, scanBareKey, scanBasicString, scanLiteralString, scanMultilineBasicString, scanMultilineLiteralString, scanValueToken, classifyValueToken
- `kind`: module
- `evidence`: Census module findings confirmed. 2 types missing `@category` `@since`; 13 value exports missing `@category` `@since` titled Example. Leads are present and mostly useful. Several leads omit the `RawTomlError` throw that every malformed scan takes.
- `impact`: Fifteen engine primitives will each fail `enforceExamples`; scan functions throw rather than return, which the signature does not say.
- `suggestedFix`: Module `@packageDocumentation` + `@since 0.0.0`. Types `@category type-level`; predicates `@category predicates`; scans `@category parsing`; `assertValidUnicode` `@category assertions`. One titled Example per value (input `source`/`pos`, observable `value`/`end` or a caught `RawTomlError`). Add `@throws` only where the throw is not already obvious from a Gotcha (at least `assertValidUnicode`, `scanNewline` lone CR, unterminated strings).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-014: internal/semantic.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/semantic.ts:1, scratchpad/toml/internal/semantic.ts:24, scratchpad/toml/internal/semantic.ts:228, scratchpad/toml/internal/semantic.ts:321
- `symbol`: module, SemanticVisitor, analyze, buildValue
- `kind`: module
- `evidence`: Census module findings confirmed. `SemanticVisitor` (type/interface) missing `@category` `@since`. `analyze` / `buildValue` missing `@category` `@since` titled Example. Leads exist and mention first-violation-wins and `__proto__` as an own data property.
- `impact`: Semantic pass is how `Toml.parse` and `TomlDocument.toValue` differ from CST parse; missing examples hide the throw-vs-value split.
- `suggestedFix`: Module `@packageDocumentation` on the G8 provenance machine + `@since 0.0.0`. Interface `@category type-level`; functions `@category parsing`. Titled Example: `analyze` throwing on a duplicate key; `buildValue` returning `{ name: "Alice" }` and defining `__proto__` as an own property.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R1-015: internal/stringifyValue.ts module header and owning-export mechanical misses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/stringifyValue.ts:1, scratchpad/toml/internal/stringifyValue.ts:95, scratchpad/toml/internal/stringifyValue.ts:213, scratchpad/toml/internal/stringifyValue.ts:296
- `symbol`: module, renderKey, renderInlineValue, stringifyValue
- `kind`: module
- `evidence`: Census module findings confirmed. All three value exports have useful leads and missing `@category` `@since` titled Example. `stringifyValue` lead already states root must be a plain object and empty root emits `""`.
- `impact`: Encode-side engine is what `Toml.stringify` wraps; without examples callers cannot see the table-only root constraint or the 1.0 spellings.
- `suggestedFix`: Module `@packageDocumentation` + `@since 0.0.0`. `@category serialization`. Examples: `renderKey("dotted-key")` vs `renderKey("has space")`; `renderInlineValue({ a: 1 })`; `stringifyValue({ name: "Alice" }, "\n")` vs throw on `null`/array root.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

### toml-R1-016: Toml.ts missing Gotchas and described @see (1.0 write / 1.1 read, Result vs Effect, schema memoization)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/Toml.ts:20, scratchpad/toml/Toml.ts:154, scratchpad/toml/Toml.ts:293
- `symbol`: TomlStringifyOptions, Toml, Toml.parseResult, Toml.stringify, Toml.fromString, Toml.bind
- `kind`: value
- `evidence`: Implementation/`@remarks` already warn: stringify emits only TOML 1.0.0 spellings while `Toml.parse` accepts 1.1.0; `parse`/`stringify` are defined in terms of the `*Result` variants and exist for the tracing span; `fromString`/`schema`/`bind` are schema-producing (fresh derivation caches — bind to `const`; `TomlFromString` is the pre-bound common case); first violation wins; `GuardExceeded`/`RawTomlError` never escape; integers become `number` or `bigint` past 2^53; `__proto__` is an own data property. None of this is a `**Gotchas**` section, and there is no described `@see` between `parse` and `parseResult`, `stringify` and `stringifyResult`, `bind` and `schema`, or `TomlParseError`/`TomlStringifyError` and `TomlDiagnostic`. Class lead restates “static entry points… Not instantiable.”
- `impact`: A caller who round-trips a 1.1 document through stringify silently drops 1.1-only spellings; a caller who `runPromise`s a fresh `Toml.schema(...)` on a hot path pays recomposition; a caller who reaches for `Toml.parse` at a sync boundary misses `parseResult`.
- `suggestedFix`: After converting `@remarks`, keep a Gotcha on conservative-write/liberal-read, Result-vs-Effect, and schema-producing memoization. Add described `@see` links among the pairs above. Rewrite the `Toml` lead to the problem it solves (typed TOML 1.1 parse / 1.0 stringify / schema factories) instead of “not instantiable.”
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-001
- `status`: open
- `fixedCommit`: pending

### toml-R1-017: TomlDateTime.ts missing Gotchas and @see among the four local/offset types

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlDateTime.ts:48, scratchpad/toml/TomlDateTime.ts:105, scratchpad/toml/TomlDateTime.ts:131
- `symbol`: TomlLocalTime, TomlOffsetDateTime, TomlLocalDate, TomlLocalDateTime
- `kind`: value
- `evidence`: `timeFields.second` documents “60 tolerates the RFC 3339 leap second; TOML does not itself validate it.” `TomlOffsetDateTime` lead says parsing enforces `hh <= 23` / `mm <= 59` before construction and the class only bounds combined `offsetMinutes` (-1439–1439). `toString` omits a fractional part when `nanosecond === 0` and trims trailing zeros. File banner: Effect `DateTime` models none of the local-only variants. No `**Gotchas**`. `TomlLocalDateTime`/`TomlOffsetDateTime` use `{@link}` in the lead but there is no described `@see` to `TomlDateTimeLiteral` or sibling classes. `TomlLocalDate`/`TomlLocalTime` have no sibling links.
- `impact`: Callers constructing `TomlOffsetDateTime` with `offsetMinutes: 24 * 60` pass the class bound after a parse that would have rejected `+24:00`. Leap-second `second: 60` looks like a schema bug without the RFC 3339 note.
- `suggestedFix`: Add a Gotcha on leap seconds, combined offset minutes vs parsed hh:mm, and fractional-second trimming. Described `@see` among the four classes and `{@link TomlDateTimeLiteral}` as the CST wrapper. Lift the Effect-DateTime gap into the module Details, not a class lead restatement.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-002
- `status`: open
- `fixedCommit`: pending

### toml-R1-018: TomlDiagnostic.ts missing Gotchas (0-based positions, shared codes, fromRaw)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlDiagnostic.ts:73, scratchpad/toml/TomlDiagnostic.ts:93, scratchpad/toml/TomlDiagnostic.ts:114
- `symbol`: TomlErrorCode, TomlDiagnostic
- `kind`: value
- `evidence`: Lead says stage discrimination lives in the code, not separate error classes — not a Gotcha. `@remarks` (to move) notes jsonc/yaml positional parity plus additive `message`. `fromRaw` comment: “Advanced — the parse/stringify entry points call this for you.” `line`/`character` are 0-based; `lineChar` treats CRLF as one newline. `IntegerOutOfRange` and `NestingDepthExceeded` are intentionally shared between parse and stringify code arrays (comment in `internal/diagnostics.ts`). No described `@see` to `TomlParseError` / `TomlStringifyError`.
- `impact`: Callers treating `line` as 1-based will mis-underline; callers searching for a stringify-specific class for `NestingDepthExceeded` will not find one.
- `suggestedFix`: Gotcha: 0-based `line`/`character`; CRLF is one break; `fromRaw` is not a public parse API; two codes are shared across stages. Described `@see` `{@link TomlParseError}` / `{@link TomlStringifyError}` / `{@link TomlErrorCode}`. Type companions get `@see` to their runtime schema (annotation-patterns same-name convention).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-003
- `status`: open
- `fixedCommit`: pending

### toml-R1-019: TomlDocument.ts missing Gotcha — parse succeeds on semantic errors; toValue refuses

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlDocument.ts:46, scratchpad/toml/TomlDocument.ts:83, scratchpad/toml/TomlDocument.ts:133
- `symbol`: TomlDocument
- `kind`: value
- `evidence`: File banner and `@remarks` already pin the differentiator: `parse` fails typed only on lex/parse; a duplicate-key document still parses with the violation in `diagnostics`; `toValue` refuses on non-empty `diagnostics`; `stringify` concatenates expression spans and equals `source` byte-for-byte. No `**Gotchas**`. No described `@see` to `Toml.parse` (value pipeline, fails on the first semantic error) or `TomlFormat` (edits against this CST).
- `impact`: Callers who `yield* TomlDocument.parse(text)` then assume the document is semantically valid will proceed to edit a duplicate-key file and only fail later at `toValue`.
- `suggestedFix`: Gotcha: semantic violations are data on the document, not `parse` failures; `toValue` is the semantic gate. Described `@see` `{@link Toml.parse}` for fail-fast value decode and `{@link TomlFormat}` for span-preserving edits. Drop “Task” language if any remains.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-004
- `status`: open
- `fixedCommit`: pending

### toml-R1-020: TomlEdit.ts missing Gotcha — applyAll throws on overlapping edits; UTF-16 units

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlEdit.ts:31, scratchpad/toml/TomlEdit.ts:60
- `symbol`: TomlRange, TomlEdit
- `kind`: value
- `evidence`: `TomlRange` lead says UTF-16 code units. `applyAll` JSDoc: “Overlapping edits are a programmer error and throw as a defect — `TomlFormat` never produces them.” Implementation `throw new Error(...)`. Reverse-offset apply so earlier offsets stay valid; input array is not mutated. None of this is a class-level Gotcha; `applyAll` has no `@throws`. No described `@see` `{@link TomlFormat.format}` / `{@link TomlFormat.modify}`.
- `impact`: A caller assembling edits by hand will get an untyped `Error` rather than `TomlModificationError` if ranges overlap; UTF-16 vs byte offset confusion mis-applies splices on supplementary-plane text.
- `suggestedFix`: Gotcha on overlap-as-defect, reverse-offset application, and UTF-16 units. `@throws` on `applyAll` without a `{Type}` blob. Described `@see` to `TomlFormat` as the producer that never emits overlaps.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-005
- `status`: open
- `fixedCommit`: pending

### toml-R1-021: TomlFormat.ts missing Gotchas — format is total; modify never creates tables or appends arrays

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlFormat.ts:305, scratchpad/toml/TomlFormat.ts:759, scratchpad/toml/TomlFormat.ts:776, scratchpad/toml/TomlFormat.ts:806
- `symbol`: TomlFormat, TomlModificationError
- `kind`: value
- `evidence`: `computeFormatEdits` returns `[]` on malformed input (“never corrupt it”). `@remarks`: `format`/`formatToString` are pure and total; bytes inside multi-line strings are untouchable; `modify`/`modifyToString` fail with `TomlParseError` or `TomlModificationError`. `modify` JSDoc: every segment but the last must resolve — intermediate tables are never auto-created; `undefined` deletes; array index out of bounds “modify never appends array elements”; empty path fails; path depth capped at `MAX_NESTING_DEPTH`; semantic diagnostics on the document become `TomlModificationError`. No Gotchas section; no described `@see` between `format` and `modify`, or `TomlModificationError` vs `TomlParseError`.
- `impact`: Callers expecting `format` to report syntax errors will treat `[]` as “already formatted.” Callers expecting `modify` to create `[table]` headers or push array elements will get `DottedKeyConflict` / insertion-target failures they cannot diagnose from the class lead.
- `suggestedFix`: Gotchas: malformed `format` → no edits; never rewrite multi-line string interiors; `modify` does not create intermediate tables or append array items; empty path and depth cap fail typed. Described `@see` `{@link TomlEdit.applyAll}`, `{@link TomlDocument.parse}`, `{@link TomlParseError}`, `{@link TomlModificationError}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-006
- `status`: open
- `fixedCommit`: pending

### toml-R1-022: TomlNode.ts missing Gotchas — span tiling, bigint integers, 1.1 multiline inline tables

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlNode.ts:1, scratchpad/toml/TomlNode.ts:71, scratchpad/toml/TomlNode.ts:141, scratchpad/toml/TomlNode.ts:180
- `symbol`: TomlInteger, TomlInlineTable, TomlKeyValue, TomlValueNode
- `kind`: value
- `evidence`: File banner: concatenating every expression source slice reproduces the input byte-for-byte. `TomlInteger` lead: `number` when magnitude fits in 2^53-1, else `bigint`. `TomlInlineTable`: may span multiple lines since TOML 1.1. `TomlKeyValue` span starts at leading whitespace and ends after the terminating newline; `comment` strips `#` and one leading space. No Gotchas; no `@see` from `TomlDateTimeLiteral` to the four `TomlDateTime.ts` classes beyond the field type; no `@see` from `TomlExpression` to `TomlDocument`.
- `impact`: Callers comparing integer nodes with `===` against `number` miss `bigint`; callers assuming inline tables are single-line will mis-compute spans on 1.1 input; comment consumers who prepend `#` will double-hash.
- `suggestedFix`: Gotcha on the tiling invariant (module + `TomlKeyValue`), integer narrowing, 1.1 multiline inline tables, and comment decoding. Described `@see` `{@link TomlDocument}` from `TomlExpression`, and `{@link TomlOffsetDateTime}` (etc.) from `TomlDateTimeLiteral`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-007
- `status`: open
- `fixedCommit`: pending

### toml-R1-023: TomlVisitor.ts missing Gotcha — visit is eager; Comment offset is the `#`; broken “module remarks” pointer

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/TomlVisitor.ts:33, scratchpad/toml/TomlVisitor.ts:117, scratchpad/toml/TomlVisitor.ts:185
- `symbol`: TomlVisitorEvent, TomlVisitor
- `kind`: value
- `evidence`: `TomlVisitorEvent` type lead says “see the module remarks for `offset`'s exact meaning” — **there is no module JSDoc**. File `//` banner pins Comment `offset` as the `#` marker; root `TableStart` uses internal offset `-1` so it sorts before a leading comment at 0. `visit` `@remarks`: construction is eager — full parse/analyze/sort inside `Stream.unwrap`; `Stream.take` does not skip that pass. Fails with `TomlParseError` including semantic `DuplicateKey`, never a raw defect.
- `impact`: A caller who `Stream.take(1)` to peek the root table still pays a full parse of a multi-megabyte document. A caller who treats Comment `offset` as the expression start will highlight the wrong span. The `{@link}`-less “module remarks” pointer is a dead end in the hover.
- `suggestedFix`: Put Comment-offset and eager-build into `**Gotchas**` on `TomlVisitorEvent` / `TomlVisitor.visit`. Delete the “see the module remarks” clause; use `{@link TomlVisitor}` or module Details. Described `@see` `{@link Toml.parse}` (same materialization) and `{@link TomlDocument}` (keep the CST if you need more than events).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-008
- `status`: open
- `fixedCommit`: pending

### toml-R1-024: internal/diagnostics.ts missing Gotcha — shared stringify/parse codes; engine firewall

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/diagnostics.ts:40, scratchpad/toml/internal/diagnostics.ts:68
- `symbol`: TOML_STRINGIFY_ERROR_CODES, RawTomlError
- `kind`: value
- `evidence`: Comment on `TOML_STRINGIFY_ERROR_CODES`: `IntegerOutOfRange` and `NestingDepthExceeded` are intentionally shared with parse codes. File banner: public modules materialize these; the engine never imports public modules. `RawTomlError` is “the engine's only throw carrier besides GuardExceeded.” No Gotchas, no `@see` `{@link GuardExceeded}` or public `TomlDiagnostic`.
- `impact`: A reader unioning parse and stringify codes will think the overlap is a bug and “fix” it; a new engine file that imports `TomlDiagnostic` would recreate the cycle the firewall exists to prevent.
- `suggestedFix`: Gotcha on the two shared codes and the public/engine import firewall. Described `@see` `{@link GuardExceeded}` and `{@link TomlDiagnostic}` (public materialization).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-010
- `status`: open
- `fixedCommit`: pending

### toml-R1-025: internal/limits.ts missing Gotcha — GuardExceeded must not escape; assertCap is a defect

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/limits.ts:10, scratchpad/toml/internal/limits.ts:38
- `symbol`: GuardExceeded, assertCap
- `kind`: value
- `evidence`: `GuardExceeded` JSDoc: “ONLY the public modules catch it and materialize the typed error. It must never escape a public entry point as a defect.” `assertCap` JSDoc: “A NaN or non-integer reaching a guard is a wiring bug and dies as a defect (walker maxDepth rule) — never coerced.” Implementation `throw new TypeError(\`@effected/toml internal cap ...\`)`. No `@throws`, no Gotchas, leftover `@effected/toml` in the TypeError message (runtime, not docs — do not change runtime in this pass; docs should still say it throws `TypeError`).
- `impact`: An internal caller that forgets to catch `GuardExceeded` surfaces a defect to users. Passing `maxDepth: 0` or `NaN` is not a typed `NestingDepthExceeded`.
- `suggestedFix`: Gotcha on both contracts. `@throws` on `assertCap` (TypeError) and note that `GuardExceeded` is thrown by guards, not returned. Described `@see` `{@link MAX_NESTING_DEPTH}` and `{@link TomlParseError}` as the public materialization.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-011
- `status`: open
- `fixedCommit`: pending

### toml-R1-026: internal/parser.ts missing Gotcha — span tiling, BOM on line 0, throws raw carriers

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/parser.ts:1, scratchpad/toml/internal/parser.ts:401
- `symbol`: parseExpressions
- `kind`: value
- `evidence`: Banner: every expression span starts at the line’s leading whitespace (BOM included on the first line) and ends after the terminating newline; blank/comment lines coalesce into one `TomlTrivia`; the only recursion is `parseValue` → array/inline table, depth-capped with `GuardExceeded` at the opening bracket. Inline comment at the BOM skip: “the BOM folds into the first line's leading whitespace, keeping the tiling exact.” Lead still says “the facade (Task 7).”
- `impact`: A caller who strips the BOM before `parseExpressions` then compares spans to the original buffer will be off by one; a caller who expects `TomlParseError` from this function will see `RawTomlError` instead.
- `suggestedFix`: Gotcha: BOM is part of the first expression span; throws `RawTomlError`/`GuardExceeded`, never `TomlParseError`. Described `@see` `{@link Toml.parse}` / `{@link TomlDocument.parse}` as the typed facades. Remove “Task 7.”
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-012
- `status`: open
- `fixedCommit`: pending

### toml-R1-027: internal/scanner.ts missing Gotchas — U+FFFD, optional seconds, empty bare keys, datetime-before-class

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/scanner.ts:70, scratchpad/toml/internal/scanner.ts:142, scratchpad/toml/internal/scanner.ts:458, scratchpad/toml/internal/scanner.ts:572
- `symbol`: assertValidUnicode, scanBareKey, scanValueToken, classifyValueToken
- `kind`: value
- `evidence`: `assertValidUnicode` JSDoc already states the trade: grammar admits U+FFFD in strings/comments; the engine rejects it because a JS string cannot recover the original malformed UTF-8 (toml-test `invalid/encoding/*`). `scanBareKey`: “the value may be empty.” G5 comment: TOML 1.1 optional seconds — `07:32` is valid, `07:32.5` is not; regexes must not chain seconds and fraction as independent optionals. `scanValueToken`: a full date plus space plus digit continues through the time so `1979-05-27 07:32:00Z` is one token. Banner: datetime range validation happens **before** constructing the classes so the diagnostic carries the token offset. `classifyValueToken`: absent seconds materialize as `0`.
- `impact`: A document whose only “illegal” character is a U+FFFD that would be legal TOML still fails `InvalidUtf8`. A caller classifying `07:32.5` as a time will not match; one constructing `TomlLocalTime` without prior validation gets a schema message instead of an offset-bearing diagnostic.
- `suggestedFix`: Promote those comments into Gotchas on the four symbols. `@throws` on `assertValidUnicode`. Described `@see` from `classifyValueToken` to the four date-time classes and from `scanValueToken` to `classifyValueToken`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-013
- `status`: open
- `fixedCommit`: pending

### toml-R1-028: internal/semantic.ts missing Gotchas — first violation, table-dotted header pass-through, __proto__

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/semantic.ts:1, scratchpad/toml/internal/semantic.ts:224, scratchpad/toml/internal/semantic.ts:259
- `symbol`: analyze, buildValue
- `kind`: value
- `evidence`: Banner: first violation wins; header navigation **passes through** `table-dotted` intermediates (spec: `[table]` may define sub-tables inside dotted-key tables); only landing the **final** header segment on an existing `table-dotted` is an error. `setOwnProperty`: `__proto__` is defined as an own data property, matching `JSON.parse` and yaml. `analyze` throws `RawTomlError`. `buildValue` rides the same walk as the default visitor.
- `impact`: A caller who treats any dotted-key table as frozen will reject valid 1.1 documents (`common-46.toml`). A `__proto__` key assigned with `target[key] =` would mutate the prototype; the engine deliberately does not.
- `suggestedFix`: Gotchas on first-violation-wins, dotted-header pass-through vs final-segment error, and `__proto__` own-property assignment. Described `@see` `{@link parseExpressions}` (CST in) and `{@link Toml.parse}` (typed out).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-014
- `status`: open
- `fixedCommit`: pending

### toml-R1-029: internal/stringifyValue.ts missing Gotchas — table root, JS 1.0 vs 1, 1.0 spellings, offsets 0

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/internal/stringifyValue.ts:1, scratchpad/toml/internal/stringifyValue.ts:100, scratchpad/toml/internal/stringifyValue.ts:291
- `symbol`: stringifyValue, renderInlineValue, renderKey
- `kind`: value
- `evidence`: Banner: layout is pairs then `[dotted.header]` then `[[dotted.header]]`; errors use offset `0` (no source text). `renderNumber` comment: “a JS `1.0` is indistinguishable from `1` — every JS emitter shares this divergence”; `-0` emits `-0.0`; int64-overflowing integrals emit as floats to round-trip. `stringifyValue`: root must be a plain object (“a TOML document is a table”); empty root emits `""`; anything else ends with `newline`. `raise` always `offset: 0, length: 0`. Public `TomlStringifyOptions` remarks (1.0-only spellings) apply here.
- `impact`: `stringifyValue([1, 2], "\n")` is `UnsupportedValue`, not an array document. `stringifyValue({ n: 1.0 }, "\n")` prints `n = 1`. Empty object prints empty string, not a trailing newline — surprising if a caller concatenates documents.
- `suggestedFix`: Gotchas on table-only root, empty-root `""`, JS number identity, offset-0 diagnostics, 1.0 spellings. Described `@see` `{@link Toml.stringify}` as the typed facade and `{@link TomlStringifyOptions}` for newline.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-015
- `status`: open
- `fixedCommit`: pending

### toml-R1-030: Kit-port Examples import @effected/toml and leave Effect programs unrun

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/toml/Toml.ts:166, scratchpad/toml/Toml.ts:201, scratchpad/toml/Toml.ts:252, scratchpad/toml/Toml.ts:355, scratchpad/toml/TomlDocument.ts:64
- `symbol`: Toml, Toml.parseResult, Toml.stringifyResult, Toml.bind, TomlDocument
- `kind`: value
- `evidence`: Review-brief defect “Example imports from `@effected/*` or … unused binding.” All five `@example` fences `import { Toml } from "@effected/toml"` / `import { TomlDocument } from "@effected/toml"`. `Toml` class and `Toml.bind` and `TomlDocument` examples bind `const program = Effect.gen(...)` and never run it, never `console.log`, never assert — vacuous under “a void-discarded value is a compile trick, not documentation.” `Toml.parseResult` / `stringifyResult` examples are observable (`Result.isSuccess` + `console.log`) and should be preserved when converting the carrier. `Toml.bind` uses `import { Effect, Schema } from "effect"` (named `Schema` from root `effect` is allowed; not `effect/Schema`).
- `impact`: Converted titled Examples will fail docgen compilation unless the import path is the in-repo module (or the future `@beep/*` alias). Unrun `program` examples teach nothing.
- `suggestedFix`: When converting to `**Example** (Title)`, import from the scratchpad/package path that docgen can resolve — never `@effected/toml`. Run the Effect (`Effect.runPromise` / `Effect.runSync`) or switch to the already-good `parseResult` style. Keep `import * as S from "effect/Schema"` if the example leaves the root `effect` `Schema` named import. Do not add extra Examples if one observable titled Example exists after conversion.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: toml-R1-001, toml-R1-004
- `status`: open
- `fixedCommit`: pending

### toml-R1-031: Exported schemas lack $I.annote / $I.annoteSchema (kit-port identity gap)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/toml/Toml.ts:33, scratchpad/toml/Toml.ts:45, scratchpad/toml/Toml.ts:64, scratchpad/toml/TomlDateTime.ts:97, scratchpad/toml/TomlDiagnostic.ts:22, scratchpad/toml/TomlDiagnostic.ts:79, scratchpad/toml/TomlDiagnostic.ts:106, scratchpad/toml/TomlDocument.ts:78, scratchpad/toml/TomlEdit.ts:38, scratchpad/toml/TomlEdit.ts:55, scratchpad/toml/TomlFormat.ts:61, scratchpad/toml/TomlFormat.ts:74, scratchpad/toml/TomlNode.ts:19, scratchpad/toml/TomlNode.ts:37, scratchpad/toml/TomlNode.ts:160, scratchpad/toml/TomlNode.ts:239
- `symbol`: TomlStringifyOptions, TomlParseError, TomlStringifyError, TomlLocalDate, TomlLexErrorCode, TomlErrorCode, TomlDiagnostic, TomlDocument, TomlRange, TomlEdit, TomlFormattingOptions, TomlModificationError, TomlKeyKind, TomlKey, TomlValueNode, TomlExpression
- `kind`: value
- `evidence`: `rg '$I' scratchpad/toml` is empty. Annotation-patterns require `$I.annote` on `S.Class` / `S.TaggedClass` / `S.TaggedError` and `$I.annoteSchema` (or LiteralKit `.annotate($I.annote)`) on non-class schemas. This kit-port uses bare `Schema.Class("Name")`, `Schema.TaggedClass()("Name", …)`, `Schema.TaggedError()("Name", …)`, and `Schema.Literals(...)`. Same-name type aliases **are** present for Literal/union schemas (`TomlLexErrorCode`, `TomlKeyKind`, `TomlValueNode`, `TomlExpression`, …) — do not invent extras. Class schemas correctly double as the decoded type.
- `impact`: When the pack lands as a beep package, schema identity/JSON-schema titles will be missing; LiteralKit law (`@beep/schema`) is not followed. Not a census mechanical rule, but it is the schema-annotation half of this specialist’s job.
- `suggestedFix`: After a package `$I` composer exists, annotate every exported class/error with `$I.annote("Name", { description })` matching the JSDoc lead, and every `Schema.Literals` / `Schema.Union` / `Schema.suspend` export with `$I.annoteSchema` or LiteralKit `.annotate`. Do not block JSDoc conversion on identity if the composer is not in this pack yet — apply in the same file touch when identity is available.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Pack verdict

- files reviewed: 15
- owning exports reviewed: 92
- confirmed mechanical items: 15
- editorial items: 16
- rejected false positives: 1
- accepted findings: 31

Every exporting module and every owning export was reviewed. `toml/index.ts` has no owning exports; its module header was still reviewed (census skipped it). No file was skipped. Kit-port shape is uniform: lift `//` banners into `@packageDocumentation` + `@since 0.0.0`, add `@category`/`@since` on every owning export, replace `@example`/`@remarks` with titled Examples and Details/Gotchas, then add the Gotchas the implementation comments already know.
