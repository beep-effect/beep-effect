# Pack schemastore — round 1 inventory

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `slice`: `scratchpad/schemastore/` (14 modules, 47 owning, 12 re-exports)
- `census`: 13 open modules, 47 open owning; barrel `schemastore/index.ts` is skipped by census module findings because `owningExportCount === 0`

Kit-port prose is already strong (leads explain publication shape, lowering, and gates). The beep JSDoc/schema identity layer is almost entirely absent: every owning export lacks `@category` / `@since`, every value export lacks a titled `**Example** (Title)` (four classes still carry retired `@example`), every `Schema.Class` / `Schema.TaggedError` / branded `SchemaVersion` lacks `$I.annote` / `$I.annoteSchema`, and surviving examples import `@effected/schemastore` plus named `Schema` from `effect`.

Do not rewrite good leads. Do not document barrel re-exports. Do not add empty When-to-use / Details. Convert existing `@example` blocks; do not stack extra Examples on those symbols.

Example imports must be `from "@beep/scratchpad/schemastore"` (see `scratchpad/docgen.json`). Schema examples use `import * as S from "effect/Schema"`. Identity composer: `import { $ScratchpadId } from "@beep/identity"` then `const $I = $ScratchpadId.create("schemastore/<File>")`.

---

### schemastore-R1-001: AnnotationCarriers module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/AnnotationCarriers.ts:1
- `symbol`: AnnotationCarriers.ts module, CarrierDepthExceededError, AnnotationCarriers
- `kind`: module
- `evidence`: Census confirmed. File starts with imports (no fileoverview). `CarrierDepthExceededError` (value/class:14) and `AnnotationCarriers` (value/class:173) have useful leads and `@public` but missing `@category`, `@since`, titled Example. No `@remarks`/`@module`/`@template`.
- `impact`: Ratchet treats the module as undocumented; callers get no compilable Example of the re-graft walk or the depth error.
- `suggestedFix`: Add a module block (lead on why Draft-07 lowering drops language-server keywords, then `@packageDocumentation` `@since 0.0.0`). On `CarrierDepthExceededError` add `@category errors`, `@since 0.0.0`, and an Example that `make`s the error or fails `carryResult` on a cyclic pair. On `AnnotationCarriers` add `@category combinators`, `@since 0.0.0`, and one titled Example grafting `x-taplo` from a 2020-12 node onto a lowered Draft-07 node, asserting the key is present. Keep existing `@public` before `@category`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-002: AnnotationCarriers schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/AnnotationCarriers.ts:14
- `symbol`: CarrierDepthExceededError
- `kind`: value
- `evidence`: `extends Schema.TaggedError<CarrierDepthExceededError>()("CarrierDepthExceededError", { path, maxDepth })` with no `$I` composer, no `$I\`CarrierDepthExceededError\``, no third-argument `$I.annote`. Class `AnnotationCarriers` is not a schema.
- `impact`: The tagged error has no namespaced schema identity or annotation description for JSON Schema / OpenAPI emission.
- `suggestedFix`: `const $I = $ScratchpadId.create("schemastore/AnnotationCarriers")`. Prefer `Schema.TaggedError<CarrierDepthExceededError>($I\`CarrierDepthExceededError\`)("CarrierDepthExceededError", fields, $I.annote("CarrierDepthExceededError", { description: "..." }))`. Do not change fields or throw behavior.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-003: AnnotationCarriers Gotchas and sibling @see

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/AnnotationCarriers.ts:140
- `symbol`: AnnotationCarriers
- `kind`: value
- `evidence`: Class lead already states the usage-site / identifier-hoist boundary. Implementation comments add facts that never become Gotchas or described `@see`: the walk maps 2020-12 `prefixItems` → Draft-07 `items` and trailing `items` → `additionalItems`; positions the lowering drops are never visited; depth cap is `MAX_NESTING_DEPTH` (256) and also intercepts cycles; only `KeywordFamilies.isDeclared` keys are copied. No `@see` to `KeywordFamilies`, `StoreDocument.fromSchema`, or `MAX_NESTING_DEPTH`.
- `impact`: Callers driving core's pipeline themselves will graft the wrong coordinate or expect usage-site `.annotate` to survive.
- `suggestedFix`: Add a **Gotchas** section on `AnnotationCarriers` with the prefixItems/items mapping, dropped-position rule, and 256-depth/cycle failure. Described `@see` to `{@link KeywordFamilies.isDeclared}` (admission predicate), `{@link StoreDocument.fromSchema}` (automatic apply), `{@link CarrierDepthExceededError}` (typed depth failure). `@throws` is not needed on `carry` (typed channel); mention `carryResult` as the sync dual in Details, not a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-001
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-004: CanonicalJson module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/CanonicalJson.ts:1
- `symbol`: CanonicalJson.ts module; NonJsonValueError; JsonDepthExceededError; CanonicalJsonError; CanonicalJsonOptions; CanonicalJson
- `kind`: module
- `evidence`: Census confirmed missing-module-summary, missing-packageDocumentation, missing-module-since. Owning: `NonJsonValueError` (value/class:16) missing `@category` `@since` titled Example; `JsonDepthExceededError` (value/class:36) same; `CanonicalJsonError` (type:52) missing `@category` `@since` (Example optional); `CanonicalJsonOptions` (interface:59) missing `@category` `@since`; `CanonicalJson` (value/class:101) missing `@category` `@since` titled Example. Leads are useful; no legacy carriers.
- `impact`: The owned serializer is the write-stability contract for every emitted schema file and currently has no compilable Example.
- `suggestedFix`: Module lead: deterministic JSON for committed SchemaStore files (insertion-order keys, LF, trailing newline). Tags `@packageDocumentation` `@since 0.0.0`. Categories: errors, errors, type-level, configuration, encoding. Value Examples: serialize `{b:1,a:2}` and show key order preserved plus trailing `\\n`; construct `NonJsonValueError` / show `serializeResult` failing on `undefined` or a cycle (`JsonDepthExceededError`). Type-level: prose + described `@see` to `CanonicalJson.serialize` only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-005: CanonicalJson schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/CanonicalJson.ts:16
- `symbol`: NonJsonValueError, JsonDepthExceededError
- `kind`: value
- `evidence`: Both `Schema.TaggedError<X>()("X", fields)` with no `$I.annote` third argument and no `$I\`Name\``.
- `impact`: Error schemas are anonymous to the identity composer used everywhere else in scratchpad.
- `suggestedFix`: File-local `$I = $ScratchpadId.create("schemastore/CanonicalJson")` and `$I.annote` on both TaggedErrors. Do not wrap `CanonicalJsonError` (type union, not a schema).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-006: CanonicalJson indent throw, stringify divergence, dual

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/CanonicalJson.ts:59
- `symbol`: CanonicalJsonOptions, CanonicalJson
- `kind`: value
- `evidence`: Field comment and `indentUnit` (lines 132–141) warn that a negative or fractional `indent` throws a bare `Error` (wiring mistake, not `CanonicalJsonError`). Counts above 10 are honored, unlike `JSON.stringify`'s silent clamp. Keys are never sorted. `undefined` / `NaN` / `Infinity` / bigint / function / non-plain object fail typed instead of being rewritten. No `@throws` on `serialize`/`serializeResult`. No described `@see` between `serialize` and `serializeResult`, or to `StoreDocument.serializeResult`.
- `impact`: Callers catching only `CanonicalJsonError` will miss option-validation throws; callers expecting `JSON.stringify` rewrite rules will corrupt documents or think the serializer is broken.
- `suggestedFix`: **Gotchas** on `CanonicalJson` covering indent throws, no clamp-to-10, insertion-order keys, and typed refusal of non-JSON. `@throws` on the class or `serializeResult` for the indent wiring throw. Described `@see` `{@link StoreDocument.serializeResult}` (same engine) and `{@link NonJsonValueError}` / `{@link JsonDepthExceededError}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-004
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-007: CatalogEntry module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/CatalogEntry.ts:1
- `symbol`: CatalogEntry.ts module; CatalogLintFinding; CatalogEntry
- `kind`: module
- `evidence`: Census confirmed module header misses. `CatalogLintFinding` (value/class:12) and `CatalogEntry` (value/class:90) missing `@category` `@since` titled Example. Leads useful; no legacy carriers.
- `impact`: Catalog assembly is the SchemaStore submission shape and has no Example showing versioned vs unversioned `assemble` or `lint`.
- `suggestedFix`: Module lead on `catalog.json` entry as the class schema. `@packageDocumentation` `@since 0.0.0`. Categories: models, models. Example on `CatalogEntry`: `assemble` unversioned, then `lint()` on `["*.json"]` showing a `GenericFileMatch`. Example on `CatalogLintFinding`: `CatalogLintFinding.make({...})` or rely on the entry Example if the finding class Example constructs one finding and logs `check`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-008: CatalogEntry schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/CatalogEntry.ts:12
- `symbol`: CatalogLintFinding, CatalogEntry
- `kind`: value
- `evidence`: `Schema.Class<CatalogLintFinding>("CatalogLintFinding")({...})` and `Schema.Class<CatalogEntry>("CatalogEntry")({...})` use a bare identifier and omit the `$I.annote` third argument. No file-local `$I`.
- `impact`: Both class schemas lack namespaced identity and annotation descriptions required of exported schemas.
- `suggestedFix`: `$I = $ScratchpadId.create("schemastore/CatalogEntry")`. Switch both to `Schema.Class<X>($I\`X\`)({ fields }, $I.annote("X", { description: "..." }))`. Keep fields and methods unchanged.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-009: CatalogEntry lint-is-not-an-error and versions order

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/CatalogEntry.ts:90
- `symbol`: CatalogEntry, CatalogLintFinding
- `kind`: value
- `evidence`: Finding lead says a warned entry is still valid, but the class has no **Gotchas**. `versions` field comment: inserted ascending but key order is not a contract — derive ordering from labels via `SchemaVersioning`. `lint` is pure glob-shape analysis, not a glob engine. No described `@see` to `SchemaVersioning.catalogUrls` (assemble delegates there) or `CatalogLintFinding`.
- `impact`: Callers may treat `lint()` as a typed error channel or trust `Object.keys(versions)` as SemVer order after JSON round-trip.
- `suggestedFix`: **Gotchas** on `CatalogEntry`: findings are values not errors; `versions` key order is not a contract. Described `@see` `{@link SchemaVersioning.catalogUrls}` and `{@link CatalogLintFinding}`. On `CatalogLintFinding`, `@see` `{@link CatalogEntry.lint}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-007
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-010: DocumentDiff module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/DocumentDiff.ts:1
- `symbol`: DocumentDiff.ts module; SchemaChange; DocumentDiff
- `kind`: module
- `evidence`: Census confirmed module header misses (file opens with `//` not `/**`). `SchemaChange` (type:29) missing `@category` `@since`. `DocumentDiff` (value/class:272) missing `@category` `@since` plus `legacy-example` (`@example` at 256). Lead is useful. Census correctly omits `@example` from missingTags because the legacy carrier is present.
- `impact`: Zero-legacy ratchet fails on `@example`; classification API has no titled Example and no module identity.
- `suggestedFix`: Module `@packageDocumentation` `@since 0.0.0` lead: classify annotation vs contract change for versioning. `SchemaChange` `@category type-level` `@since 0.0.0` with described `@see` to `DocumentDiff.classify`. Convert the existing class `@example` to `**Example** (Classify annotation vs contract)` — keep the two `console.log` outcomes; change import to `@beep/scratchpad/schemastore`. Add `@category utilities` `@since 0.0.0`. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-011: DocumentDiff annotation-keyword Gotchas and @effected import

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/DocumentDiff.ts:256
- `symbol`: DocumentDiff
- `kind`: value
- `evidence`: Example imports `from "@effected/schemastore"` (docgen path is `@beep/scratchpad/schemastore`). Implementation comments (31–40, 64–75, 122–125, 287–292) never become Gotchas: `default`/`examples`/`readOnly`/`writeOnly` are deliberately NOT documentation keywords; past `MAX_NESTING_DEPTH` unequal subtrees report `"contract"`; object key order is ignored, array order is data; `isClean("created")` is false. No described `@see` to `SchemaVersioning` or `KeywordFamilies`.
- `impact`: Misclassifying a `default` change as annotations ships a silent breaking change — the comment already says so. `@effected/*` examples fail the scratchpad docgen compiler.
- `suggestedFix`: Rewrite the Example import. Add **Gotchas** for the excluded Draft-07 annotation keywords, depth-cap conservative `"contract"`, key-order vs array-order, and `"created"` not clean. Described `@see` `{@link DocumentDiff.isAnnotationKeyword}`, `{@link KeywordFamilies}`, `{@link SchemaVersioning}` (when `"contract"` warrants a new version).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-010
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-012: DocumentLint module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/DocumentLint.ts:1
- `symbol`: DocumentLint.ts module; DocumentLintFinding; DocumentLint
- `kind`: module
- `evidence`: Census confirmed module header misses. `DocumentLintFinding` (value/class:13) and `DocumentLint` (value/class:227) missing `@category` `@since` titled Example. Leads useful; no legacy carriers.
- `impact`: Owned lint (the engine-free half of validation) has no Example showing a finding list.
- `suggestedFix`: Module lead: structural/hygiene checks over `StoreDocument`. Categories models + diagnostics. Example: build `StoreDocument.draft07` whose root description has no docs URL, `DocumentLint.lint(doc)`, log `findings.map((f) => f.check)` including `DescriptionWithoutUrl`. Finding class Example may `make` one warning. `@since 0.0.0` everywhere.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-013: DocumentLint schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/DocumentLint.ts:13
- `symbol`: DocumentLintFinding
- `kind`: value
- `evidence`: `Schema.Class<DocumentLintFinding>("DocumentLintFinding")({...})` — bare identifier, no `$I.annote`. `DocumentLint` is a static utility, not a schema.
- `impact`: Finding schema has no identity annotation.
- `suggestedFix`: `$I = $ScratchpadId.create("schemastore/DocumentLint")` and `$I.annote` on the class schema.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-014: DocumentLint findings-are-values and sibling validator

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/DocumentLint.ts:208
- `symbol`: DocumentLint
- `kind`: value
- `evidence`: Lead lists checks but does not Gotcha: findings are never an error channel; hostile nesting becomes `DepthExceeded` rather than a throw; a surviving `#/definitions/...` `$ref` is `UnresolvedRef` because the publication pool is `$defs`; boolean schemas are legal leaves; `DescriptionWithoutUrl` is advisory. No described `@see` to `SchemaValidator` (engine half), `KeywordFamilies`, `StoreDocument`, `MAX_NESTING_DEPTH`.
- `impact`: Callers looking for a typed lint error, or expecting `#/definitions` refs to resolve, will misread a clean-looking document.
- `suggestedFix`: **Gotchas** covering those five facts. Described `@see` `{@link SchemaValidator}` (real-engine gate), `{@link KeywordFamilies.isDeclared}`, `{@link StoreDocument}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-012
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-015: KeywordFamilies module tags and class Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/KeywordFamilies.ts:1
- `symbol`: KeywordFamilies.ts module; KeywordFamilies
- `kind`: module
- `evidence`: Census confirmed leftover: has useful fileoverview lead, missing `@packageDocumentation` and `@since`. `KeywordFamilies` (value/class:40) missing `@category` `@since` titled Example. Not a schema.
- `impact`: The one admission predicate for lint and carriers is undocumented at the tag/Example layer, so those two consumers can be documented without a shared Example of `isDeclared`.
- `suggestedFix`: Keep the existing module lead; append `@packageDocumentation` `@since 0.0.0`. Class `@category predicates` `@since 0.0.0`. Example: `KeywordFamilies.isDeclared("x-taplo")` / `"markdownDescription"` true, `"x-custom"` false, observable `console.log`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-016: KeywordFamilies x-taplo prefix asymmetry

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/KeywordFamilies.ts:40
- `symbol`: KeywordFamilies
- `kind`: value
- `evidence`: `isDeclared` uses `key.startsWith("x-taplo")` but `x-tombi-` and `x-intellij-` require the hyphen. Exact vscode names are a closed set. Module prose lists families but the class has no Gotcha and no described `@see` to both consumers (`DocumentLint` UnknownKeyword, `AnnotationCarriers` re-graft).
- `impact`: A key `x-taplofoo` is admitted; `x-tombifoo` is not. Callers adding a new family in only one consumer will drift — the module lead already says one predicate exists so they cannot.
- `suggestedFix`: **Gotchas** on the class: taplo matches `x-taplo` and any `x-taplo*` continuation; tombi/intellij require the hyphenated prefix; vscode is exact names only. Described `@see` `{@link DocumentLint}` and `{@link AnnotationCarriers}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-015
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-017: SchemaFile module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaFile.ts:1
- `symbol`: SchemaFile.ts module; SchemaFileReadError; SchemaFileNotFoundError; SchemaFileWriteError; WriteOutcome; WriteChange; WriteResult; CheckResult; SchemaWriteOptions; SchemaFileShape; SchemaFile
- `kind`: module
- `evidence`: Census confirmed module header misses (opens with `//`). Value errors at 21/38/54 missing `@category` `@since` titled Example. Types `WriteOutcome` (72), `WriteChange` (81), `WriteResult` (97), `CheckResult` (119), `SchemaWriteOptions` (134), `SchemaFileShape` (160) missing `@category` `@since` only. `SchemaFile` (value/class:236) missing `@category` `@since` plus `legacy-example` at 216. Leads useful.
- `impact`: The package's only IO surface is the drift/write contract; missing tags plus retired `@example` fail both ratchets.
- `suggestedFix`: Module lead from the existing `//` comment (core FileSystem/Path, write-if-changed). `@packageDocumentation` `@since 0.0.0`. Categories: errors ×3, type-level ×5, configuration (`SchemaWriteOptions`), services (`SchemaFile`). Convert class `@example` to titled Example (see R1-019 for quality). Error classes each need an Example of `make` or `catchTag`. Types: prose + described `@see` to `SchemaFileShape.write` / `check`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-018: SchemaFile schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/SchemaFile.ts:21
- `symbol`: SchemaFileReadError, SchemaFileNotFoundError, SchemaFileWriteError
- `kind`: value
- `evidence`: Three `Schema.TaggedError<X>()("X", fields)` with no `$I.annote`. Cause-carrying two use `cause: Schema.Defect()` (see pack-level R1-036). `SchemaFile` is a `Context.Service`, not a class schema.
- `impact`: IO errors are unannotated tagged schemas.
- `suggestedFix`: `$I = $ScratchpadId.create("schemastore/SchemaFile")` and `$I.annote` on all three TaggedErrors. Do not change `cause` encoding in this pass.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-019: SchemaFile vacuous @effected Example and write/check Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaFile.ts:216
- `symbol`: SchemaFile
- `kind`: value
- `evidence`: `@example` imports `@effected/schemastore` and `Schema` named from `effect`; binds `program` and never runs or logs it (vacuous). Implementation comments: no `exists` pre-check (TOCTOU would mis-tag NotFound); `compare: "bytes"` can `outcome: "written"` with `change: "none"`; unparsable on-disk JSON classifies as `"contract"` so write can repair; `SchemaFileWriteError` never wraps `CanonicalJsonError`. `WriteResult` already documents outcome vs change; the class Example does not show it.
- `impact`: Docgen cannot compile `@effected/*`; a void program teaches nothing about write-if-changed. Callers inferring "did we write?" from `change` will lie under `compare: "bytes"`.
- `suggestedFix`: Convert to `**Example** (Write if content changed)` importing `@beep/scratchpad/schemastore`, `import * as S from "effect/Schema"`, provide layers, `Effect.runPromise` (or `runSync` if the test FS allows) and log `outcome`/`change`. If a real FS Example is too environment-heavy for doctest, keep it type-compiling and observable via a commented expected `WriteResult` shape — still run or `console.log` the effect program's type-level result only if execution needs Node; otherwise construct `WriteResult` literals in a second? No: do not add extra Examples. Prefer an in-memory-looking call that still compiles: yield `files.check` is IO too. Minimal observable fix: keep the gen, end with `return yield* files.write(...)` and `console.log(Effect.runSync(program))` is wrong for async FS. Use `Effect.runPromise` and `console.log`. **Gotchas** on the class: outcome vs change; bytes vs value; parse-fail → `"contract"`; NotFound vs ReadError routing. Described `@see` `{@link DocumentDiff.classify}`, `{@link SchemaFileShape.check}`, `{@link CanonicalJson}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-017
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-020: SchemaPipeline module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaPipeline.ts:1
- `symbol`: SchemaPipeline.ts module; PipelineFinding; SchemaGateError; PipelineResult; PipelineCheckResult; SchemaPipelineOptions; SchemaPipeline
- `kind`: module
- `evidence`: Census confirmed module header misses (opens with `//`). `PipelineFinding` (value/class:36) and `SchemaGateError` (value/class:68) missing `@category` `@since` titled Example. Interfaces 84/107/131 missing `@category` `@since`. `SchemaPipeline` (value/class:238) missing `@category` `@since` plus `legacy-example` at 216.
- `impact`: The emit/gate loop every consumer was writing by hand has no titled Example and a retired carrier.
- `suggestedFix`: Module lead from the existing `//` (orchestration only; no new JSON Schema capability). Categories: models, errors, type-level ×3, workflows. Convert class `@example` (quality in R1-022). Finding/error Examples: `PipelineFinding.make` + `SchemaGateError.make`. Types: prose + `@see` to `run`/`check`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-021: SchemaPipeline schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/SchemaPipeline.ts:36
- `symbol`: PipelineFinding, SchemaGateError
- `kind`: value
- `evidence`: `Schema.Class<PipelineFinding>("PipelineFinding")` and `Schema.TaggedError<SchemaGateError>()("SchemaGateError", ...)` without `$I.annote`.
- `impact`: Pipeline report/error schemas lack identity annotations.
- `suggestedFix`: `$I = $ScratchpadId.create("schemastore/SchemaPipeline")`; `$I.annote` on both. Keep `label` getter.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-022: SchemaPipeline vacuous @effected Example; run vs check

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaPipeline.ts:216
- `symbol`: SchemaPipeline
- `kind`: value
- `evidence`: `@example` imports `@effected/schemastore` and named `Schema` from `effect`; binds `program` with no run/log (vacuous). Method comments: `run` stops at the first `SchemaGateError` and does not write that target or later ones; `check` is total over targets and reports `blocked` instead of failing. `SchemaPipelineOptions` already documents that `UnknownKeyword` is effectively unreachable on `StoreDocument.fromSchema` output and the engine gate is what blocks in practice — that fact is not on the class. No described `@see` `run` ↔ `check`.
- `impact`: Callers copy a non-running Example; CI jobs using `run` instead of `check` stop after one broken target; callers looking for lint `UnknownKeyword` on pipeline output will never see it.
- `suggestedFix`: Convert to titled Example importing `@beep/scratchpad/schemastore` and `import * as S from "effect/Schema"`. Make it observable: at least `console.log` a `check`/`checkOne` result, or document `runOne` with provided layers. Prefer `checkOne` if writes are unwanted in docs. **Gotchas** on the class: `run` short-circuits; `check` is total; engine gate is the practical blocker for generated documents. Described `@see` `{@link SchemaPipeline.check}`, `{@link SchemaGateError}`, `{@link SchemaTarget}`, `{@link SchemaValidator}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-020
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-023: SchemaTarget module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaTarget.ts:1
- `symbol`: SchemaTarget.ts module; SchemaTarget (interface); SchemaTarget (class)
- `kind`: module
- `evidence`: Census confirmed module header misses. Interface `SchemaTarget` (type:15) missing `@category` `@since` (Example optional). Class `SchemaTarget` (value:42) missing `@category` `@since` titled Example. Declaration merging is intentional (`noUnsafeDeclarationMerging` comment). Not schemas.
- `impact`: The publication-target constructor — required `name` when `version` is set — has no Example, so callers will pass version without name and hit the runtime throw.
- `suggestedFix`: Module lead: one Effect Schema plus `$id`/`path` publication wiring. Interface `@category type-level`. Class `@category constructors` with Example of unversioned `make` and versioned `make` (name required). `@since 0.0.0`. Do not document the merge as two APIs; one Example on the class is enough.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-024: SchemaTarget restating class lead, sync throws

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaTarget.ts:36
- `symbol`: SchemaTarget
- `kind`: value
- `evidence`: Class lead is "Constructors for `SchemaTarget` values." — name/signature echo. Implementation throws `Error` for empty `$id`/`path`, empty `name` when given, and `version` without `name` (overload is untyped-callers' runtime check). No `@throws`. No described `@see` to `SchemaPipeline` or `SchemaVersion`.
- `impact`: Empty-string wiring mistakes throw outside any tagged channel; the class hover does not say so.
- `suggestedFix`: Rewrite class lead to "Builds a publication target, making versioned catalog naming (`name` required with `version`) unrepresentable in the typed overloads." **Gotchas** + `@throws` for the three empty/missing-name cases. Described `@see` `{@link SchemaPipeline.run}` and `{@link SchemaVersion}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-023
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-025: SchemaValidator module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaValidator.ts:1
- `symbol`: SchemaValidator.ts module; SchemaValidatorError; ValidationFinding; SchemaValidatorOptions; SchemaValidatorShape; SchemaValidator
- `kind`: module
- `evidence`: Census confirmed module header misses. `SchemaValidatorError` (value/class:18) and `ValidationFinding` (value/class:34) missing `@category` `@since` titled Example. Interfaces 48/63 missing `@category` `@since`. `SchemaValidator` (value/class:152) missing `@category` `@since` plus `legacy-example` at 136. Existing Example is observable (`Effect.runPromise` → `[]`).
- `impact`: Retired `@example` plus missing tags; error vs finding split is the contract callers must learn from an Example on the error/finding classes too.
- `suggestedFix`: Module lead: closed ajv layer; findings are values. Categories: errors, models, configuration, type-level, services. Convert class `@example` to titled Example (fix import in R1-027). Add small `make` Examples on `SchemaValidatorError` and `ValidationFinding`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-026: SchemaValidator schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/SchemaValidator.ts:18
- `symbol`: SchemaValidatorError, ValidationFinding
- `kind`: value
- `evidence`: TaggedError and Class without `$I.annote`. `SchemaValidatorError` uses `cause: Schema.Defect()`.
- `impact`: Validator schemas lack identity annotations.
- `suggestedFix`: `$I = $ScratchpadId.create("schemastore/SchemaValidator")`; `$I.annote` on both. Leave `Defect()` encoding to R1-036.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-027: SchemaValidator @effected Example; findings vs error; test double die

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaValidator.ts:136
- `symbol`: SchemaValidator
- `kind`: value
- `evidence`: `@example` imports `@effected/schemastore` (otherwise the Example is good and observable). Implementation: document rejection is `ValidationFinding[]`, not `SchemaValidatorError`; `makeTest` **dies** if `validate` is unstubbed (no honest default); `noop` is the always-clean layer; shipped layer registers `KeywordFamilies` keywords before compile so ajv strict does not reject language-server keys. No described `@see` among `layer` / `noop` / `layerTest` / `DocumentLint`.
- `impact`: Callers catching the error channel for a bad document will never see findings. Tests using `makeTest()` without stubs get a defect, not a clean pass.
- `suggestedFix`: Convert carrier; import `@beep/scratchpad/schemastore`. Keep `// => []`. **Gotchas**: error channel is mechanism-only; `makeTest` dies unless stubbed (`noop` for always-clean); declared keywords are registered per document. Described `@see` `{@link SchemaValidator.noop}`, `{@link SchemaValidator.layerTest}`, `{@link DocumentLint}`, `{@link KeywordFamilies}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-025
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-028: SchemaVersioning module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaVersioning.ts:1
- `symbol`: SchemaVersioning.ts module; InvalidSchemaVersionError; SchemaVersion (const); SchemaVersion (type); CatalogUrls; SchemaVersioning
- `kind`: module
- `evidence`: Census confirmed module header misses. `InvalidSchemaVersionError` (value/class:40) missing `@category` `@since` titled Example. `SchemaVersion` const (value:67) missing `@category` `@since` titled Example. `SchemaVersion` type (type:76) missing `@category` `@since` (Example optional; same-name alias already exists). `CatalogUrls` (interface:112) missing `@category` `@since`. `SchemaVersioning` (value/class:134) missing `@category` `@since` titled Example. Leads useful; no legacy carriers.
- `impact`: Version labels are the catalog-mode switch and currently have no Example showing `1.2` rejected or `catalogUrls` versioned vs unversioned.
- `suggestedFix`: Module lead: both catalog modes; three-component SemVer labels. Categories: errors, schemas, type-level, type-level, constructors. `SchemaVersion` Example: `S.decodeUnknownSync`/`SchemaVersioning.parseResult` on `"1.2.3"` vs `"1.2"` vs `"1.2.3+build"`. `SchemaVersioning` Example: `catalogUrls` unversioned and versioned (latest URL). Type alias: described `@see` to the const, no Example. `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-029: SchemaVersioning schema identity (brand + TaggedError)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/SchemaVersioning.ts:40
- `symbol`: InvalidSchemaVersionError, SchemaVersion
- `kind`: value
- `evidence`: TaggedError without `$I.annote`. `SchemaVersion` is `Schema.String.check(...).pipe(Schema.brand("SchemaVersion"))` with no `$I.annoteSchema`. Same-name type alias is present (do not add another). No `.Encoded` companion (optional for this brand).
- `impact`: The only non-class exported schema in the pack has no identity annotation; JSON Schema emission will not carry the description.
- `suggestedFix`: `$I = $ScratchpadId.create("schemastore/SchemaVersioning")`. Pipe `$I.annoteSchema("SchemaVersion", { description: "Full major.minor.patch SchemaStore version label without build metadata." })`. `$I.annote` on `InvalidSchemaVersionError`. Keep the existing type alias; add `@category type-level` `@since 0.0.0` on it (R1-028).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-030: SchemaVersioning three-component divergence and sync throws

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/SchemaVersioning.ts:52
- `symbol`: SchemaVersion, SchemaVersioning
- `kind`: value
- `evidence`: File comments (4–20, 22–26, 89–93, 202–204) never become Gotchas/`@throws`: SchemaStore corpus two-part labels (`1.2`, `1`) are rejected on purpose; build metadata rejected (URL-hostile, SemVer-ignored); `SemVer.parseResult` trims but `isValid` restores no-padding so `" 1.2.3 "` fails; `fileName` throws on empty/separator/whitespace names; `catalogUrls` throws on an empty `versions` array (pass `undefined` for unversioned). Examples in JSDoc must import `@beep/scratchpad/semver` if they mention SemVer, not `@effected/semver`.
- `impact`: Contributors copying SchemaStore's two-part filenames will see parse failures they think are bugs. Empty `versions: []` throws outside the tagged channel.
- `suggestedFix`: **Gotchas** on `SchemaVersion` and `SchemaVersioning` covering two-part rejection, build metadata, padding, empty-versions throw, simple file base name. `@throws` on `fileName` / `catalogUrls`. Described `@see` `{@link SchemaVersioning.parse}`, `{@link CatalogEntry.assemble}`, `{@link CatalogUrls}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-028
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-031: StoreDocument module header and export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/StoreDocument.ts:1
- `symbol`: StoreDocument.ts module; DRAFT_07_META_SCHEMA; SchemaConversionError; StoreDocumentOptions; StoreDocument
- `kind`: module
- `evidence`: Census confirmed module header misses. `DRAFT_07_META_SCHEMA` (value/const:17) missing `@category` `@since` titled Example. `SchemaConversionError` (value/class:29) missing `@category` `@since` titled Example. `StoreDocumentOptions` (interface:45) missing `@category` `@since`. `StoreDocument` (value/class:134) missing `@category` `@since` titled Example — census correctly flags missing `@example` because the `@example` at 156 is on `draft07`, not the class. No `@remarks`.
- `impact`: The assembly pipeline is the pack's core value export and currently has no class-level titled Example. The method-level `@example` still trips zero-legacy once the file is touched.
- `suggestedFix`: Module lead: SchemaStore Draft-07 document from Effect Schema. Categories: constants, errors, configuration, models. Move/convert the `draft07` `@example` onto the **class** as `**Example** (Build a Draft-07 store document)` (one Example on the owning class; strip the method `@example` so the file has zero legacy carriers). `DRAFT_07_META_SCHEMA` Example: log the trailing `#`. Error class: `make` or failed `fromSchemaResult`. Options interface: prose + `@see` `fromSchema`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-032: StoreDocument schema identity

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/StoreDocument.ts:29
- `symbol`: SchemaConversionError, StoreDocument
- `kind`: value
- `evidence`: `Schema.TaggedError<SchemaConversionError>()("SchemaConversionError", { $id, cause: Schema.Defect() })` and `Schema.Class<StoreDocument>("StoreDocument")({...})` without `$I` / `$I.annote`.
- `impact`: The document class schema is the publication artifact and has no identity annotation.
- `suggestedFix`: `$I = $ScratchpadId.create("schemastore/StoreDocument")`; `$I\`Name\`` + `$I.annote` on both. Leave `Defect()` to R1-036.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-033: StoreDocument Example quality and lowering Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/StoreDocument.ts:156
- `symbol`: StoreDocument
- `kind`: value
- `evidence`: Method `@example` imports `@effected/schemastore`, constructs `draft07` with no observable assertion. Options already document `includeAnnotationKey` vs lowering drop; class lead does not Gotcha: `$defs` omitted when empty; carriers run after `$ref` rewrite so payloads are not rewritten; `__proto__` keys use `Object.create(null)` (implementation comment 99–105); `$schema` always `DRAFT_07_META_SCHEMA` including trailing `#` (core URI omits it). `fromSchema` / `fromSchemaResult` dual undocumented as dual.
- `impact`: Hand-built documents that set `$schema` without `#`, or that expect empty `$defs: {}` on the wire, will fail corpus diffs. Usage-site annotations still will not appear (see AnnotationCarriers).
- `suggestedFix`: Class Example should `fromSchemaResult` (or `draft07`) and `console.log(document.toJson().$schema)` / omitted `$defs`. Import `@beep/scratchpad/schemastore` and `import * as S from "effect/Schema"`. **Gotchas**: trailing `#`; empty pool omits `$defs`; extra `includeAnnotationKey` keys die at lowering; annotate definition nodes not usage sites. Described `@see` `{@link AnnotationCarriers}`, `{@link DRAFT_07_META_SCHEMA}`, `{@link CanonicalJson}`, `{@link KeywordFamilies}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: schemastore-R1-031
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-034: index.ts barrel module leftover (since, @example, @effected)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/index.ts:1
- `symbol`: schemastore/index.ts module
- `kind`: module
- `evidence`: Census `findings: []` because module findings run only when `owning.length > 0`; barrel has 12 re-exports, 0 owning. Header has a useful lead and `@packageDocumentation` but `hasSince: false` and `hasLegacyExample: true`. `@example` (18–38) imports `@effected/schemastore` and named `Schema` from `effect` (otherwise the Example is good and observable: `Effect.runSync` → `[1, true]`). `@see {@link https://www.schemastore.org | SchemaStore}` and Effect counterpart use link display text, not a purpose phrase after the tag (bare `@see` under described-link law).
- `impact`: Zero-legacy and example-compiler fail on the package entry once docgen includes it; census will not list this file as open until an owning export appears.
- `suggestedFix`: Keep the lead. Add `@since 0.0.0`. Convert `@example` to `**Example** (Lint a generated store document)`. Import `@beep/scratchpad/schemastore` and `import * as S from "effect/Schema"`; keep `Effect` named from `effect`. Rewrite `@see` to purpose phrases, e.g. `@see {@link https://www.schemastore.org} for the catalog publication shape this kit emits.` Do not document re-export specifiers.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-035: internal/limits module tags and MAX_NESTING_DEPTH Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/schemastore/internal/limits.ts:1
- `symbol`: limits.ts module; MAX_NESTING_DEPTH
- `kind`: module
- `evidence`: Census confirmed leftover: useful lead, missing `@packageDocumentation` `@since`. `MAX_NESTING_DEPTH` (value/const:11) missing `@category` `@since` titled Example. Not a schema. Not re-exported from `index.ts` (internal, still an owning export).
- `impact`: The kit-wide 256 cap is the failure mode for carriers, lint, canonical JSON, and `$ref` rewrite; without tags/Example the census stays open.
- `suggestedFix`: Keep the lead; add `@packageDocumentation` `@since 0.0.0`. Const `@category constants` `@since 0.0.0`. Example: `MAX_NESTING_DEPTH === 256` observable. Described `@see` `{@link CarrierDepthExceededError}`, `{@link JsonDepthExceededError}`, `{@link DocumentLint}` (DepthExceeded finding).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### schemastore-R1-036: Cause-carrying TaggedErrors use Schema.Defect() without includeStack

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: not-doctrine
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/schemastore/SchemaFile.ts:25, scratchpad/schemastore/SchemaFile.ts:58, scratchpad/schemastore/SchemaValidator.ts:20, scratchpad/schemastore/StoreDocument.ts:33
- `symbol`: SchemaFileReadError, SchemaFileWriteError, SchemaValidatorError, SchemaConversionError
- `kind`: value
- `evidence`: Annotation patterns require `cause: S.Defect({ includeStack: true })` on cause-carrying tagged errors. These four use `Schema.Defect()`. JSDoc fixer brief forbids runtime behavior changes; adding `includeStack: true` would change encoded cause payloads.
- `impact`: Follow-on schema work, not this JSDoc pass. Callers decoding errors may omit stacks.
- `suggestedFix`: Do not edit in the JSDoc loop. Escalate to schema-first-development if identity annotations land and a later PR can update `Defect` options with tests.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives

- Type-level exports were **not** flagged for a required Example. Confirmed correct for `CanonicalJsonError`, `CanonicalJsonOptions`, `SchemaChange`, `WriteOutcome`, `WriteChange`, `WriteResult`, `CheckResult`, `SchemaWriteOptions`, `SchemaFileShape`, `PipelineResult`, `PipelineCheckResult`, `SchemaPipelineOptions`, `SchemaTarget` (interface), `SchemaValidatorOptions`, `SchemaValidatorShape`, `SchemaVersion` (type), `CatalogUrls`, `StoreDocumentOptions`.
- `schemastore/index.ts` re-export specifiers are graph edges. Census `owningExportCount: 0` is correct; no per-symbol docs on the barrel.
- JSDoc on `export const SchemaVersion` is attributed to the const (not a leftover "docs on the wrong node" miss).
- `DocumentDiff` / `SchemaFile` / `SchemaPipeline` / `SchemaValidator` missingTags omit `@example` because a legacy `@example` is present — census scoring, not a reason to skip conversion.
- `KeywordFamilies.ts` and `internal/limits.ts` `hasLead: true` is correct; only packageDocumentation/since were open.

No census mechanical finding was rejected.

---

## Pack verdict

- files reviewed: 14
- owning exports reviewed: 47
- confirmed mechanical items: 14
- editorial items: 22
- rejected false positives: 0
- accepted findings: 36
