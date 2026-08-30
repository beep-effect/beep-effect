# Pack inventory: codemode-openapi-stdlib (round 1)

Filter: `scratchpad/codemode/openapi/` and `scratchpad/codemode/stdlib/` only
(from pack `codemode`). Census re-exports are not treated as owning subjects.

Reviewer: jsdoc-annotation-specialist

---

### codemode-openapi-stdlib-R1-001: OpenAPI.runtime `invoke` missing titled Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.runtime.ts:912
- `symbol`: invoke
- `kind`: value
- `evidence`: Census `missing-required-tags` (`@example`). Module header is present. Lead and `@since 0.0.0` exist; there is no `**Example** (Title)` showing a planned operation executed through `HttpClient`. `@example` must not be added.
- `impact`: Value-level HTTP execution is the adapter's runtime entry; callers and the ratchet need a compilable Example of the symbol doing that job.
- `suggestedFix`: Keep the existing lead. Add one titled Example that builds a minimal `Plan`, provides `HttpClient.HttpClient`, and shows a JSON success payload or a `ToolError` status failure. Then `@see`, `@category`, `@since`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-002: OpenAPI.specification owning exports missing tags and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.specification.ts:58
- `symbol`: ParameterLocation
- `kind`: value
- `evidence`: Module header is present. Every owning export has a one-line lead but census `missing-required-tags` (`@category`, `@since`; values also `@example`) is confirmed for: `ParameterLocation` (value:58, type:67), `SchemaDirection` (value:76, type:83), `isRecord` (107), `nonEmptyString` (110), `own` (114), `resolve` (176), `hasDirectionalSchemas` (232), `componentDefinitions` (476), `operationInput` (1000), `inputSchema` (1064), `operationOutput` (1121), `operationPath` (1297), `validateBaseUrl` (1354), `specServerUrl` (1378), `securityRequirements` (1403), `operationSecurityRequirements` (1443), `securitySchemes` (1504). `ParameterLocation` and `SchemaDirection` already have `$I.annoteSchema` and same-name type aliases.
- `impact`: Planning helpers are the compile path behind `fromSpec`; missing canonical tags and value-level Examples fail the kind-split law.
- `suggestedFix`: Per symbol add `@category` (`schemas` / `type-level` / `predicates` / `getters` / `parsing`) and `@since 0.0.0`. For each value, add one titled observable Example (decode a location, resolve a `#/components/schemas/...` ref, project `operationInput` for a path+query op, reject a `ws:` URL). Do not add `@example`. Type aliases need prose + tags only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-003: OpenAPI.types owning exports missing tags and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.types.ts:31
- `symbol`: Document
- `kind`: value
- `evidence`: Module header is present. `$I.annote` / `$I.annoteSchema` and same-name type companions exist. Census `missing-required-tags` is confirmed for all 49 owning exports. Values (Example required): `Document` (31), `JsonSchema` (42), `OperationId` (53), `HttpMethod` (65), `ApiPath` (87), `Operation` (100), `ApiKeyHeader` (129), `ApiKeyQuery` (141), `ApiKeyCookie` (153), `ApiKeyCarrier` (165), `SecuritySchemeApiKey` (180), `SecuritySchemeHttp` (194), `SecuritySchemeOAuth2` (208), `SecuritySchemeOpenIdConnect` (222), `SecurityScheme` (236), `CredentialBearer` (252), `CredentialBasic` (266), `CredentialApiKey` (286), `CredentialHeader` (300), `Credential` (320), `AuthContext` (336), `AuthConfig` (374), `Options` (399), `Skipped` (433), `InputLocation` (451), `InputStyle` (466), `InputField` (476), `BodyMode` (515), `Body` (525), `OperationInput` (548), `SecurityRequirement` (568), `Plan` (584), `AppliedAuth` (624), `InvalidOpenApiOptions` (640), `FromSpecResult` (681). Types (prose + tags only): same-name companions plus `AuthResolver` (365), `GeneratedToolkit` (662), `GeneratedHandlersLayer` (665). No type was falsely required to have an Example.
- `impact`: These are the adapter's published models; schema classes without Examples and aliases without `@category type-level` / `@since 0.0.0` fail the kind split.
- `suggestedFix`: For each schema/class, keep `$I.annote*`, add `@category schemas|models|errors`, `@since 0.0.0`, and one titled Example using `.new` / `.make` / a decode (Redacted credentials, `InvalidOpenApiOptions.new`). For type aliases, add `@category type-level`, `@since 0.0.0`, and a described `@see` to the runtime schema. `AuthResolver` / `GeneratedToolkit` / `GeneratedHandlersLayer` need precise prose + tags only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-004: OpenAPI `fromSpec` missing titled Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/index.ts:447
- `symbol`: fromSpec
- `kind`: value
- `evidence`: Census `missing-required-tags` (`@example`). Module header, lead, `@category constructors`, and `@since 0.0.0` are present. Re-exports at 54–94 are graph edges (not owning). No titled Example compiles a tiny spec into `FromSpecResult`.
- `impact`: This is the public constructor for the OpenAPI Toolkit; without an Example callers cannot see decode failure vs skipped operations vs a usable toolkit.
- `suggestedFix`: Add one titled Example that passes a minimal OpenAPI document (one `GET /health` JSON op), runs `fromSpec`, and observes `toolkit` plus empty `skipped`. A second Example is optional and should show `InvalidOpenApiOptions` on bad options. Do not use `@example`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-005: StdLib.console missing module header and `formatConsoleMessage` docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.console.ts:1
- `symbol`: formatConsoleMessage
- `kind`: module
- `evidence`: Census module `missing-module-summary|missing-packageDocumentation|missing-module-since` confirmed. Owning value `formatConsoleMessage` (29) has no lead, `@category`, `@since`, or titled Example (`missing-summary|missing-required-tags`). `export { ConsoleMethod }` at 23 is a re-export (see rejected false positives).
- `impact`: Guest console formatting is the only owning API in the file; undocumented, it is invisible to docgen and callers choosing `log` vs `dir` vs `table`.
- `suggestedFix`: Add a fileoverview lead + `@packageDocumentation` + `@since 0.0.0`. Document `formatConsoleMessage` with a purpose lead, `@category formatting`, `@since 0.0.0`, and an Example that formats `log` / `warn` / `table` arguments and shows the `[warn]` prefix.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-006: StdLib.date missing module header and owning docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.date.ts:1
- `symbol`: invokeDateStatic
- `kind`: module
- `evidence`: Census module findings confirmed. Owning values `invokeDateStatic` (28), `dateSetterArgumentCount` (34), `invokeDateMethod` (40) each `missing-summary|missing-required-tags` (`@category`, `@since`, titled Example). `export { dateMethods, dateStatics } from ...` is not owning.
- `impact`: Date adapters are interpreter-facing; missing leads/Examples hide Clock vs host `Date.parse`/`Date.UTC` split.
- `suggestedFix`: Fileoverview + `@packageDocumentation` + `@since 0.0.0`. Each value: useful lead, `@category interop`, `@since 0.0.0`, titled Example (`Date.parse`/`Date.UTC`; Option arity for `setHours` vs `getTime`; `setTime` mutating `CodeModeDate.time`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-007: StdLib.json missing module header and `invokeJsonMethod` tags/Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.json.ts:26
- `symbol`: invokeJsonMethod
- `kind`: module
- `evidence`: Census module findings confirmed (the existing comment is attached to `invokeJsonMethod`, not a fileoverview). Function has a lead so `missing-summary` is a true negative; `missing-required-tags` (`@category`, `@since`, `@example`) is confirmed at 35.
- `impact`: Guest JSON is a boundary adapter; without tags/Example callers cannot see parse/stringify plus reviver/replacer behavior.
- `suggestedFix`: Add a real module header. On `invokeJsonMethod` keep a one-paragraph lead, move the native-JSON rationale into `**Details**`/`**Gotchas**`, add `@category serialization`, `@since 0.0.0`, and a titled Example of `parse` then `stringify` with an observable string.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-008: StdLib.math missing module header and owning docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.math.ts:1
- `symbol`: mathConstants
- `kind`: module
- `evidence`: Census module findings confirmed. Owning values `mathConstants` (23), `invokeMathMethod` (31), `invokeMathSumPrecise` (87) each `missing-summary|missing-required-tags`. `export { mathMethods }` is not owning.
- `impact`: Math dispatch omits `random`/`sumPrecise` from `invokeMathMethod`; undocumented constants and invokers make that split invisible.
- `suggestedFix`: Module header. Document all three with leads, `@category constants|interop`, `@since 0.0.0`, and titled Examples (`Math.PI` membership; `invokeMathMethod("abs", [-3], node)`; `sumPrecise` over a sync iterable of numbers).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-009: StdLib.number missing module header and owning docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.number.ts:1
- `symbol`: numberConstants
- `kind`: module
- `evidence`: Census module findings confirmed. Owning values `numberConstants` (21), `invokeNumberMethod` (33), `invokeNumberStatic` (60) each `missing-summary|missing-required-tags`. Re-exported `numberMethods`/`numberStatics` are not owning.
- `impact`: Number instance vs static dispatch and bounded results are undocumented; callers cannot tell `toString` radix rejection from `Number.parseInt`.
- `suggestedFix`: Module header. Document each value with lead, `@category constants|interop`, `@since 0.0.0`, titled Examples (`isFinite`/`parseInt`; `toFixed`/`toString` radix 2).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-010: StdLib.object missing module header and owning docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.object.ts:1
- `symbol`: objectMethodsPreservingIdentity
- `kind`: module
- `evidence`: Census module findings confirmed. Owning values `objectMethodsPreservingIdentity` (19), `invokeObjectMethod` (31), `invokeObjectFromEntries` (93) each `missing-summary|missing-required-tags`. `export { objectStatics }` is not owning.
- `impact`: Object statics reject un-awaited Promises and blocked keys; without docs callers treat this as host `Object.*`.
- `suggestedFix`: Module header. Document each value with lead, `@category schemas|interop`, `@since 0.0.0`, titled Examples (`Object.keys` on a data object; `fromEntries` over `[["a", 1]]`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-011: StdLib.regexp missing module header and owning docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.regexp.ts:1
- `symbol`: regexpProperties
- `kind`: module
- `evidence`: Census module findings confirmed. Owning values `regexpProperties` (30), `regexFailureReason` (46), `escapeRegexHint` (49), `toHostRegex` (53), `matchToValue` (73), `invokeRegExpStatic` (88), `invokeRegExpMethod` (96) each `missing-summary|missing-required-tags`. Re-exported `regexpMethods`/`regexpStatics` are not owning.
- `impact`: Seven runtime helpers including `RegExp.escape` and lastIndex-aware `exec`/`test` are undocumented.
- `suggestedFix`: Module header. Document each value with lead, `@category constants|utilities|interop`, `@since 0.0.0`, and titled Examples (`toHostRegex(undefined)` → empty pattern; `invokeRegExpStatic` escaping `(foo)`; `exec` returning `index`/`groups`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-012: StdLib.string missing module header and `invokeStringStatic` docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.string.ts:1
- `symbol`: invokeStringStatic
- `kind`: module
- `evidence`: Census module findings confirmed. Owning value `invokeStringStatic` (13) `missing-summary|missing-required-tags`. Re-exported `stringMethods`/`stringStatics` are not owning.
- `impact`: The only owning API is `fromCharCode`/`fromCodePoint` dispatch; without an Example callers cannot see numeric-argument rejection.
- `suggestedFix`: Module header. Document `invokeStringStatic` with lead, `@category interop`, `@since 0.0.0`, Example `fromCharCode(65, 66)` → `"AB"`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-013: StdLib.url missing module header and owning docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.url.ts:1
- `symbol`: urlProperties
- `kind`: module
- `evidence`: Census module findings confirmed. Owning values `urlProperties` (23), `urlWritableProperties` (37), `uriArgument` (42), `invokeUriFunction` (45), `urlArgument` (79), `invokeURLStatic` (83), `invokeURLMethod` (96) each `missing-summary|missing-required-tags`. Re-exported `UrlMethod`/`UrlSearchParamsMethod`/`UrlStatic` are not owning.
- `impact`: URI encode/decode vs `URL.parse`/`canParse` is a caller choice; undocumented, `canParse` false vs `parse` null is easy to mix up.
- `suggestedFix`: Module header. Document each value with lead, `@category schemas|interop`, `@since 0.0.0`, titled Examples (`encodeURIComponent`; `URL.canParse` true/false; `URL.parse` returning `CodeModeURL` or `null`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-014: StdLib.value missing module header and owning docs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.value.ts:1
- `symbol`: valueConstructors
- `kind`: module
- `evidence`: Census module findings confirmed. All 24 owning exports `missing-summary|missing-required-tags`. Values (Example required): `valueConstructors` (24), `BinaryOperator` (35), `AppliedBinaryOperator` (62), `CompoundOperator` (68), `LogicalOperator` (85), `UnaryOperator` (88), `LogicalAssignmentOperator` (91), `AssignmentOperator` (94), `UpdateOperator` (101), `createErrorValue` (110), `createAggregateErrorValue` (117), `errorBrandName` (120), `boundedData` (127), `coerceToString` (129), `coerceToNumber` (157), `invokeCoercion` (167). Types (prose + tags only): `BinaryOperator` (60), `AppliedBinaryOperator` (66), `CompoundAssignmentOperator` (83), `LogicalOperator` (86), `UnaryOperator` (89), `LogicalAssignmentOperator` (92), `AssignmentOperator` (99), `UpdateOperator` (105).
- `impact`: Operator kits and guest coercions are the interpreter's value kernel; 16 undocumented values fail the Example law.
- `suggestedFix`: Module header. Each value: lead, `@category schemas|constructors|utilities`, `@since 0.0.0`, titled Example (kit membership, `createErrorValue("TypeError", "x")` stringifies as `TypeError: x`, `Number()` with no args is `0`). Types: lead, `@category type-level`, `@since 0.0.0`, described `@see` to the runtime kit.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-015: stdlib barrel missing module header

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/index.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Exporting barrel (`export *` of ten StdLib modules) has no lead, `@packageDocumentation`, or `@since 0.0.0`. Census `findings: []` because `owningExportCount` is 0; the review brief still requires a module header on exporting modules. Do not document re-exported symbols here.
- `impact`: The stdlib entry surface has no package overview, so IDE/docgen readers cannot tell this barrel is guest ECMAScript adapters rather than host Effect APIs.
- `suggestedFix`: Add a fileoverview that the barrel re-exports guest Date/JSON/Math/Number/Object/RegExp/String/URL/value adapters, plus `@packageDocumentation` and `@since 0.0.0`. Leave `export *` undocumented as graph edges.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-016: `invoke` uses non-canonical `@category execution`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts
- `affectedFiles`: codemode/openapi/OpenAPI.runtime.ts:908
- `symbol`: invoke
- `kind`: value
- `evidence`: `@category execution` is not in `CANONICAL_JSDOC_CATEGORIES`. Topology/role slugs such as `exports`/`core`/`execution` are rejected; HTTP execution of a planned operation is a `clients` (or `adapters`/`handlers`) role.
- `impact`: Touched docs must use a canonical kebab-case role or docgen category checks fail.
- `suggestedFix`: Replace `@category execution` with `@category clients` (HTTP client execution of a `Plan`). Keep tag order `@see` → `@category` → `@since`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-017: `invoke` missing Gotchas and described `@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.runtime.ts:904
- `symbol`: invoke
- `kind`: value
- `evidence`: Implementation: non-record input becomes `{}` (917–919); `AuthResolver` `Option.none` makes a requirement unavailable and the next OR alternative is tried, while a `ToolError` aborts (604–618); cookie apiKey fails at apply time (713–718); empty JSON body becomes `null`; non-JSON success returns text; malformed JSON on a JSON content-type is `ToolError` (948–973). Lead does not mention these. No `@see` to `Plan`, `fromSpec`, `AuthResolver`, or `ToolError`.
- `impact`: Callers will pass non-object tool input, treat cookie schemes as headers, or expect thrown HTTP errors instead of `ToolError` on non-2xx.
- `suggestedFix`: Add `**Gotchas**` covering empty input, auth none-vs-fail, cookie rejection, JSON vs text vs empty body. Add described `@see {@link Plan}`, `{@link fromSpec}`, `{@link AuthResolver}`, `{@link ToolError}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-018: `resolve` local `$ref` and cycle termination undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.specification.ts:174
- `symbol`: resolve
- `kind`: value
- `evidence`: Lead says it "terminat[es] cycles without native sets" but not that only `#/` local pointers are followed (`Str.startsWith(ref, "#/")`), unresolved or looping refs return the current node unchanged, and remote/external refs are left intact. Callers of `componentDefinitions` / `securitySchemes` inherit this.
- `impact`: A caller expecting JSON Pointer or HTTP `$ref` resolution will silently keep the ref object and emit a bad tool schema.
- `suggestedFix`: Add `**Gotchas**`: local `#/` only; cycles and missing targets return `current`. `@see {@link componentDefinitions}` for directional projection after resolve.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-019: `operationOutput` silently unsupported WebSocket/SSE/binary

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.specification.ts:1119
- `symbol`: operationOutput
- `kind`: value
- `evidence`: Implementation fails with `"WebSocket operations are not supported"` (`x-websocket`), `"SSE operations are not supported"` (`text/event-stream`), and `"binary responses are not supported"`. Lead only says "normalized success schema". `fromSpec` turns those strings into `Skipped.reason`.
- `impact`: Spec authors will wonder why generated toolkits omit streaming/binary ops; the skip reason is the only diagnostic.
- `suggestedFix`: `**Gotchas**` listing the three hard failures. `@see {@link fromSpec}` for how failures become `Skipped`, and `{@link operationInput}` for the request-side sibling.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-020: Server URL helpers need sibling `@see` and absolute-HTTP Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.specification.ts:1354
- `symbol`: validateBaseUrl
- `kind`: value
- `evidence`: `validateBaseUrl` rejects non-http(s), query strings, and fragments. `specServerUrl` uses the first `servers[].url`, fails with "pass baseUrl" when missing, and rejects `{variable}` templates. `fromSpec` prefers `Options.baseUrl`, else operation/pathItem/document servers. No `@see` among `validateBaseUrl`, `specServerUrl`, and `Options.baseUrl`.
- `impact`: Callers cannot tell when to pass `baseUrl` versus relying on the spec's `servers` entry.
- `suggestedFix`: On both functions, add `**Gotchas**` (http(s) only; no query/hash; templated servers require `baseUrl`) and described `@see` links to each other and `{@link Options}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-021: Cookie apiKey is modeled but not executable

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.types.ts:152
- `symbol`: ApiKeyCookie
- `kind`: value
- `evidence`: `ApiKeyCookie` annote says "unsupported cookie-carried API key retained for diagnostics" while the JSDoc lead is the same "OpenAPI apiKey carrier" used by header/query. `securitySchemes` still constructs cookie carriers (1536–1538). `operationSecurityRequirements` fails with `cookie authentication '…' is not supported` when every alternative needs a cookie (1492–1498). `invoke`/`applyCredential` also fails cookie at runtime (713–718).
- `impact`: Callers can construct `ApiKeyCookie` and see it in `SecurityScheme` yet every compile/execute path rejects it; the three sites do not cross-link.
- `suggestedFix`: Rewrite the `ApiKeyCookie` lead to say it is diagnostic-only. Add `**Gotchas**` on `ApiKeyCookie`, `operationSecurityRequirements`, and `invoke`. Described `@see` among `{@link ApiKeyHeader}`, `{@link ApiKeyQuery}`, `{@link operationSecurityRequirements}`, `{@link invoke}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-022: `operationInput` renames blocked and colliding fields

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.specification.ts:998
- `symbol`: operationInput
- `kind`: value
- `evidence`: `isBlockedMember(field.name)` rewrites the tool input name to `${name}_2`. Cross-location name collisions become `${location}_${visibleName}`. `inputSchema` then keys properties by `inputName`, not wire `name`. Lead does not mention this. No `@see` to `inputSchema` or `isBlockedMember`.
- `impact`: Generated tool parameter names will not match the OpenAPI parameter names; model callers using the spec names will send unused fields.
- `suggestedFix`: `**Gotchas**` for `_2` blocked-member suffix and location-prefixed collisions. `@see {@link inputSchema}` for the object schema keyed by `inputName`, `{@link InputField}` for `inputName` vs `name`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-023: OpenAPI.types leads restate the symbol name

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.types.ts:128
- `symbol`: ApiKeyHeader
- `kind`: value
- `evidence`: Law: the lead must explain purpose, not restate the name. Repeated name-echo leads: `ApiKeyHeader`/`ApiKeyQuery`/`ApiKeyCookie` all "OpenAPI apiKey carrier."; `CredentialBearer` "Bearer credential."; `SecuritySchemeOAuth2` "OpenAPI OAuth 2 security scheme marker."; type companions "Runtime type for {@link X}." `$I.annote` descriptions are often stronger than the JSDoc lead (`Document`: "YAML is parsed by the host.").
- `impact`: Hover text does not distinguish header vs query vs unsupported cookie, or credential kinds, so sibling unions cannot be chosen from docs.
- `suggestedFix`: Lift each `$I.annote` description into the JSDoc lead (one paragraph). Differentiate the three apiKey carriers and four credentials. Type aliases should say "Decoded value produced by {@link X}" plus described `@see`, matching annotation-patterns.md — not "Runtime type for X".
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-024: `HttpMethod` encode/decode case mapping undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.types.ts:64
- `symbol`: HttpMethod
- `kind`: value
- `evidence`: `MappedLiteralKit` encodes OpenAPI lowercase (`get`) and decodes runtime uppercase (`GET`). Lead says "transformed to the HTTP spelling" without showing the mapping. `fromSpec` uses `HttpMethod.decodeOption(sourceMethod)` then `HttpMethod.To.Enum` for operationId fallbacks.
- `impact`: Callers constructing `Operation` with `"get"` vs `"GET"` will hit the wrong side of the codec.
- `suggestedFix`: `**Details**` that encoded/OpenAPI is lowercase and decoded/HTTP is uppercase. Example: decode `"post"` → `"POST"` and show `HttpMethod.To` / encoded form. `@see {@link Operation}` for where the decoded spelling is stored.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-025: Input serialization is a subset; `ParameterLocation` omits `body`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.types.ts:465
- `symbol`: InputStyle
- `kind`: value
- `evidence`: `InputStyle` is only `"simple" | "form" | "deepObject"` — not OpenAPI `label`/`matrix`/`spaceDelimited`/`pipeDelimited`. `InputLocation` includes `body`; `ParameterLocation` is `InputLocation` minus `body`. No `@see` between `InputStyle`, `InputLocation`, `ParameterLocation`, and `InputField`.
- `impact`: Specs using matrix/label styles or treating body as a parameter location will be planned incorrectly or skipped without a documented reason.
- `suggestedFix`: `**Gotchas**` on `InputStyle` (unsupported OpenAPI styles). On `ParameterLocation`, state it is path/query/header only. Described `@see` among `{@link InputLocation}`, `{@link ParameterLocation}`, `{@link InputField}`, `{@link BodyMode}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-026: `Document` YAML is host-parsed, not adapter-parsed

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/OpenAPI.types.ts:30
- `symbol`: Document
- `kind`: value
- `evidence`: `$I.annoteSchema` description is "A parsed OpenAPI 3.x document. YAML is parsed by the host." JSDoc lead is only "A raw OpenAPI 3.x object after boundary decoding." `fromSpec` takes `options.spec` already as `Document` (a branded record), not a YAML string.
- `impact`: Callers will pass YAML text into `fromSpec` and get `InvalidOpenApiOptions` instead of compiling.
- `suggestedFix`: Lead should say the adapter accepts an already-decoded OpenAPI 3.x object; YAML/JSON parsing is the host's job. `@see {@link Options}` / `{@link fromSpec}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-027: `fromSpec` skip list, `failureMode: "return"`, and sibling `@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/openapi/index.ts:440
- `symbol`: fromSpec
- `kind`: value
- `evidence`: Unrepresentable operations are appended to `FromSpecResult.skipped` rather than failing the Effect (invalid path, websocket/SSE/binary, cookie-only security, bad server URL). Tools use `failureMode: "return"` with `ToolError`. The Effect error channel is only `InvalidOpenApiOptions` (options decode). No `@see` to `invoke`, `Skipped`, `Options`, `FromSpecResult`.
- `impact`: Callers will treat a successful `fromSpec` as "all operations generated" and miss `skipped`, or expect HTTP failures to reject the Effect instead of returning `ToolError`.
- `suggestedFix`: `**Gotchas**`: success still carries `skipped`; only invalid options fail the Effect; generated tools return `ToolError`. Described `@see {@link invoke}`, `{@link Skipped}`, `{@link Options}`, `{@link InvalidOpenApiOptions}`, `{@link operationOutput}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-028: `Date.now` is Clock-backed; `invokeDateStatic` only parse/UTC

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.date.ts:25
- `symbol`: invokeDateStatic
- `kind`: value
- `evidence`: Implementation comment: "Date.parse / Date.UTC are guest JavaScript semantic adapters. Date.now is dispatched effectfully by Interpreter through the Clock-backed DateTime.now." `DirectDateStatic` omits `"now"`. `invokeDateMethod` mutates `value.time`; `toISOString` throws `RangeError` on non-finite time while `toJSON` returns `null`. None of this is JSDoc. No `@see` between `invokeDateStatic`, `invokeDateMethod`, and `dateSetterArgumentCount`.
- `impact`: Callers wiring stdlib into the interpreter will try to route `Date.now` through `invokeDateStatic` and skip the Clock.
- `suggestedFix`: Promote the Clock comment into `**Gotchas**` on `invokeDateStatic`. On `invokeDateMethod`, document in-place `time` mutation and ISO vs JSON invalid-time behavior. Described `@see` among the three owning symbols.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-029: `invokeJsonMethod` two-paragraph lead; native JSON Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.json.ts:26
- `symbol`: invokeJsonMethod
- `kind`: value
- `evidence`: Doc block has two paragraphs (law: exactly one lead). Second paragraph is Details/Gotchas: native `JSON.parse`/`stringify` preserve reviver/replacer order, sparse-array omission, and native errors; schema codecs cannot. Further undocumented: circular structures throw `TypeError`; `CodeModeDate`/`CodeModeURL` have `toJSON` behavior; values copy in/out through `copyIn`/`copyOut`.
- `impact`: Host code may swap in Schema JSON codecs and break guest revivers; circular guest objects become interpreter failures without docs.
- `suggestedFix`: Single lead ("Guest JSON.parse/stringify adapter with reviver and replacer callbacks"). Move native-vs-schema rationale to `**Details**`. `**Gotchas**` for circular stringify, Date/URL `toJSON`, copyIn/copyOut. `@see {@link copyIn}` / `{@link copyOut}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-030: Math extras ignored; `random`/`sumPrecise` not in `invokeMathMethod`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.math.ts:31
- `symbol`: invokeMathMethod
- `kind`: value
- `evidence`: Comment: extra arguments are ignored so built-ins work as `(element, index, array)` callbacks; missing consumed args become `NaN`. `DirectMathMethod` omits `random` and `sumPrecise`. `invokeMathSumPrecise` requires a synchronous iterable of numbers and TypeErrors otherwise.
- `impact`: Interpreter authors will pass `random` into `invokeMathMethod` (type-excluded) or feed async iterables to `sumPrecise`.
- `suggestedFix`: `**Gotchas**` on extra/missing args. `@see {@link invokeMathSumPrecise}` from `invokeMathMethod` and vice versa; mention that `Math.random` is Clock/random-sourced elsewhere, like `Date.now`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-031: `Object.*` rejects Promises, prototypes, and blocked keys

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.object.ts:31
- `symbol`: invokeObjectMethod
- `kind`: value
- `evidence`: Un-awaited `CodeModePromise` throws `InvalidDataValue` ("await it before inspecting"). Other `isCodeModeValue` inputs become `{}`. Non-`Object.prototype` prototypes are rejected. `assign`/`fromEntries` throw on `isBlockedMember` keys. `objectMethodsPreservingIdentity` is `assign`/`values`/`entries`/`fromEntries` — identity-preserving vs copying is not documented. No `@see` to `invokeObjectFromEntries`.
- `impact`: Guest `Object.keys(promise)` looks like a data bug rather than a missing `await`; blocked `__proto__` keys fail only at runtime.
- `suggestedFix`: `**Gotchas**` on Promise, CodeMode values, prototype, blocked keys. `@see {@link invokeObjectFromEntries}` and `{@link objectMethodsPreservingIdentity}` for the identity-preserving subset including `fromEntries`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-032: RegExp undefined pattern, lastIndex, blocked groups

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.regexp.ts:53
- `symbol`: toHostRegex
- `kind`: value
- `evidence`: Comment: "Native parity: an undefined pattern behaves as an empty pattern." Invalid string patterns throw `SyntaxError` including `escapeRegexHint`. `invokeRegExpMethod` copies `lastIndex` onto the host regex for `global`/`sticky` and restores it for non-stateful flags. `matchToValue` drops `isBlockedMember` group names. `invokeRegExpStatic` ignores its name and only implements `RegExp.escape`.
- `impact`: Guest `String.match(undefined)` becoming `/(?:)/` and named-group filtering are surprising without Gotchas; `invokeRegExpStatic` looks like a general static dispatcher.
- `suggestedFix`: `**Gotchas**` on `toHostRegex` (undefined → empty; hint text). On `invokeRegExpMethod`, document lastIndex for global/sticky. On `invokeRegExpStatic`, state it is `RegExp.escape` only. `@see` among `toHostRegex`, `matchToValue`, `escapeRegexHint`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-033: `URL.parse` returns null; `invokeURLMethod` always `href`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.url.ts:83
- `symbol`: invokeURLStatic
- `kind`: value
- `evidence`: Empty args throw `TypeError`. `canParse` returns boolean; `parse` returns `CodeModeURL` or `null` (catch does not throw). `urlArgument` accepts `CodeModeURL` or data; `uriArgument` always stringifies through `boundedData`. `invokeURLMethod` ignores `_name` (`toString`/`toJSON`) and always returns `value.url.href`. `urlWritableProperties` omits `origin`. No `@see` among `uriArgument` / `urlArgument` / the two invokers.
- `impact`: Callers expecting `URL.parse` to throw, or `toJSON` to differ from `href`, will mis-handle failures and serialization.
- `suggestedFix`: `**Gotchas**` on `invokeURLStatic` (canParse vs parse-or-null). On `invokeURLMethod`, state both methods return `href`. `@see {@link uriArgument}` vs `{@link urlArgument}` (URL instance passthrough).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-034: Guest coercion comments must become Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.value.ts:157
- `symbol`: coerceToNumber
- `kind`: value
- `evidence`: Comments already warn: arrays coerce via `coerceToString` because host `Number(array)` hits null-prototype `ToPrimitive` throws (160–162); `Number()` with no args is `0`, unlike `Number(undefined)` (178); `String()` must not `boundedData` error-branded SafeObjects or the guest brand is stripped (180–184); `Error.prototype.toString` empty-name/message rules (140). `createErrorValue` uses a unique `ErrorBrand` symbol. None of this is JSDoc. No `@see` among `coerceToString`, `coerceToNumber`, `invokeCoercion`, `createErrorValue`.
- `impact`: Interpreter authors who `boundedData` an error value before `String()` will print `[object Object]` instead of `TypeError: …`.
- `suggestedFix`: Move each comment into `**Gotchas**` on the owning symbol. `@see` `invokeCoercion` ↔ `coerceToString`/`coerceToNumber` ↔ `createErrorValue`/`errorBrandName`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-035: Stdlib exported LiteralKits lack `$I.annoteSchema` and same-name aliases

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: codemode/stdlib/StdLib.value.ts:24
- `symbol`: BinaryOperator
- `kind`: value
- `evidence`: Annotation law: exported non-class schemas take `$I.annoteSchema` (or `.annotate($I.annote)` for LiteralKit) and a same-name `export type X = typeof X.Type`. No stdlib file creates `$ScratchpadId`. Gaps: `mathConstants`, `numberConstants`, `objectMethodsPreservingIdentity`, `regexpProperties`, `urlProperties`, `urlWritableProperties`, `valueConstructors` (no annote, no type alias); `BinaryOperator`, `AppliedBinaryOperator`, `LogicalOperator`, `UnaryOperator`, `LogicalAssignmentOperator`, `AssignmentOperator` (type alias present, no annote); `CompoundOperator` aliased as `CompoundAssignmentOperator` (not same-name); `UpdateOperator` aliases `.Encoded` rather than documenting both Type and Encoded. OpenAPI files already annotate and are out of scope for this item.
- `impact`: Schema identity and docgen annotation presence fail for every stdlib kit; `CompoundAssignmentOperator` will not be recognized as the `CompoundOperator` companion.
- `suggestedFix`: Add `const $I = $ScratchpadId.create("codemode/stdlib/...")` per file. `.annotate($I.annote("Name", { description }))` on each exported LiteralKit. Export `export type Name = typeof Name.Type` immediately after. Rename or add `CompoundOperator` type companion; keep `CompoundAssignmentOperator` only if it stays an Encoded alias with its own type-level docs linking `CompoundOperator`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-openapi-stdlib-R1-036: `formatConsoleMessage` depth, circular, and method prefixes

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: codemode/stdlib/StdLib.console.ts:29
- `symbol`: formatConsoleMessage
- `kind`: value
- `evidence`: `warn`/`error`/`debug` get `[warn]`/`[error]`/`[debug]` prefixes; `dir` formats only the first argument (or `"undefined"`); `table` is TSV with `(index)` plus optional columns. Depth > 32 becomes `"..."`; cycles `"[Circular]"`; runtime refs `"[opaque reference]"`; promises `"[Promise (await it to get its value)]"`. None of this is JSDoc. No `@see {@link ConsoleMethod}` (owning declaration in `Codemode.method-names.ts`).
- `impact`: Host log sinks will not know why `console.dir` dropped extra args or why a Promise printed the await hint.
- `suggestedFix`: `**Gotchas**` for prefixes, `dir`/`table` shapes, depth 32, circular/opaque/Promise. Described `@see {@link ConsoleMethod}` for the method kit (do not re-document the re-export).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-openapi-stdlib
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives

- `codemode/stdlib/StdLib.console.ts:23` `ConsoleMethod` (`value/re-export`): local `export { ConsoleMethod }` of an imported name is a graph edge. Census counted it as owning (`missing-summary|missing-required-tags`). Document the owning LiteralKit in `codemode/Codemode.method-names.ts`, not a second Example here.

No type-level export in this filter was required to have an Example. OpenAPI `$I.annote*` presence is confirmed (not a miss). Module headers on the four OpenAPI files are present and were not re-opened as mechanical misses.

---

## Pack verdict

- files reviewed: 15
- owning exports reviewed: 123
- confirmed mechanical items: 15
- editorial items: 21
- rejected false positives: 1
- accepted findings: 36
