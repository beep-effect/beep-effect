# Round 1 inventory — pack `codemode-root`

Slice: `scratchpad/.jsdoc-loop/packs/codemode/` filtered to `scratchpad/codemode/*.ts` (root `Codemode.*` files and `index.ts`). Interpreter, stdlib, and OpenAPI modules are out of scope.

Reviewed files (9): `Codemode.data.ts`, `Codemode.method-names.ts`, `Codemode.result.ts`, `Codemode.service.ts`, `Codemode.tool-error.ts`, `Codemode.tool-runtime.ts`, `Codemode.tool-schema.ts`, `Codemode.values.ts`, `index.ts`.

No titled `**Example**` sections, no `@see` tags, and no legacy `@example` / `@remarks` / `@module` / `@template` carriers in this filter. Census `@example` misses mean a missing titled Example on a value-level export.

Examples must import through `@beep/scratchpad/codemode` when the symbol is on the barrel (`CodeMode.*`, `ToolRuntime.*`, `ToolError`, and the named re-exports in `index.ts`). `Codemode.method-names.ts` and `Codemode.values.ts` are not barrel-exported; do not add barrel re-exports in this docs pass.

---

### codemode-root-R1-001: `Codemode.data.ts` missing tags, Example, and type-companion prose

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/codemode/Codemode.data.ts:13, scratchpad/codemode/Codemode.data.ts:20
- `symbol`: DataValue (value), DataValue (type)
- `kind`: module
- `evidence`: Census `missing-required-tags`. Value `DataValue` (line 13) has a useful lead and `$I.annoteSchema` but no `@category`, `@since`, or titled Example. Type companion (line 20) lead is `Runtime type for {@link DataValue}.` with no `@category` / `@since` / described `@see`. Module header is already compliant.
- `impact`: `enforceExamples` is on for scratchpad docgen; the boundary JSON schema is the kit's data contract and has no observable usage in hover docs.
- `suggestedFix`: Value: keep the lead, add one Example that decodes a nested JSON value and rejects a function (or other non-JSON input), `@category schemas`, `@since 0.0.0`. Type: rewrite to decoded-value prose, `@see {@link DataValue}` with a purpose phrase, `@category type-level`, `@since 0.0.0`. Import as `CodeMode.DataValue` from `@beep/scratchpad/codemode`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-002: `Codemode.method-names.ts` all 41 owning exports undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.method-names.ts:9
- `symbol`: arrayMethods, ArrayMethod, arrayStatics, ArrayStatic, mapMethods, MapMethod, mapStatics, MapStatic, setMethods, SetMethod, stringMethods, StringMethod, stringStatics, StringStatic, DateSetterName (value/type), DateSetterArity, dateMethods, DateMethod, dateStatics, DateStatic, regexpMethods, RegExpMethod, regexpStatics, RegExpStatic, objectStatics, ObjectStatic, numberMethods, NumberMethod, numberStatics, NumberStatic, mathMethods, MathMethod, ConsoleMethod (value/type), UrlMethod (value/type), UrlStatic (value/type), UrlSearchParamsMethod (value/type)
- `kind`: module
- `evidence`: Census `missing-summary` + `missing-required-tags` on every owning export (41). Module header is present. No JSDoc on any LiteralKit, type companion, or `DateSetterArity`. `DateSetterArity` is a frozen arity table, not a schema; it has no same-name type alias (not required).
- `impact`: These kits are the finite method domains the interpreter and stdlib dispatch on. Callers cannot tell allowed names, getter-vs-setter membership, or Date setter arities from hover docs.
- `suggestedFix`: One useful lead per export. Value-level LiteralKits: titled Example showing `kit.is.<member>(name)` or membership in `kit.Options`, `@category schemas`, `@since 0.0.0`. Type companions: prose + described `@see` to the kit, `@category type-level`, `@since 0.0.0`. `DateSetterArity`: Example looking up `setHours` (4) vs `setTime` (1), `@category constants`. Do not document barrel re-exports.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-003: Method-name kits missing `$I.annote` and Date setter sibling Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md; .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.method-names.ts:9, scratchpad/codemode/Codemode.method-names.ts:130, scratchpad/codemode/Codemode.method-names.ts:150, scratchpad/codemode/Codemode.method-names.ts:168
- `symbol`: arrayMethods (and every other LiteralKit in the file), DateSetterName, DateSetterArity, dateMethods
- `kind`: value
- `evidence`: File has no `$ScratchpadId` / `$I`. Annotation law requires LiteralKit `.annotate($I.annote("Name", { description }))`. `dateMethods` spreads `...DateSetterName.Options` (line 193), so `DateMethod` includes mutators. `DateSetterArity` values are maximum JS Date setter arities (optional trailing args), not required counts — `setHours: 4` means hours+minutes+seconds+ms, not “must pass four arguments”.
- `impact`: Untouched LiteralKits lack schema identity. A caller treating `dateMethods` as getters-only, or treating arity as required, will mis-dispatch Date mutation.
- `suggestedFix`: Add file-local `$I = $ScratchpadId.create("codemode/Codemode.method-names")` and annotate every LiteralKit. On `dateMethods`, **Gotchas** + `@see {@link DateSetterName}` stating setters are included via `DateSetterName.Options`. On `DateSetterArity`, **Gotchas** that entries are maximum optional-argument counts, `@see {@link DateSetterName}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-004: `Codemode.result.ts` all 11 owning exports missing tags and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.result.ts:19
- `symbol`: DiagnosticLocation, DiagnosticModel, Diagnostic (value/type), SuccessModel, FailureModel, ResultModel (value/type), Result (value/type), encodeResultModel
- `kind`: module
- `evidence`: Census `missing-required-tags` on all 11 owning exports. Leads exist and `$I.annote` / `$I.annoteSchema` are present. Value-level classes/schemas/functions lack titled Examples; types lack `@category` / `@since`. Module header is compliant.
- `impact`: Public wire (`Result` / `Diagnostic`) vs internal tagged models (`ResultModel` / `DiagnosticModel`) are undocumented at the application boundary `CodeMode.execute` returns.
- `suggestedFix`: Classes/schemas: titled Example constructing or encoding the symbol; `@category models` (or `diagnostics` for `Diagnostic*`), `@since 0.0.0`. `encodeResultModel`: `@category encoding`, Example encoding a `SuccessModel`. Type companions: annotation-patterns prose, described `@see`, `@category type-level`. Import via `CodeMode.*` from `@beep/scratchpad/codemode`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-005: Result/Diagnostic sibling choice and `encodeResultModel` defects

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.result.ts:56, scratchpad/codemode/Codemode.result.ts:95, scratchpad/codemode/Codemode.result.ts:170, scratchpad/codemode/Codemode.result.ts:180
- `symbol`: Diagnostic, ResultModel, Result, encodeResultModel
- `kind`: value
- `evidence`: Four parallel codecs with no `@see`. `Result` is the `ok` boolean wire schema (`S.toEncoded(ResultCodec)`); `ResultModel` is the `_tag: "Success" | "Failure"` internal union. `Diagnostic` is `S.toEncoded(DiagnosticModel)`. `encodeResultModel` is `S.encodeEffect(ResultCodec)(result).pipe(Effect.orDie)` — encode failures leave the typed error channel (`Effect.Effect<Result>` / `E = never`).
- `impact`: Callers will pass wire shapes into internal models (or the reverse). Hover docs hide that encode failure is a defect, not `InvalidExecutionLimits`.
- `suggestedFix`: Described `@see` pairs: `Result` ↔ `ResultModel`, `Diagnostic` ↔ `DiagnosticModel`, `encodeResultModel` ↔ both. **Gotchas** on `encodeResultModel`: `orDie` turns encode failure into a defect; do not restated Effect channels in `@returns`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-006: `Codemode.service.ts` owning exports missing Examples and type tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.service.ts:47
- `symbol`: ExecutionLimits, InvalidExecutionLimits, ExecuteOptions, Options, Runtime, resolveExecutionLimits, execute, make
- `kind`: module
- `evidence`: Census confirmed. `ExecutionLimits` / `InvalidExecutionLimits` already have leads, `$I.annote`, `@category`, `@since` — missing titled Example only. `ExecuteOptions` / `Options` / `Runtime` missing `@category` / `@since`. `resolveExecutionLimits` / `execute` / `make` missing `@category` / `@since` / Example. Module header compliant. `export { DataValue }` and the `Result*` re-export block are graph edges — do not document.
- `impact`: The only public Effect API for running CodeMode (`CodeMode.execute` / `CodeMode.make`) has no compilable usage sample under `enforceExamples`.
- `suggestedFix`: Examples: decode `ExecutionLimits`; construct `InvalidExecutionLimits.new`; `Effect.runPromise(CodeMode.execute({ code: "1 + 1" }))` with an observable `ok` result; `make` then `runtime.execute`. Types: `@category type-level`, `@since 0.0.0`. Functions: `@category factories` (`make` / `execute`) or `decoding` (`resolveExecutionLimits`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-007: `execute` vs `make` choice, limits Option defaults

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.service.ts:47, scratchpad/codemode/Codemode.service.ts:66, scratchpad/codemode/Codemode.service.ts:95, scratchpad/codemode/Codemode.service.ts:109, scratchpad/codemode/Codemode.service.ts:117, scratchpad/codemode/Codemode.service.ts:127
- `symbol`: ExecutionLimits, InvalidExecutionLimits, Options, resolveExecutionLimits, execute, make
- `kind`: value
- `evidence`: No described `@see` between `execute` (one-shot, prepares per call) and `make` (decodes limits once, `ToolRuntime.prepare`s the toolkit, returns reusable `Runtime`). `make` error channel is `InvalidExecutionLimits | ToolRuntime.ToolRuntimeError`; `execute` is only `InvalidExecutionLimits`. `resolveExecutionLimits(undefined)` decodes `{}` so omitted fields become `O.none()` via `withNoneDefault`. `InvalidExecutionLimits.new` always uses the fixed message `Execution limits must contain safe non-negative integers; timeoutMs must be at least 1.` Name collision with `ToolRuntime.make`.
- `impact`: Callers will pick the wrong constructor, miss `ToolRuntimeError` on `make`, or assume omitted limits mean “unlimited” vs explicit `None`.
- `suggestedFix`: **Gotchas** + described `@see`: `execute` ↔ `make` ↔ `ToolRuntime.make` / `emptyToolkit`; `Options` ↔ `ExecuteOptions` (Options is `Omit<code>`). Document Option-owned defaults and the frozen `InvalidExecutionLimits` message. Do not add empty When-to-use sections.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-008: `Codemode.tool-error.ts` class Example and namespace `@category`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.tool-error.ts:20, scratchpad/codemode/Codemode.tool-error.ts:48
- `symbol`: ToolError (class), ToolError (namespace)
- `kind`: module
- `evidence`: Census `missing-required-tags`: class missing titled Example (`@category models` + `@since` already present). Namespace missing `@category`. Census also flags namespace `@example` because `export declare namespace` with a body is classified as `value/namespace`; law treats namespaces as type-level — Example optional (see rejected false positives). Nested `ToolError.Encoded` is not a module-level owning export. Module header compliant. `$I.annote` present.
- `impact`: Hosts raising tool refusals have no sample of `ToolError.new` / `ToolError.is`. The companion namespace is uncategorized.
- `suggestedFix`: Class: titled Example constructing `ToolError.new` and narrowing with `ToolError.is`; keep `@since 0.0.0`. Namespace: `@category type-level` (no Example). Do not add `@example`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-009: `ToolError` lead restates the name; wrong `@category`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts
- `affectedFiles`: scratchpad/codemode/Codemode.tool-error.ts:16, scratchpad/codemode/Codemode.tool-error.ts:49
- `symbol`: ToolError, ToolError.Encoded
- `kind`: value
- `evidence`: Class lead is `The \`ToolError\` model.` — signature echo. `@category models` on a `S.TaggedError`. Nested Encoded lead is `Companion encoded type for {@link ToolError}` with `@category models` instead of `type-level`, and no described `@see`. Cause is `Option` via `withNoneDefault` (omitted cause is `None`, not a required field).
- `impact`: Hover docs do not say this is the host-tool failure that is safe to surface through CodeMode diagnostics, and category search will not list it under `errors`.
- `suggestedFix`: Rewrite the class lead from the `$I.annote` description (“A host tool failure safe to surface through CodeMode.”). `@category errors`. Encoded: decoded/encoded prose, `@category type-level`, described `@see {@link ToolError}`. Optional **Gotchas**: omitted `cause` becomes `O.none()`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-010: `Codemode.tool-runtime.ts` all 31 owning exports missing tags and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.tool-runtime.ts:58
- `symbol`: Services, ToolDescription, ToolCall, ToolCallStarted, ToolCallSucceeded, ToolCallInterrupted, ToolCallFailed, ToolCallEnded (value/type), ToolCallHooks, SearchInput, SearchItem, SearchOutput, SearchEntry, DiscoveryPlan, CopyOutMode (value/type), ToolReference, ToolRuntimeErrorKind (value/type), ToolRuntimeError, isBlockedMember, copyIn, copyOut, toolExpression, prepare, searchIndex, searchSignature, ToolRuntime, make, emptyToolkit
- `kind`: module
- `evidence`: Census `missing-required-tags` on all 31 owning exports. Short leads exist; `$I.annote` / `$I.annoteSchema` present on schemas. `export type { SafeObject }` (line 55) is a re-export — not owning. Module header compliant. Same-name type aliases exist for `ToolCallEnded`, `CopyOutMode`, `ToolRuntimeErrorKind`.
- `impact`: The Toolkit adapter is the largest public surface in this filter (`ToolRuntime.*` plus named barrel re-exports) and currently has zero titled Examples.
- `suggestedFix`: Value-level: titled observable Example, canonical `@category`, `@since 0.0.0`. Suggested categories: models/schemas for catalog/search/call classes; `errors` for `ToolRuntimeError`; `schemas` for LiteralKits; `predicates` for `isBlockedMember`; `encoding`/`serialization` for `copyIn`/`copyOut`; `formatting` for `toolExpression`; `factories` for `prepare`/`make`; `constants` for `searchSignature`/`emptyToolkit`; `guards` if keeping `CopyOutMode.is`. Types: `@category type-level` with described `@see`. Import via `ToolRuntime` / named exports from `@beep/scratchpad/codemode`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-011: `copyIn` / `copyOut` sync throws and boundary Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.tool-runtime.ts:369, scratchpad/codemode/Codemode.tool-runtime.ts:378, scratchpad/codemode/Codemode.tool-runtime.ts:502, scratchpad/codemode/Codemode.tool-runtime.ts:308
- `symbol`: isBlockedMember, copyIn, copyOut, CopyOutMode
- `kind`: value
- `evidence`: `copyIn`/`copyOut` return `unknown` and `throw ToolRuntimeError` (depth 32, circular values, blocked keys, non-plain prototypes, non-data values, un-awaited `CodeModePromise`, arrays longer than 100000). Law requires `@throws` for synchronous throws outside an Effect error channel. `copyIn` has a second unlabeled paragraph (`Checkpoint mode preserves guest objects; boundary mode JSON-normalizes them.`) — section grammar allows only a single lead then named sections. Implementation comments already warn: enumerable named array properties in checkpoint mode; native Date/Map/Set/URL become guest adapters only when `preserveCodeModeValues`; invalid Date must remain observable; `copyOut` densifies array holes; `CopyOutMode` description (“bare undefined preserved or nullified”) omits that non-finite numbers always become `null`, `json` mode drops undefined object keys and nullifies undefined array items, and `ToolReference` objects pass through uncopied. Blocked names are exactly `__proto__`, `constructor`, `prototype`.
- `impact`: Callers wrapping `copyIn` in `Effect.try` (as `make` does) vs assuming it returns `Result` will miss thrown `ToolRuntimeError`. Checkpoint vs JSON-normalize is the difference between preserving guest identity and emptying Map/Set/RegExp.
- `suggestedFix`: Fold the second `copyIn` paragraph into **Details**. Add **Gotchas** + `@throws` on `copyIn` and `copyOut`. Document `MAX_VALUE_DEPTH` 32, circular rejection, blocked members, Promise rejection, hole densification, NaN/Infinity → `null`, `ToolReference` passthrough. Described `@see` `copyIn` ↔ `copyOut` ↔ `CopyOutMode` ↔ `isBlockedMember`. Example must observe a throw or a normalized value, not `void copyIn(...)`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-012: Tool runtime `make` / `prepare` / `searchIndex` / `keys` / failureMode

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.tool-runtime.ts:704, scratchpad/codemode/Codemode.tool-runtime.ts:723, scratchpad/codemode/Codemode.tool-runtime.ts:832, scratchpad/codemode/Codemode.tool-runtime.ts:847, scratchpad/codemode/Codemode.tool-runtime.ts:1035, scratchpad/codemode/Codemode.tool-runtime.ts:115
- `symbol`: prepare, searchIndex, ToolRuntime, make, emptyToolkit, ToolCallSucceeded, ToolCallEnded
- `kind`: value
- `evidence`: `searchIndex` is `prepare` then `.searchIndex` — callers must choose. `make` (execution-local Toolkit adapter) collides with `CodeMode.make`. `ToolRuntime.keys` throws `ToolRuntimeError` via `Result.getOrElse((error) => { throw error })` — sync throw not in the `keys` type (`ReadonlyArray<string>`). Implementation comment at line 945: `failureMode "return"` yields `encodedResult` to the guest; `"error"` hits the Stream error path as `ToolError`. `SearchInput` defaults `limit=10`, `offset=0`. `ToolCallSucceeded` / `ToolCallInterrupted` declare `message: S.optionalKey(S.Never)` only to share ended fields with `ToolCallFailed`. `emptyToolkit` is `Toolkit.empty`, used when `CodeMode.make` omits `toolkit`.
- `impact`: `keys` looks total and throws. `make` vs `CodeMode.make` is a real constructor choice. Returned tool failures vs thrown `ToolError` depend on Tool `failureMode`, which no public docs mention.
- `suggestedFix`: Described `@see` among `prepare`, `searchIndex`, `make`, `emptyToolkit`, and `CodeMode.make`. **Gotchas** on `make`/`ToolRuntime`: `keys` throws; `execute`/`search` require exactly one input object; `failureMode "return"` vs `"error"`. **Gotchas** on succeeded/interrupted: `message` is uninhabited. `SearchInput`: default page size 10. `@throws` only on APIs that actually throw synchronously (`keys` via the returned runtime — document on `make`/`ToolRuntime`, not by inventing a wrapper).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-013: `Codemode.tool-schema.ts` all 8 owning exports missing tags and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.tool-schema.ts:32
- `symbol`: IdentifierSegment, identifierSegment, toTypeScript, jsonSchemaToTypeScript, InputProperty, inputProperties, inputTypeScript, outputTypeScript
- `kind`: module
- `evidence`: Census `missing-required-tags` on all 8 owning exports. Leads exist; `IdentifierSegment` and `InputProperty` have `$I.annoteSchema` / `$I.annote`. Module header compliant. Barrel already re-exports `inputTypeScript`, `jsonSchemaToTypeScript`, `outputTypeScript`.
- `impact`: Guest TypeScript signatures rendered into `search` / `ToolDescription.signature` have no documented rendering rules or failure fallback.
- `suggestedFix`: Titled Examples: `identifierSegment("foo")` vs `identifierSegment("foo-bar")`; `toTypeScript` / `jsonSchemaToTypeScript` producing an observable string; `inputProperties` on a tool; `outputTypeScript` with `failureMode: "return"`. Categories: `schemas` / `guards` / `formatting` / `models` / `getters`. `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-014: Missing `IdentifierSegment` type alias; renderers swallow errors as `"unknown"`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md; .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.tool-schema.ts:32, scratchpad/codemode/Codemode.tool-schema.ts:479, scratchpad/codemode/Codemode.tool-schema.ts:502, scratchpad/codemode/Codemode.tool-schema.ts:597
- `symbol`: IdentifierSegment, toTypeScript, jsonSchemaToTypeScript, outputTypeScript
- `kind`: value
- `evidence`: Exported non-class schema `IdentifierSegment` has no `export type IdentifierSegment = typeof IdentifierSegment.Type`. `toTypeScript` / `jsonSchemaToTypeScript` `Result.match` `onFailure: () => "unknown"` — JSON Schema conversion or decode failure is silent. `toTypeScript(schema, decoded=true)` uses `S.toType(schema)` (decoded-side JSON Schema). `outputTypeScript` unions `successSchema | failureSchema` only when `tool.failureMode === "return"`; otherwise it emits success only. Internal `jsdoc` helper (line 208) rewrites `*/` in schema descriptions so generated comments cannot terminate a block — that neutralization is part of the TypeScript `toTypeScript` emits.
- `impact`: Callers cannot name the decoded identifier type. A failed schema render looks like a legitimate `unknown` guest type. Tools with `failureMode: "error"` appear to have no failure in the printed signature.
- `suggestedFix`: Add the same-name type alias with type-level prose and described `@see`. **Gotchas** + `@param` on `decoded` (decoded-side `S.toType` vs encoded JSON Schema). **Gotchas** on both renderers: failure becomes the string `"unknown"`. **Gotchas** on `outputTypeScript`: union only for `failureMode === "return"`. `@see` among `toTypeScript`, `jsonSchemaToTypeScript`, `inputTypeScript`, `outputTypeScript`. Mention `*/` neutralization only if documenting emitted JSDoc; do not lift the private helper.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-015: `Codemode.values.ts` missing module header; exports missing Examples and type tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.values.ts:1, scratchpad/codemode/Codemode.values.ts:53
- `symbol`: (module), CodeModePromise, CodeModeDate, CodeModeRegExp, CodeModeMap, CodeModeSet, CodeModeURLSearchParams, CodeModeURL, CodeModeValue (value/type), isCodeModeValue
- `kind`: module
- `evidence`: Census module findings `missing-module-summary`, `missing-packageDocumentation`, `missing-module-since` — file starts at the import; no fileoverview. Classes already have leads, `$I.annote`, `@since 0.0.0`, and a `@category` (see R1-016 for the illegal slug). Census: all 7 classes + `CodeModeValue` value + `isCodeModeValue` missing titled Example; `CodeModeValue` type missing `@category` / `@since`; `isCodeModeValue` missing all required tags.
- `impact`: Only exporting module in this filter without a package header. Guest-value adapters are undocumented at the copyIn checkpoint boundary.
- `suggestedFix`: Module lead describing guest JS values whose mutation/identity are part of the interpreter contract, `@packageDocumentation`, `@since 0.0.0`. Each class: titled Example using `.new` / `.is` with an observable field (`time`, `map.size`, `url.href`). `CodeModeValue`: Example matching a tagged union member. `isCodeModeValue`: Example true for `CodeModeDate.new(0)` and false for `CodeModePromise` (see R1-016). Type companion: `@category type-level`. These symbols are not on `index.ts`; do not add barrel exports — write Examples that still name the owning export (relative import only if examples tsc can resolve it; otherwise residual compile risk).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-root-R1-016: `@category runtime` is non-canonical; identity Gotchas already in comments

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts; .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/Codemode.values.ts:50, scratchpad/codemode/Codemode.values.ts:72, scratchpad/codemode/Codemode.values.ts:91, scratchpad/codemode/Codemode.values.ts:117, scratchpad/codemode/Codemode.values.ts:136, scratchpad/codemode/Codemode.values.ts:155, scratchpad/codemode/Codemode.values.ts:173, scratchpad/codemode/Codemode.values.ts:201
- `symbol`: CodeModePromise, CodeModeDate, CodeModeRegExp, CodeModeMap, CodeModeSet, CodeModeURLSearchParams, CodeModeURL, CodeModeValue
- `kind`: value
- `evidence`: Seven classes use `@category runtime`. `runtime` is not in `CANONICAL_JSDOC_CATEGORIES`, not a legacy alias, and is topology-like. `CodeModeValue` already uses `models`. Implementation comments the docs omit: `CodeModePromise.new` wraps `Equal.byReferenceUnsafe` because “Effect hash collections must not structurally traverse the Fiber”; `CodeModeDate` keeps `S.Number` so NaN invalid dates stay representable; `CodeModeMap`/`CodeModeSet` use native Map/Set because HashMap/HashSet cannot preserve object identity, SameValueZero, or live mutation. `CodeModeValue` union is Date/RegExp/Map/Set/URL/URLSearchParams — **not** `CodeModePromise`. `copyIn` separately throws on un-awaited promises.
- `impact`: Category gate rejects `runtime`. Callers putting `CodeModePromise` in a `HashMap` or expecting `isCodeModeValue(promise)` to be true will corrupt identity or miss the await diagnostic.
- `suggestedFix`: Change class `@category` to `models` (or `value-objects`), matching `CodeModeValue`. **Gotchas** quoting the existing comments. Described `@see`: `CodeModeValue` ↔ members; `isCodeModeValue` ↔ `CodeModePromise` (excluded); `CodeModeURL` ↔ `CodeModeURLSearchParams`. Do not restate class names as the entire lead (`Mutable JavaScript Map value.` is a signature echo — mention native backing and identity instead).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-root
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives

- `Codemode.tool-error.ts:48` `ToolError` namespace flagged `missing=@example`. Census treats `export declare namespace` with a body as `value`. Law: namespaces are type-level; Example optional. Keep the missing-`@category` half (R1-008). Do not add a titled Example just to silence census.
- `index.ts` re-exports (`export * as CodeMode`, named `ToolError` / `searchSignature` / …) are graph edges. Census `owningExportCount: 0`. Do not document them as new symbols. Module header already has a useful lead, `@packageDocumentation`, and `@since 0.0.0`.
- Type companions flagged only for `@category`/`@since` (not `@example`) — census kind-split is correct; confirmed, not rejected.
- Extra Examples, empty `**When to use**` / `**Details**`, and taste-only rewording of already-useful leads (for example `index.ts` “Effect-native CodeMode experiment.”) are rejected by the brief.

---

## Pack verdict

- files reviewed: 9
- owning exports reviewed: 113
- confirmed mechanical items: 8
- editorial items: 8
- rejected false positives: 2
- accepted findings: 16

Every owning export in the filter was reviewed. `scratchpad/codemode/index.ts` has zero owning exports and no accepted findings. Residual risk: `Codemode.method-names.ts` and `Codemode.values.ts` are not re-exported from `codemode/index.ts`, so titled Examples cannot import those symbols through `@beep/scratchpad/codemode` without a barrel change (out of fixer scope). Report example tsc failures rather than adding re-exports.
