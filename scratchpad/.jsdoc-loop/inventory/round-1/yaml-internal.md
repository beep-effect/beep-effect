# Pack yaml-internal — round 1 inventory

Read-only review of every exporting module and owning export under `yaml/internal/`. Census confirmed: 37 modules (36 open at module-header level), 183 owning exports, 0 re-exports. No `@example` / `@remarks` / `@module` / `@template` carriers exist in the pack.

Census `missingTags` lists `@example` for value-level exports. That is a **stand-in for a titled `**Example** (Title)` section**. Suggested fixes must never introduce `@example` or `@remarks` (zero-legacy ratchet). Pure type-level exports correctly omit Example from the census and remain Example-optional.

Existing `//` file headers are useful engineering notes, not JSDoc module docs. Convert them into a fileoverview lead plus `@packageDocumentation` and `@since 0.0.0`. Never `@module`. Mark internals `@internal` (tag order: `@see` → `@internal` → `@category` → `@since`).

---

## Mechanical (one item per file)

### yaml-internal-R1-001: composer/anchors.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/anchors.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. Value exports missing `@category` `@since` titled Example: `checkAnchorOnAlias` (has lead), `makeAlias` (no lead), `registerAnchor` (no lead), `getAnchorName` (no lead), `getAliasName` (no lead), `scanName` (no lead), `buildAnchorMap` (has lead), `getNodeValue` (has lead).
- `impact`: Callers of alias construction and the facade value-extraction path have no IDE hover contract, and the ratchet scores every value export as open.
- `suggestedFix`: Convert the `//` header into a JSDoc fileoverview with `@packageDocumentation` `@since 0.0.0`. Document each export with a useful lead, `@category` (`predicates` / `constructors` / `getters` / `utilities`), `@since 0.0.0`, `@internal`, and a titled Example for every value. Lift alias-budget and DuplicateAnchor comments into Gotchas (see R1-038..040).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-038, yaml-internal-R1-039, yaml-internal-R1-040
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-002: composer/block.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/block.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. Values missing tags+Example: `composeBlockMap` (has lead), `flattenBlockMapChildren` (no lead), `buildPairs` (has lead), `keyIdentity` (has lead), `checkDuplicateKeys` (no lead), `checkMultilineImplicitKeys` (has lead), `checkTrailingContentOnSameLine` (has lead), `composeBlockSeq` (no lead), `composeFlatBlockMap` (has lead). Type `SemanticItem` missing lead+`@category`+`@since` (Example optional).
- `impact`: Block composition is the shared pair-building seam used by flow composition; undocumented `keyIdentity` and nesting-depth placeholder maps hide DoS and duplicate-key semantics.
- `suggestedFix`: Fileoverview from the `//` header (`state.flow` cycle firewall). Document values with titled Examples (compose a small `a: 1` CST, show `keyIdentity` distinguishing `1` vs `1.0`). Document `SemanticItem` as type-level (`@category type-level`). Mention `enterNesting` placeholder empty collections. `@internal` `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-045, yaml-internal-R1-047
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-003: composer/comments.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/comments.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. 12 values missing `@category` `@since` Example (`hasBlankLineBetween`, `sameLineSpan`, `isOwnLineAt`, `isAfterIndicatorOnly`, `hasBlankLineAbove`, `blankLineAboveStart`, `blankAboveIsKeepChompContent`, `hasBlankLineBelow`, `rawCommentText`, `joinComments`, `columnAt`, `withCommentFields`). Types `CommentFields`, `EscapedComment` have leads but missing `@category` `@since`.
- `impact`: Comment-fidelity helpers encode reserved empty-string storage and keep-chomp double-count rules that a caller reconstructing AST comments will violate without JSDoc Gotchas.
- `suggestedFix`: Lift the node-level attribution `//` header into the module JSDoc. Keep type-level prose-only for the two interfaces. Add titled Examples for values (`rawCommentText("# section")`, keep-chomp blank gate). See R1-048.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-048
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-004: composer/document.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/document.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. Values: `composeDocument` (no lead), `validateCrossDocumentDirectives` (has lead), `EMPTY_DOCUMENT` (no lead), `composeFirstDocument` (has lead), `composeFirstDocumentCounted` (has lead), `composeAllDocuments` (has lead) — all missing `@category` `@since` Example.
- `impact`: Engine entry points the facade drives. Existing leads already warn that fatal-code filtering is the facade's job; without tags/Examples the census stays open and the Gotcha is not on the published hover.
- `suggestedFix`: Fileoverview noting this is the only composer module that imports both `block.ts` and `flow.ts`. Document `EMPTY_DOCUMENT` (`@category constants`) and the compose entry points (`@category parsing`) with Examples over `"a: 1\\n---\\nb: 2"` showing `documentCount`. Lift fatal-filter Gotcha onto the three compose exports (R1-049).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-049
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-005: composer/flow.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/flow.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `composeFlowMap`, `flattenFlowChildren`, `composeFlowSeq` all missing lead+`@category`+`@since`+Example.
- `impact`: Flow composers are injected through `FlowComposers` specifically so `block.ts` never imports this file; undocumented exports hide that one-way import and the nesting-depth placeholder maps/seqs.
- `suggestedFix`: Fileoverview from the `//` header (flow → block only). Document the three values (`@category parsing`) with a titled Example composing `{a: 1}` / `[1, 2]` and a Gotcha that exhausted `enterNesting` returns an empty collection. `@internal` `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-045, yaml-internal-R1-047
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-006: composer/scalars.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/scalars.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. 24 value exports missing `@category` `@since` Example. Missing leads: `resolveScalar`, `getScalarStyle`, `getScalarValue`, `findFirstContent`, `findLastContent`, `indexOfChild`, `makeScalar`. Other 17 have leads (including `classifyPlainNumeric`, `getBlockChomp`, `shouldPreserveRaw`) but still lack tags/Example.
- `impact`: Core Schema resolution, chomp/indent header parsing, and raw-preservation (`0xFFEEBB`) are undocumented at the tag/Example layer; `makeScalar` header-comment capture (#341) is invisible on hover.
- `suggestedFix`: Fileoverview from the `//` header. Document getters/predicates/constructors with canonical categories. Example `resolveScalar("0x10", "plain")` vs tagged `!!str`. Gotcha on `shouldPreserveRaw`: special floats do not keep `.INF`/`.NaN`. `@internal` `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-007: composer/state.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/state.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. Values missing tags+Example: `getLineStarts` (no lead), `lineCol` (no lead), `sameLine` (has lead), `hasNonWhitespaceBeforeOnLine` (has lead), `lineIndentColumn` (has lead), `hasMeta` (no lead), `clearMeta` (no lead), `commentProps` (has lead), `createState` (no lead), `MAX_NESTING_DEPTH` (has lead), `enterNesting` (has lead), `exitNesting` (has lead). Types `NodeMeta` (no lead), `FlowComposers` (has lead), `ComposerState` (no lead) missing `@category` `@since`.
- `impact`: Shared composer state is the cycle-firewall hub (`FlowComposers`) and the alias/nesting budgets. Undocumented `createState` defaults (`maxAliasCount: 100`) hide the DoS guard.
- `suggestedFix`: Fileoverview: imports nothing from other composer modules. Document types as `@category type-level`. Values: `utilities`/`predicates`/`constructors`/`constants`. Examples for `createState` defaults and `enterNesting` returning false at 256. Lift cache/cycle/nesting Gotchas (R1-039, R1-045, R1-047, R1-061).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-039, yaml-internal-R1-045, yaml-internal-R1-047, yaml-internal-R1-061
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-008: composer/tags.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/tags.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `resolveTagHandle` (has lead), `parseDirective` (no lead), `validateTagHandlesInDocument` (has lead) missing `@category` `@since` Example.
- `impact`: `%TAG` handles are document-local (QLJ7). Without an Example a caller may assume handles leak across `---`.
- `suggestedFix`: Fileoverview: `parseDirective` lives here to avoid a `document.ts` cycle. Document the three functions (`@category parsing`) with an Example resolving `!!int` and a failing undeclared `!e!` handle. Gotcha: `!!` and `!` are always available; named handles must be declared in the **same** document (R1-046).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-046
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-009: cst-parser.ts module + owning export lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/cst-parser.ts:1
- `symbol`: parseCSTAll
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. Sole owning export `parseCSTAll` has a lead but missing `@category` `@since` Example.
- `impact`: CST nesting is capped at `MAX_NESTING_DEPTH + 8` so the composer diagnostic always fires first; that budget is an unexported constant and will not appear on the public hover unless the Example/Gotcha says so.
- `suggestedFix`: Fileoverview from the `//` header (no value interpretation). Document `parseCSTAll` (`@category parsing`) with an Example showing `"true"` remains a `flow-scalar` whose `source` is `"true"`. Gotcha: `MAX_CST_DEPTH = 256 + 8` (R1-047).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-047
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-010: cst-visitor.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/cst-visitor.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. 13 event types + `CstVisitorEvent` missing `@category` `@since` (Example optional). `cstEvents` has a lead but missing `@category` `@since` Example.
- `impact`: The visitor's scalar→block-map sibling-key rewrite is the only documented explanation of a surprising CST shape; it currently lives in a `//` header, not on `cstEvents` or `CstKeyEvent`.
- `suggestedFix`: Fileoverview + `@packageDocumentation` `@since 0.0.0`. Types `@category type-level`. `cstEvents` `@category parsing` with an Example over `name: John` showing a `CstKeyEvent` then map events. Lift sibling-key Gotcha (R1-050). Generator never throws — errors are `CstErrorEvent`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-050
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-011: cst.ts module tags + type exports lack `@category` `@since`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/cst.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: `hasFileoverview` true via `//` header; missing-packageDocumentation|missing-module-since. `CstNodeType` and `CstNode` have leads but missing `@category` `@since`. Example optional (pure types).
- `impact`: Module docs do not satisfy the exporting-module header law; type hovers lack canonical tags.
- `suggestedFix`: Convert the `//` header to JSDoc with `@packageDocumentation` `@since 0.0.0`. Add `@category type-level` `@since 0.0.0` `@internal` on both types. Keep the "no interpretation — `true` is still `"true"`" sentence on `CstNode`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-012: diagnostics.ts module tags + 14 owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/diagnostics.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: `hasFileoverview` true via `//` header; missing-packageDocumentation|missing-module-since. Values missing tags+Example: `YAML_LEX_ERROR_CODES`, `YAML_PARSE_ERROR_CODES`, `YAML_COMPOSE_ERROR_CODES`, `YAML_STRINGIFY_ERROR_CODES` (has lead), `YAML_MODIFY_ERROR_CODES` (has lead), `FATAL_CODES` (has lead), `isFatalCode` (has lead). Types `YamlLexErrorCode`, `YamlParseStageErrorCode`, `YamlComposeErrorCode`, `YamlStringifyStageErrorCode`, `YamlModifyStageErrorCode`, `YamlErrorCode`, `RawDiagnostic` have one-line leads but missing `@category` `@since`.
- `impact`: Fatality, raw-vs-public diagnostics, and the facade→engine import arrow are the pack's diagnostic contract. Census keeps every constant open until Examples exist.
- `suggestedFix`: Convert `//` header to JSDoc (`@packageDocumentation` `@since 0.0.0`). Constants `@category constants` / `diagnostics`; `isFatalCode` `@category predicates`; types `@category type-level`. Value Examples: `isFatalCode("UndefinedAlias") === true`, `isFatalCode("CircularAlias") === false`. Lift Gotchas (R1-042, R1-043, R1-044, R1-064).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-042, yaml-internal-R1-043, yaml-internal-R1-044, yaml-internal-R1-064
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-013: diff.ts module tags + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/diff.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: `hasFileoverview` true; missing-packageDocumentation|missing-module-since. `RawEdit` (has lead) missing `@category` `@since`. `computeEdits` (has lead) missing `@category` `@since` Example.
- `impact`: Prefix/suffix diff assumes a shared AST skeleton and LF endings from the stringifier; callers feeding unrelated strings get a single coarse edit without that warning on hover.
- `suggestedFix`: JSDoc module header. `RawEdit` `@category type-level`. `computeEdits` `@category utilities` with an Example of a one-line value change and a Gotcha for the skeleton/LF assumption (R1-054).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-054
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-014: equal.ts module tags + deepEqual lack required JSDoc tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/equal.ts:1
- `symbol`: deepEqual
- `kind`: module
- `evidence`: `hasFileoverview` true; missing-packageDocumentation|missing-module-since. `deepEqual` has a strong lead (NaN, key order) but missing `@category` `@since` Example.
- `impact`: NaN-equals-NaN and mapping-key-order independence are YAML semantics a `===` caller will get wrong; the Example is what makes them observable.
- `suggestedFix`: JSDoc module header. `deepEqual` `@category predicates` `@since 0.0.0` with an Example `deepEqual(Number.NaN, Number.NaN)` and unordered keys. Lift NaN Gotcha (R1-055).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-055
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-015: fold.ts module tags + 8 value exports lack required JSDoc tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/fold.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: `hasFileoverview` true; missing-packageDocumentation|missing-module-since. All 8 values have leads but missing `@category` `@since` Example: `foldScalarLine`, `foldRenderedScalar`, `isControlChar`, `hasInteriorTrailingWhitespace`, `hasNewlineSpacesTab`, `renderSingleQuotedMultiline`, `renderBlockLiteral`, `renderBlockFolded`.
- `impact`: Width folding is best-effort and must not corrupt values; `hasInteriorTrailingWhitespace` exists to avoid ReDoS. Without Examples those contracts stay in comments.
- `suggestedFix`: JSDoc module header. Categories: `folding` / `predicates` / `formatting`. Example: `foldScalarLine` with `lineWidth <= 0` returns the text unchanged; overflow without a safe split stays unwrapped. Mention TAB is not a control char in `isControlChar`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-016: lexer.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/lexer.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `YamlScanner` (has lead) missing `@category` `@since`. `createScanner` and `lexAll` have leads but missing `@category` `@since` Example.
- `impact`: This is the only mutable pipeline module. `setPosition` is unsafe at arbitrary offsets; that constraint is on an interface method comment, not tagged, and `lexAll` embeds errors as `"error"` tokens rather than throwing.
- `suggestedFix`: Fileoverview from the `//` header. `YamlScanner` `@category type-level`. `createScanner` `@category factories`, `lexAll` `@category parsing`, titled Examples tokenizing `"a: 1"` and an unterminated quote producing an `"error"` token. Lift `setPosition` Gotcha (R1-057).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-057
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-017: options.ts module + owning type exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/options.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `ParseOptionsInput` and `StringifyOptionsInput` have leads and field comments but missing `@category` `@since`. Example optional (pure types).
- `impact`: Engine-side option records exist so the engine never imports facade `Schema.Class` types (cycle firewall). `maxAliasCount` default `100` is a DoS guard that belongs on the type hover.
- `suggestedFix`: Fileoverview: engine takes plain records; defaults applied at consumption (`??`). Both interfaces `@category type-level` `@internal` `@since 0.0.0`. Described `@see` to public facade option classes. Lift alias-budget default (R1-039).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-039, yaml-internal-R1-042
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-018: raw-document.ts module + owning type exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/raw-document.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `RawDirective` and `RawYamlDocument` have leads but missing `@category` `@since`.
- `impact`: Engine emits this record; the facade materializes `YamlDocument`. Without module tags the cycle-firewall story is only a `//` comment.
- `suggestedFix`: Fileoverview from the `//` header. Both types `@category type-level` `@internal` `@since 0.0.0`. Described `@see` to `RawDiagnostic` and public `YamlDocument`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-042
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-019: requote.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/requote.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `RequoteScalarInput` (has lead), `RequoteMode` (thin lead pointing at the `//` header), `requoteScalarText` (has lead) — types missing `@category` `@since`; value missing those plus Example.
- `impact`: Conservative (lint) vs escaping (format) modes are deliberately distinct; a caller passing `"escaping"` into the lint fix, or the reverse, corrupts or skips quotes. Cycle firewall (public AST types only) is only in the `//` header.
- `suggestedFix`: Convert the long `//` header into the module JSDoc. Types `@category type-level`. `requoteScalarText` `@category formatting` with two titled Examples (conservative skip when inner ≠ value; escaping single→double). Gotchas R1-041.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-041
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-020: rules/catalog.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/catalog.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `builtinRules` and `builtinOptionsSchemas` have leads but missing `@category` `@since` Example.
- `impact`: A schema-less built-in would validate as a custom rule with opaque options. That pairing invariant is a `//` comment, not JSDoc.
- `suggestedFix`: Fileoverview: values, not a re-export barrel. Both constants `@category constants` with an Example that `builtinOptionsSchemas.get(builtinRules[0].id)` is defined and `parse-validity` is first. Gotcha R1-059.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-059
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-021: rules/colon-spacing.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/colon-spacing.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `colonSpacingOptions` and `colonSpacing` have leads but missing `@category` `@since` Example.
- `impact`: `maxSpacesAfter: 0` would emit `a:val` (a plain scalar, not a mapping). The clamp is only an implementation comment.
- `suggestedFix`: Lift the `//` header into module JSDoc. Options `@category schemas`, rule `@category validation`, titled Example on `key : value`. Gotcha R1-053. Examples use `import * as S from "effect/Schema"` if Schema is shown.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-053
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-022: rules/comments-spacing.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/comments-spacing.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `commentsSpacingOptions`, `commentsSpacing` have leads but missing `@category` `@since` Example.
- `impact`: Shebang `#!` at offset 0 is exempt; without an Example a fixer will "correct" it.
- `suggestedFix`: Module JSDoc from the `//` header. Schema + rule tags. Example: trailing `#` without a space vs `#!/usr/bin/env` at stream start. `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-023: rules/document-end.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/document-end.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `documentEndOptions`, `documentEnd` have leads but missing `@category` `@since` Example.
- `impact`: Mid-stream `...` is document structure, not this rule's business; the export lead says only "the `...` marker at the tail".
- `suggestedFix`: Module JSDoc from the `//` header (opt-in, tail-of-stream only). Tags + Example. Lift stream-scope Gotcha (R1-058).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-058
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-024: rules/document-start.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/document-start.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `documentStartOptions`, `documentStart` have leads but missing `@category` `@since` Example.
- `impact`: Removing a mid-stream `---` would merge documents. Directives require `---`. Those rules are in the `//` header, not on the export.
- `suggestedFix`: Module JSDoc from the `//` header. Tags + Example. Gotcha R1-058 (stream head only; directives require `---`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-058
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-025: rules/empty-lines.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/empty-lines.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `emptyLinesOptions`, `emptyLines` have leads but missing `@category` `@since` Example.
- `impact`: Blank lines inside scalar content are the value's business; a layout fix that deletes them corrupts the document.
- `suggestedFix`: Module JSDoc from the `//` header. Tags + Example showing a block-scalar interior blank is skipped. Cross-link `insideScalarSpan`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-060
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-026: rules/eof-newline.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/eof-newline.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `eofNewlineOptions`, `eofNewline` have leads but missing `@category` `@since` Example.
- `impact`: Empty documents are skipped; the inserting fix is a zero-length edit at EOF — needs an observable Example.
- `suggestedFix`: Module JSDoc from the `//` header. Tags + Example on a non-empty file without a trailing newline showing `fix.content === "\\n"`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-027: rules/hyphen-spacing.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/hyphen-spacing.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `hyphenSpacingOptions`, `hyphenSpacing` have leads but missing `@category` `@since` Example.
- `impact`: `maxSpacesAfter: 0` would emit `-item` (plain scalar, not a sequence entry). Clamp is an implementation comment.
- `suggestedFix`: Module JSDoc. Tags + Example. Gotcha R1-053 (clamp ≥ 1). Spaces before the hyphen are indentation, not this rule.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-053
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-028: rules/indentation.ts owning exports lack `@category` `@since` Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/indentation.ts:38
- `symbol`: indentationOptions
- `kind`: value
- `evidence`: Module header already has a useful lead, `@packageDocumentation`, and `@since 0.0.0` (census module findings: none). Exports `indentationOptions` and `indentation` have thin leads (`Options for indentation…`, `Block-structure indent style.`) but missing `@category` `@since` Example. Census open owning still counts both.
- `impact`: The module already teaches "no fix; skip scalar/flow"; the value exports the facade actually imports do not carry tags or an Example, so the ratchet stays open.
- `suggestedFix`: Do not rewrite the module header. Add `@category schemas` / `@category validation`, `@since 0.0.0`, `@internal`, and a titled Example that flags an inconsistent indent on a well-formed mapping while skipping a block-scalar body. Lift "no fix / not parse-validity" onto the `indentation` export as Gotchas.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-029: rules/key-duplicates.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/key-duplicates.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `keyDuplicatesOptions`, `keyDuplicates` have leads but missing `@category` `@since` Example.
- `impact`: Lint composes with `uniqueKeys` disabled so this rule owns duplicate policy; `!!int 1` vs `"1"` must not collide. That identity is `keyIdentity` plus a `//` header.
- `suggestedFix`: Module JSDoc from the `//` header. Tags + Example of duplicate `a:` keys vs non-colliding `1` / `"1"`. Described `@see` `{@link keyIdentity}`. Cross-link parse-validity (R1-052).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-052
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-030: rules/line-length.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/line-length.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `lineLengthOptions`, `lineLength` have leads but missing `@category` `@since` Example.
- `impact`: Default `max` is 120 (kit-native, not yamllint's). No fix — reflow is formatting. Neither fact is tagged.
- `suggestedFix`: Module JSDoc from the `//` header. Tags + Example with `max: 10` on a long line and `fix` absent. Gotcha: no autofix.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-031: rules/parse-validity.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/parse-validity.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `parseValidityOptions` (has lead), `parseValidity` (has lead) missing `@category` `@since` Example.
- `impact`: Always-on rule #1; `"off"` and severity overrides are rejected at config time. Duplicate keys never reach this bridge. Those contracts are comments, not hover docs.
- `suggestedFix`: Module JSDoc from the `//` header. Empty struct `@category schemas`; rule `@category validation`. Example mapping an engine error into a lint diagnostic. Gotcha R1-052.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-052
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-032: rules/quoted-strings.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/quoted-strings.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `quotedStringsOptions`, `quotedStrings` have leads but missing `@category` `@since` Example.
- `impact`: Lint fixes use `requoteScalarText(..., "conservative")` only. Escaping mode is the format path. Mixing them is a silent dialect split (#347).
- `suggestedFix`: Module JSDoc from the `//` header (keys out of scope). Tags + Example of a safe double-quote wrap vs a skipped escaped scalar (no fix). Gotcha R1-041 / R1-051.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-041, yaml-internal-R1-051
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-033: rules/trailing-spaces.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/trailing-spaces.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `trailingSpacesOptions`, `trailingSpaces` have leads but missing `@category` `@since` Example.
- `impact`: Trailing whitespace inside scalar content is value, not layout — recorded divergence from yamllint. A "helpful" fix would corrupt block scalars.
- `suggestedFix`: Module JSDoc from the `//` header. Tags + Example deleting end-of-line spaces on a mapping line while skipping a `|` scalar body. Gotcha R1-060.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-060
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-034: rules/truthy.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/truthy.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. `truthyOptions`, `truthy` have leads but missing `@category` `@since` Example.
- `impact`: Workflow `on:` keys are the canonical victim. Tagged `!!bool`/`!!str` is explicit intent and never flagged. Default `checkKeys: true`.
- `suggestedFix`: Module JSDoc from the `//` header. Tags + Example flagging `on:` and leaving `!!bool yes` alone. Two fix kinds (respell vs quote) belong in Details.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-035: rules/util.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/util.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. Values missing tags+Example: `nonNegativeIntegerOption`, `positiveIntegerOption`, `walkScalars`, `isScalarContinuationLine`, `coveringToken`, `insideScalarSpan`, `positionAt` (most have leads). Type `ScalarRole` has a lead but missing `@category` `@since`.
- `impact`: `positiveIntegerOption` exists because `0` fuses `- item` → `-item`. `insideScalarSpan` is the corruption firewall for layout rules. Both need Examples.
- `suggestedFix`: Module JSDoc from the `//` header. Schemas `@category schemas` with Examples of reject messages; predicates `@category predicates`; `walkScalars` `@category folding` or `utilities`; `ScalarRole` `@category type-level`. Gotchas R1-053, R1-060. No `$I` identity exists in this scratchpad (R1-063).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-053, yaml-internal-R1-060, yaml-internal-R1-063
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-036: stringifier.ts module + owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/stringifier.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Module missing-module-summary|missing-packageDocumentation|missing-module-since. Values with leads but missing `@category` `@since` Example: `StringifyFailure`, `StringifyDepthExceeded`, `renderDoubleQuoted`, `renderSingleQuoted`, `stripNodeComments`, `stringifyValue`, `stringifyDocument`.
- `impact`: Sync throws (`StringifyFailure`, `StringifyDepthExceeded`) are the facade's typed-error source. Without `@throws` and Examples, callers treat stringify as total.
- `suggestedFix`: Fileoverview from the `//` header. Classes `@category errors`; renderers `@category formatting`; `stripNodeComments` `@category mapping`; entry points `@category encoding`. Titled Examples for circular throw vs `.nan` rendering. `@throws` on `stringifyValue` / `stringifyDocument` (R1-062). Nesting Gotcha R1-047.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-047, yaml-internal-R1-062
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-037: token.ts module tags + type exports lack `@category` `@since`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/token.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: `hasFileoverview` true via `//` header; missing-packageDocumentation|missing-module-since. `YamlTokenKind` and `YamlToken` have leads but missing `@category` `@since`. Example optional.
- `impact`: Token layer is not public surface; without `@internal` and module tags a reader may treat it as the deferred `Stream<YamlToken>` API.
- `suggestedFix`: Convert `//` header to JSDoc with `@packageDocumentation` `@since 0.0.0`. Both types `@category type-level` `@internal` `@since 0.0.0`. Note UTF-16 `length` on `YamlToken`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Editorial Gotchas (implementation comments already warn)

### yaml-internal-R1-038: makeAlias alias budget — undefined vs count, only defined aliases count

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/anchors.ts:30
- `symbol`: makeAlias
- `kind`: value
- `evidence`: Implementation comments: "Check existence first — an undefined alias is a more specific error than a count exceeded error." / "Only count valid (defined) aliases toward the limit." `state.aliasCount++` only in the `else` of `state.anchors.has(name)`.
- `impact`: A hostile document of undefined `*x` references does not trip `AliasCountExceeded`. A caller documenting or testing the DoS guard against dangling aliases will think the budget is broken.
- `suggestedFix`: Add a **Gotchas** section on `makeAlias`: (1) undefined aliases emit `UndefinedAlias` and do not increment `aliasCount`; (2) `AliasCountExceeded` fires only after a defined alias pushes the count past `options.maxAliasCount`. Example: one defined `&a` plus many `*missing` stays under the budget; `*a` repeated `maxAliasCount + 1` times exceeds it.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-001
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-039: maxAliasCount default 100 is a DoS guard

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/options.ts:12
- `symbol`: ParseOptionsInput
- `kind`: type
- `evidence`: Field comment: "Max alias nodes per document (DoS guard). Default `100`." `createState` applies `options?.maxAliasCount ?? 100`. `AliasCountExceeded` is in `FATAL_CODES`.
- `impact`: Engine option types are internal; the default is easy to miss. Raising the cap without understanding the alias-count rule (R1-038) reopens billion-laughs style expansion.
- `suggestedFix`: On `ParseOptionsInput.maxAliasCount` and `createState`, state in Details/Gotchas that the default is `100`, that it counts **defined** alias nodes, and that exceeding it is fatal (`isFatalCode("AliasCountExceeded")`). Described `@see` `{@link makeAlias}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-007, yaml-internal-R1-017, yaml-internal-R1-038
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-040: DuplicateAnchor code reused for "anchor on alias"; registerAnchor emits a warning

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/anchors.ts:19
- `symbol`: checkAnchorOnAlias
- `kind`: value
- `evidence`: `checkAnchorOnAlias` JSDoc already says it reuses `DuplicateAnchor` because adding `AnchorOnAlias` would be a public API change; it pushes to `state.errors`. `registerAnchor` pushes the same code to `state.warnings` and last-write-wins the map. `FATAL_CODES` includes `DuplicateAnchor`.
- `impact`: Consumers switching on `code` cannot distinguish "anchor on alias" (error, fatal if it lands in errors) from "same name defined twice" (warning, last anchor wins). Message text is the only discriminator.
- `suggestedFix`: Keep the existing lead. Add **Gotchas** on `checkAnchorOnAlias`, `registerAnchor`, and `YAML_COMPOSE_ERROR_CODES`: same code, different channel (errors vs warnings), last-write-wins on the map, inspect `message` to tell the cases apart. Do not invent an `AnchorOnAlias` code in docs.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-001, yaml-internal-R1-012
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-041: requote cycle firewall and conservative vs escaping modes

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/requote.ts:1
- `symbol`: requoteScalarText
- `kind`: value
- `evidence`: Module `//` header: two modes "deliberately distinct"; conservative is byte-exact lint-fix; escaping re-renders via `renderDoubleQuoted` / `renderSingleQuoted`; "nothing public imports it back, so the cycle firewall holds." `quoted-strings.ts` delegates with `"conservative"` only.
- `impact`: Using `"escaping"` in the lint fix would change shipped bytes. Using `"conservative"` on the format path would skip valid quote swaps. Importing public AST classes here would cycle the engine.
- `suggestedFix`: **Gotchas** on `RequoteMode` and `requoteScalarText`: mode semantics, skip when tag/anchor/non-string/multi-line (`\\n` or `\\r`), single-quoted cannot express controls so double→single returns `undefined`. Described `@see` to `quotedStrings` (conservative) and the format `requoteScalars` path (escaping). Mention type-only import of public AST (cycle firewall).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-019, yaml-internal-R1-032
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-042: diagnostics cycle firewall — raw records, facade materializes public classes

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/diagnostics.ts:1
- `symbol`: RawDiagnostic
- `kind`: type
- `evidence`: Module `//` header: engine never constructs public error/diagnostic classes; emits `{ code, message, offset, length }`; facade computes `line`/`character` from `offset`. "import arrow pointing facade → engine, never back (`noImportCycles` is error-level)." Same story in `raw-document.ts` and `options.ts`.
- `impact`: A well-meaning Example that `new YamlDiagnostic(...)` inside the engine, or that `RawDiagnostic` includes `line`, will not compile against the cycle firewall and will mis-teach the position model.
- `suggestedFix`: Module + `RawDiagnostic` Gotchas: offset-only positions; do not import `@beep`/facade diagnostic classes from this file. Described `@see` `{@link YamlDiagnostic}` for the public materialization. Examples must construct raw records, not public classes.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-012, yaml-internal-R1-017, yaml-internal-R1-018
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-043: FATAL_CODES union, hardening extras, CircularAlias never emitted

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/diagnostics.ts:118
- `symbol`: FATAL_CODES
- `kind`: value
- `evidence`: `FATAL_CODES` JSDoc: single source of truth replacing v3's three inline lists; comment lists hardening extras `UnexpectedCharacter` and `NestingDepthExceeded`. `CircularAlias` is in `YAML_COMPOSE_ERROR_CODES` but not in `FATAL_CODES`, and a repo-wide search finds no emitter outside the code table.
- `impact`: Callers treating the compose-code union as "these are all raised and fatal" will wait for `CircularAlias` or treat it as fatal. Fatality is a property of the code, declared once — recoverable warnings-as-data are the rest.
- `suggestedFix`: **Gotchas** on `FATAL_CODES` / `isFatalCode` / `YamlComposeErrorCode`: fatality ≠ "appears in a stage table"; `CircularAlias` is vocabulary-only today; `DuplicateAnchor` is fatal when present on the **error** list (see R1-040). Example: `isFatalCode("UnexpectedCharacter")` true, `isFatalCode("CircularReference")` false (stringify is a throw, not a parse fatal).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-012, yaml-internal-R1-040
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-044: YAML_MODIFY_ERROR_CODES — multi-doc and directive refusals

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/diagnostics.ts:68
- `symbol`: YAML_MODIFY_ERROR_CODES
- `kind`: value
- `evidence`: Existing lead already explains `MultiDocumentStream` (modify re-emits one document; would otherwise silently truncate) and `DirectiveCarryingDocument` (stringifier does not re-emit `%YAML`/`%TAG`; dropping them orphans shorthand tags). These codes are "Not raised by the parser/composer."
- `impact`: The lead is good but untagged and has no Example. A modify caller catching only parse codes will miss typed refusals.
- `suggestedFix`: Keep the lead (do not dilute it). Add `@category constants` `@since 0.0.0` and a titled Example listing the six codes. **Gotchas**: not a parse-stage set; `DirectiveCarryingDocument` is correctness, not taste.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-012
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-045: FlowComposers cycle firewall — block never imports flow

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/state.ts:136
- `symbol`: FlowComposers
- `kind`: type
- `evidence`: `FlowComposers` JSDoc: block recurses into flow via state so `block.ts` does not import `flow.ts` (which imports pair-building from `block.ts`). `flow.ts` `//` header: import stays flow → block. `document.ts` `//` header: only composer module that imports both; nothing in the engine imports it back. `tags.ts` `//` header: `parseDirective` lives here because `document.ts` already imports tags.
- `impact`: "Helpful" relative imports (`block` → `flow`, `document` → already both, `tags` → `document`) trip `noImportCycles` at error level. Docs that show `composeBlockMap` importing `composeFlowMap` teach a forbidden graph.
- `suggestedFix`: **Gotchas** on `FlowComposers`, `createState`, `composeFlowMap`, and `parseDirective`: dispatch is injected; do not import `flow.ts` from `block.ts`; do not import `document.ts` from tags. Examples construct state with the `FLOW` dispatch object, not a block→flow import.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-002, yaml-internal-R1-005, yaml-internal-R1-007, yaml-internal-R1-008
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-046: %TAG handles do not leak across documents (QLJ7)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/tags.ts:77
- `symbol`: validateTagHandlesInDocument
- `kind`: value
- `evidence`: Existing lead: `%TAG` is local to a single document and does not leak across `---`; `!!` and primary `!` are always available. `validateCrossDocumentDirectives` repeats this for docs index ≥ 1 and also requires `...` before directives between documents.
- `impact`: YAML authors copy a `%TAG` in document 1 and use `!e!` in document 2. Without a Gotcha on both functions the second document looks like a resolver bug.
- `suggestedFix`: **Gotchas** on `validateTagHandlesInDocument` and `validateCrossDocumentDirectives`. Example: doc1 `%TAG !e! ...` then `---\\n!e!foo: 1` → `UnresolvedTag`. Described `@see` between the two.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-004, yaml-internal-R1-008
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-047: nesting-depth budget 256 — composer, CST +8, stringify throw

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/state.ts:194
- `symbol`: MAX_NESTING_DEPTH
- `kind`: value
- `evidence`: `MAX_NESTING_DEPTH = 256` JSDoc: unbounded nesting is a stack-overflow DoS; ~900 levels overflow. `enterNesting` records a single `NestingDepthExceeded` and returns false (caller must return a leaf placeholder). CST `MAX_CST_DEPTH = 256 + 8` so the composer diagnostic always fires first. Stringifier throws `StringifyDepthExceeded` at the same cap (value path and hand-built AST path; parsed ASTs are already composer-bounded).
- `impact`: Three different failure shapes for one budget (composer diagnostic, CST error node, stringify throw). Docs that only mention "max depth 256" hide the CST slack and the stringify typed throw vs `RangeError`.
- `suggestedFix`: Cross-linked Gotchas on `MAX_NESTING_DEPTH`, `enterNesting`, `parseCSTAll`, `StringifyDepthExceeded`, `composeBlockMap`/`composeFlowMap`. Example: `enterNesting` false after 256; stringify of a 257-deep array throws `StringifyDepthExceeded`, not `RangeError`. `@throws` belongs on stringify entry points (R1-062).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-007, yaml-internal-R1-009, yaml-internal-R1-036, yaml-internal-R1-062
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-048: comment fidelity — reserved empty string, keep-chomp blanks, aliases

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/comments.ts:217
- `symbol`: rawCommentText
- `kind`: value
- `evidence`: `rawCommentText`: `""` encodes an embedded blank line, so spaces-only raw slices store with one extra trailing space (injective). `blankAboveIsKeepChompContent`: a blank inside a `|+` scalar span is VALUE; recording it as `spaceBefore` double-counts on every format pass. Clip/strip are NOT excluded. `deepestTrailingScalar` returns undefined for aliases ("carries no chomp"). Module header: comments live on nodes not pairs; absent-value trailing comments land on the KEY because `pair.value === null`.
- `impact`: Trimming comment text canonicalizes every comment. Treating keep-chomp blanks as style grows the document on format. Looking for comments on `YamlPair` or on an absent value node will miss them.
- `suggestedFix`: **Gotchas** on `rawCommentText`, `blankAboveIsKeepChompContent`, `withCommentFields`, `CommentFields`. Examples: `rawCommentText("#") === " "` and `rawCommentText("# ") === "  "`; keep-chomp blank is not `spaceBefore`. Details: node-level model, absent-value on the key.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-003
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-049: compose entry points do not filter fatal codes

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/document.ts:1101
- `symbol`: composeFirstDocument
- `kind`: value
- `evidence`: `composeFirstDocument` lead: "minus fatal-code filtering (the facade applies `isFatalCode`)". `composeAllDocuments` lead: `streamErrors` returned unfiltered; "v3 filtered these to `InvalidDirective` before failing — the facade applies that filter."
- `impact`: Calling the engine entry points directly and treating `errors.length > 0` as fatal (or as non-fatal) disagrees with the public parse API. Cross-document directive errors appear on the first document's `errors` for `composeFirstDocument`.
- `suggestedFix`: **Gotchas** on `composeFirstDocument`, `composeFirstDocumentCounted`, `composeAllDocuments`. Described `@see` `{@link isFatalCode}`. Example: compose invalid YAML, show raw diagnostics present, note the facade would drop non-fatals / fail on fatals.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-004, yaml-internal-R1-043
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-050: CST visitor sibling-first-key shape

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/cst-visitor.ts:550
- `symbol`: cstEvents
- `kind`: value
- `evidence`: Module `//` header: block-map nodes do NOT include their first key scalar; for `name: John` the document children are `flow-scalar("name")` then `block-map(": John")`. Visitor emits that sibling scalar as `CstKeyEvent`. Inside a block-map, the first non-trivia scalar is always a value.
- `impact`: A CST walker that looks only at `block-map` children misses the first key. That is the most surprising shape in the pack and is not on `CstKeyEvent` / `cstEvents`.
- `suggestedFix`: **Gotchas** on `cstEvents` and `CstKeyEvent` with the `name: John` sibling diagram. Example iterating `cstEvents("name: John\\n")` and asserting a `CstKeyEvent` whose `source` is `name`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-010
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-051: quoted-strings lint fix is conservative-only

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/quoted-strings.ts:48
- `symbol`: quotedStrings
- `kind`: value
- `evidence`: `safeQuoteFix` comment: delegates to conservative mode (#347); "escaping-capable mode belongs to the format path's opt-in `requoteScalars`, not the lint fix." Module header: keys out of scope; default `quoteType` double.
- `impact`: Diagnostics without a `fix` look like incomplete implementations; they are the conservative skip. Callers must not "upgrade" the lint fix to escaping.
- `suggestedFix`: **Gotchas** on `quotedStrings`: conservative skip is success; keys belong to `truthy`; `required: false` means only already-quoted scalars are policed. Described `@see` `{@link requoteScalarText}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-032, yaml-internal-R1-041
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-052: parse-validity does not own duplicate-key policy

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/parse-validity.ts:20
- `symbol`: parseValidity
- `kind`: value
- `evidence`: Inline comment on `parseValidity.check`: engine errors → lint errors, warnings → warnings; "Duplicate keys never reach this bridge: the lint context composes with uniqueKeys disabled because duplicate-key POLICY belongs to the configurable `key-duplicates` rule." Module header: cannot be demoted or disabled.
- `impact`: Enabling parse-validity and expecting yamllint-style duplicate-key errors here will silently miss them. Disabling `key-duplicates` then means duplicates are allowed.
- `suggestedFix`: **Gotchas** on `parseValidity` and `keyDuplicates`. Described `@see` both ways. Example: duplicate `a:` does not appear under `parse-validity` when the lint compose used `uniqueKeys: false`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-029, yaml-internal-R1-031
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-053: colon/hyphen maxSpacesAfter clamped to ≥ 1

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/colon-spacing.ts:38
- `symbol`: colonSpacing
- `kind`: value
- `evidence`: `colonSpacing` / `hyphenSpacing`: `Math.max(1, opts.maxSpacesAfter ?? 1)` "so a hand-built options object cannot bypass the schema and delete the separation space." `positiveIntegerOption` JSDoc: `0` would emit `-item` / `a:val` — different tokens, not a spacing change.
- `impact`: A test passing `{ maxSpacesAfter: 0 }` as a raw object will not get a zero-space fix; it looks like the rule ignored options.
- `suggestedFix`: **Gotchas** on `colonSpacing`, `hyphenSpacing`, `positiveIntegerOption`. Example: schema decode of `0` fails; a hand-built `0` is still clamped at runtime.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-021, yaml-internal-R1-027, yaml-internal-R1-035
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-054: computeEdits assumes shared AST skeleton and LF

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/diff.ts:27
- `symbol`: computeEdits
- `kind`: value
- `evidence`: Lead: "relies on the assumption that both strings share an identical structural skeleton (they were produced from the same AST); a simple prefix/suffix match is sufficient and a full Myers diff is unnecessary." Body comment: `+1` for `\\n` only; "correct because computeEdits operates on text produced by the stringifier which always uses LF endings."
- `impact`: Diffing CRLF originals against LF stringifier output, or unrelated strings, yields a single coarse middle edit and wrong offsets if CR is present.
- `suggestedFix`: **Gotchas** on `computeEdits`: not a general diff; LF-only; empty when prefix+suffix cover both strings. Example of a one-line value change vs two totally different strings collapsing to one edit.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-013
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-055: deepEqual treats NaN as equal and ignores object key order

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/equal.ts:15
- `symbol`: deepEqual
- `kind`: value
- `evidence`: Existing lead already states NaN equals NaN (unlike `===`) because YAML `.nan` from two documents should match, and object key order is insignificant while array order is significant.
- `impact`: Lead is correct but untagged and has no Example. A caller using `Object.is` or `===` for the facade `equals` path will fail `.nan` fixtures.
- `suggestedFix`: Keep the lead. Add `@category predicates` `@since 0.0.0` and a titled Example covering NaN, `{b:1,a:2}` vs `{a:2,b:1}`, and `[1,2]` vs `[2,1]`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-014
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-056: getNodeValue __proto__ keys are own data properties

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/anchors.ts:154
- `symbol`: getNodeValue
- `kind`: value
- `evidence`: Lead: delegates to `YamlNode.toValue`, "resolves aliases through the optional anchor map with incremental registration and handles `__proto__` keys as own data properties."
- `impact`: Prototype-pollution mental model is inverted here: `__proto__` is data, not a setter. Without a Gotcha+Example, a security-minded caller may "sanitize" by dropping the key.
- `suggestedFix`: **Gotchas** plus Example: mapping key `__proto__` round-trips as an own property on the plain object, not as `Object.prototype` mutation. Described `@see` `{@link YamlNode.toValue}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-001
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-057: YamlScanner.setPosition must be a token offset

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/lexer.ts:20
- `symbol`: YamlScanner
- `kind`: type
- `evidence`: `setPosition` JSDoc: "All block-structure state (indentation, flow depth, pending tokens) is reset. For reliable results, pass an offset previously returned by `getTokenOffset` rather than an arbitrary mid-token position."
- `impact`: Seeking to `indexOf(":")` mid-token desynchronizes indent/flow state. The warning is on the method but the type lacks `@category`/`@since` and `createScanner` does not repeat it.
- `suggestedFix`: **Gotchas** on `YamlScanner` and `createScanner`. Example: scan, remember `getTokenOffset()`, `setPosition` back, rescan the same kind. Do not seek to a colon inside a scalar.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-016
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-058: document-start/end are stream-head/tail style, not mid-stream structure

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/document-start.ts:31
- `symbol`: documentStart
- `kind`: value
- `evidence`: `document-start` `//` header: scope is STREAM HEAD only; mid-stream `---` is structure — removing one would merge documents. Directives REQUIRE `---`. Opt-in, absent from both presets. `document-end` `//` header: tail-of-stream only; mid-stream `...` is structure.
- `impact`: Applying these rules as "every document marker must match `present`" will flag or "fix" separators in multi-document streams and merge documents.
- `suggestedFix`: **Gotchas** on `documentStart` and `documentEnd` (and their options). Example: a two-document stream with internal `---` is not a document-start violation when the head already has `---`. Mention directives force present `---`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-023, yaml-internal-R1-024
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-059: catalog pairing makes a schema-less built-in unrepresentable

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/catalog.ts:48
- `symbol`: builtinRules
- `kind`: value
- `evidence`: `//` comment: "ONE ordered source of rule/options-schema pairs: deriving both exports from it makes a schema-less built-in unrepresentable — a rule registered in one list only would otherwise validate as a CUSTOM rule with opaque options."
- `impact`: Adding a rule to `builtinRules` by hand without the paired schema would silently accept any options. Docs that present the two exports as independent lists teach that footgun.
- `suggestedFix`: **Gotchas** on `builtinRules` and `builtinOptionsSchemas`: always derive from the same `catalog` tuple array; parse-validity is index 0 / rule `#1`; indentation is last by design. Example: every `builtinRules` id is a key of `builtinOptionsSchemas`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-020
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-060: layout rules must not edit scalar content (insideScalarSpan)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/rules/util.ts:96
- `symbol`: insideScalarSpan
- `kind`: value
- `evidence`: `insideScalarSpan` JSDoc: trailing whitespace or blank lines inside a block scalar are part of the parsed value; editing them under a layout banner is corrupting. `trailing-spaces` `//` header: recorded divergence from yamllint. `isScalarContinuationLine`: indentation rule skips those lines.
- `impact`: Porting yamllint tests that flag trailing spaces inside `|` scalars will look like rule bugs.
- `suggestedFix`: **Gotchas** on `insideScalarSpan`, `trailingSpaces`, `emptyLines`, `isScalarContinuationLine`. Example: a `|` scalar line ending in spaces is not a `trailing-spaces` hit.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-025, yaml-internal-R1-033, yaml-internal-R1-035
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-061: getLineStarts is a process-global single-entry memo

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/composer/state.ts:22
- `symbol`: getLineStarts
- `kind`: value
- `evidence`: Comment above the cache: "Single-entry memo keyed on the text reference" — rebuilt only when a different text arrives (issue #108). Composition is sync; the cache is module-level `let`.
- `impact`: Interleaved composition of two different strings (if composition ever became concurrent) would clobber the index. Even today, the function is not a pure `text → starts` helper — identity of the string matters.
- `suggestedFix`: **Gotchas** on `getLineStarts` / `lineCol`: memo is process-global and keyed by reference equality, not contents. Example: two `lineCol` calls on the same string reuse the index. Do not document it as a pure function.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-007
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-062: stringifyValue / stringifyDocument throw synchronously

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/stringifier.ts:1878
- `symbol`: stringifyValue
- `kind`: value
- `evidence`: `stringifyValue` lead: circular references throw `StringifyFailure`. Depth guard throws `StringifyDepthExceeded` (typed internal error the facade materializes as `NestingDepthExceeded`). Law: `@throws` only for synchronous throws outside the typed Effect channel — these are exactly that. `YAML_STRINGIFY_ERROR_CODES` is `["CircularReference"]` only; nesting uses a different public diagnostic after the facade catches `StringifyDepthExceeded`.
- `impact`: Without `@throws`, the signature looks total. Nesting depth is not in `YAML_STRINGIFY_ERROR_CODES`, so a code-table reader will miss it.
- `suggestedFix`: Add `@throws` (no hyphen, no `{Type}`) on `stringifyValue` and `stringifyDocument` for circular references and nesting overflow. **Gotchas**: facade maps `StringifyFailure` → `CircularReference` and `StringifyDepthExceeded` → `NestingDepthExceeded`; parsed ASTs never trip the node-path depth guard, hand-built trees can. Example: `try/catch` around a self-referential object.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-036, yaml-internal-R1-047
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-063: exported lint option schemas lack `$I.annoteSchema` and same-name type aliases

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: yaml/internal/rules/util.ts:15
- `symbol`: nonNegativeIntegerOption
- `kind`: value
- `evidence`: Every exported `Schema.Struct` / `Schema.Number.check` in `rules/*.ts` (`colonSpacingOptions`, `indentationOptions`, `parseValidityOptions`, `nonNegativeIntegerOption`, `positiveIntegerOption`, …) has no `$I.annoteSchema` and no same-name `export type X = typeof X.Type`. Grep of `scratchpad/yaml` finds zero `$I` identity composers.
- `impact`: Annotation-patterns law requires identity annotations on exported schemas. This scratchpad tree currently has no package `$I`, so a fixer cannot pipe `$I.annoteSchema` without first creating identity — do not invent a fake `$I`.
- `suggestedFix`: When (and only when) yaml scratchpad gains a package identity composer, annotate each exported schema with `$I.annoteSchema` and add a prose-only same-name type alias (`@category type-level`). Until then, still write JSDoc leads/`@category schemas`/`@since`/Examples; do not block the mechanical pass on `$I`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R1-064: diagnostics stage type aliases restate the name

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: yaml/internal/diagnostics.ts:78
- `symbol`: YamlLexErrorCode
- `kind`: type
- `evidence`: Leads are signature echoes: "The lexer-stage error-code union." (same pattern for parse/compose/stringify/modify/all). Law: lead explains purpose, does not restate the name.
- `impact`: Hover text adds nothing beyond the type name; the real story (stage tables, fatality, unused `CircularAlias`) lives elsewhere.
- `suggestedFix`: Rewrite each alias lead to point at its array and role (`YamlLexErrorCode` is the closed set of codes the lexer may emit; not all are fatal — see `{@link FATAL_CODES}` / `{@link isFatalCode}`). No Example required.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R1-012, yaml-internal-R1-043
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives

- Census `missingTags: @example` on value exports is **not** a request to author `@example` tags. Confirmed as missing titled `**Example** (Title)` sections. Adding `@example` would fail `jsdoc-ratchet`.
- Pure type-level exports (`CstNode`, `YamlToken`, event interfaces, option input types, `ScalarRole`, …) are correctly **not** flagged for Example. Do not add placeholder Examples.
- `yaml/internal/rules/indentation.ts` module header already has a useful lead, `@packageDocumentation`, and `@since 0.0.0`. Not an open-module miss. Export-level tags/Examples remain open (R1-028).
- No barrel `re-export` documentation subjects in this pack (`re-exports: 0`).
- JSDoc that already lives on `export const` (rule options, `FATAL_CODES`, compose entry points with leads) is still missing `@category`/`@since`/Example — not a "docs on the wrong node" false positive.
- Extra Examples beyond one titled observable Example, empty **When to use** / **Details**, and taste-only wording churn were not opened.

---

## Pack verdict

- files reviewed: 37
- owning exports reviewed: 183
- confirmed mechanical items: 37
- editorial items: 27
- rejected false positives: 6
- accepted findings: 64
