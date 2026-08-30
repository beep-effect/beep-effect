# Round 2 inventory — pack `codemode`

Independent re-review of **all** `scratchpad/codemode/` exporting modules.
Mechanical census after round-1 fixes: `openModuleCount: 0`, `openOwningExportCount: 0`
(census-summary `codemode`: 34 modules, 353 owning exports). Zero `@example` /
`@remarks` / `@module` / `@template` remain.

This round hunted residual issues only:

1. Missing titled `**Example**` on value-level owning exports
2. Non-canonical `@category` slugs
3. Missing `$I.annote` / `$I.annoteSchema` on **exported** LiteralKits

No source was edited.

## Files reviewed (34)

Root: `Codemode.data.ts`, `Codemode.method-names.ts`, `Codemode.result.ts`,
`Codemode.service.ts`, `Codemode.tool-error.ts`, `Codemode.tool-runtime.ts`,
`Codemode.tool-schema.ts`, `Codemode.values.ts`, `index.ts`.

Interpreter: `interpreter/index.ts`, `Interpreter.errors.ts`,
`Interpreter.execute.ts`, `Interpreter.iterator.ts`, `Interpreter.methods.ts`,
`Interpreter.model.ts`, `Interpreter.promises.ts`, `Interpreter.references.ts`,
`Interpreter.runtime.ts`, `Interpreter.scope.ts`.

OpenAPI: `openapi/index.ts`, `OpenAPI.runtime.ts`, `OpenAPI.specification.ts`,
`OpenAPI.types.ts`.

Stdlib: `stdlib/index.ts`, `StdLib.console.ts`, `StdLib.date.ts`, `StdLib.json.ts`,
`StdLib.math.ts`, `StdLib.number.ts`, `StdLib.object.ts`, `StdLib.regexp.ts`,
`StdLib.string.ts`, `StdLib.url.ts`, `StdLib.value.ts`.

Owning exports reviewed: **353** (current census). Re-export graph edges
(`index.ts` barrels, `export { ConsoleMethod }`, `dateMethods`/`dateStatics`,
`objectStatics`, `mathMethods`, `arrayStatics`, `export type { SafeObject }`)
were not treated as documentation subjects.

## Hunt results

### Missing Examples on values

No residual misses. Every value-level owning export in this pack has a titled
`**Example** (Title)` with a single `ts` fence and an observable result
(membership guard, decode, construct, dispatch, or Effect run). Pure type-level
companions (same-name aliases, `.Encoded`, `ExecuteOptions` / `Options` /
`Runtime` / `Services` / `ToolCallHooks` / `AuthResolver` / iterator runner
types, `export declare namespace ToolError`) have prose + `@category` + `@since`
and correctly omit an Example.

No placeholder `import { fn }; console.log(fn)` Examples, no `void` discards,
no `@effected/*` imports, no named `Schema`/`Option`/`Array`/`Predicate`/`Record`
imports inside Examples.

### Non-canonical categories

Every `@category` observed in the pack is a canonical slug from
`packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`. Observed
set: `assertions`, `clients`, `combinators`, `constants`, `constructors`,
`decoding`, `diagnostics`, `encoding`, `error-handling`, `errors`, `factories`,
`formatting`, `getters`, `guards`, `interop`, `mapping`, `models`, `parsing`,
`predicates`, `schemas`, `serialization`, `services`, `symbols`, `type-level`,
`utilities`, `validation`, `workflows`.

No topology slugs (`exports`, `core`, `modules`, `generated`, `presentation`,
`execution`, `runtime`, `helpers`).

### Missing `$I` on LiteralKits

Every **exported** `LiteralKit` / `MappedLiteralKit` carries identity via
`.annotate($I.annote(...))` or `.pipe($I.annoteSchema(...))`, including
method-name kits, stdlib operator/constant kits, OpenAPI `HttpMethod` /
`ParameterLocation` / `InputLocation` / `InputStyle` / `BodyMode` /
`SchemaDirection`, `CopyOutMode`, `ToolRuntimeErrorKind`, and interpreter model
kits (`GeneratorRequestKind`, `PromiseMethodName`, `DiagnosticKind`, …).

## Rejected (not opened)

- **Unexported dispatch LiteralKits without `$I`** (16 file-local kits:
  `DirectStringMethod`, `CallbackArrayMethod`, `DirectArrayMethod`,
  `DirectArrayStatic`, `SetOperationMethod`, `StatementNodeType`,
  `ExpressionNodeType`, `DirectDateStatic`, `DirectMathMethod`,
  `DirectObjectMethod`, `EncodedPathPunctuation`, `ignoredHeaderParameters`,
  `HiddenKeyword`, `nestedSchemas`, `nestedSchemaLists`, `nestedSchemaMaps`).
  REVIEW-BRIEF scopes `$I` / same-name aliases to **exported** schemas. Census
  does not inventory these. Not a residual owning-export miss.
- **`interpreter/index.ts` module header.** Star-export barrel,
  `owningExportCount: 0`. Census skips module-header rules when there are no
  owning exports. Round 1 treated it as n/a. `stdlib/index.ts` is documented
  because round 1 chose to; that is not new evidence to reopen the interpreter
  barrel.
- **`export declare namespace ToolError` without an Example.** Ambient
  namespace is type-level; Example optional. Nested `ToolError.Encoded` is not
  a module-level owning export.
- **`arrayMethods` / `ArrayMethod` naming (not same-name `arrayMethods`).**
  Closed in round 1 as the PascalCase member-type companion used by the
  interpreter. Do not reopen.
- **Kit-membership Examples** (`kit.is.map("map")`, `S.is(mathConstants)("PI")`).
  Observable use of the kit, not vacuous placeholders.

## Pack verdict

- files reviewed: 34
- owning exports reviewed: 353
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 5
- accepted findings: 0

Reviewed every exporting module and every owning export. No residual missing
value-level Examples, no non-canonical `@category` values, and no missing `$I`
on exported LiteralKits. Accepted findings: 0.
