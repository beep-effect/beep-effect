# Round 1 fixer report — pack `codemode-root`

Slice: `scratchpad/codemode/Codemode.*.ts` and `scratchpad/codemode/index.ts`. Interpreter, stdlib, and OpenAPI were not touched.

## Changed files

- `scratchpad/codemode/Codemode.data.ts`
- `scratchpad/codemode/Codemode.method-names.ts`
- `scratchpad/codemode/Codemode.result.ts`
- `scratchpad/codemode/Codemode.service.ts`
- `scratchpad/codemode/Codemode.tool-error.ts`
- `scratchpad/codemode/Codemode.tool-runtime.ts`
- `scratchpad/codemode/Codemode.tool-schema.ts`
- `scratchpad/codemode/Codemode.values.ts`

`scratchpad/codemode/index.ts` was already a barrel with a compliant module header and zero owning exports. Left unchanged.

Runtime bodies were not rewritten except JSDoc, `$I` identity annotations on method-name LiteralKits, and the missing `export type IdentifierSegment` companion.

## Items closed

| Id | Status |
| --- | --- |
| `codemode-root-R1-001` | closed — `DataValue` titled Example + `@category schemas` / `@since 0.0.0`; type companion decoded-value prose, described `@see`, `@category type-level` |
| `codemode-root-R1-002` | closed — all 41 owning exports documented (LiteralKits + type companions + `DateSetterArity`) |
| `codemode-root-R1-003` | closed — file-local `$I = $ScratchpadId.create("codemode/Codemode.method-names")`; every LiteralKit `.annotate($I.annote(...))`; `dateMethods` Gotchas + `@see DateSetterName`; `DateSetterArity` Gotchas (max optional-argument counts) |
| `codemode-root-R1-004` | closed — all 11 result owning exports have `@category` / `@since`; value-level titled Examples |
| `codemode-root-R1-005` | closed — described `@see` pairs `Result` ↔ `ResultModel`, `Diagnostic` ↔ `DiagnosticModel`, `encodeResultModel` ↔ both; `encodeResultModel` Gotchas that `orDie` is a defect |
| `codemode-root-R1-006` | closed — `ExecutionLimits` / `InvalidExecutionLimits` Examples; `execute` / `make` / `resolveExecutionLimits` Examples + tags; types `@category type-level` |
| `codemode-root-R1-007` | closed — `execute` ↔ `make` ↔ `ToolRuntime.make` / `emptyToolkit`; Option-owned defaults; frozen `InvalidExecutionLimits` message |
| `codemode-root-R1-008` | closed — `ToolError` class Example (`new` + `is`); namespace `@category type-level` without a titled Example |
| `codemode-root-R1-009` | closed — class lead from `$I.annote`; `@category errors`; Encoded `@category type-level` + described `@see`; omitted `cause` → `O.none()` Gotchas |
| `codemode-root-R1-010` | closed — all 31 owning tool-runtime exports documented with canonical `@category` / `@since` / kind-required Examples |
| `codemode-root-R1-011` | closed — `copyIn` second paragraph folded into Details; `@throws` + Gotchas on `copyIn` / `copyOut`; `@see` among `copyIn` ↔ `copyOut` ↔ `CopyOutMode` ↔ `isBlockedMember` |
| `codemode-root-R1-012` | closed — `@see` among `prepare` / `searchIndex` / `make` / `emptyToolkit`; Gotchas on `keys` throw, one-input-object, `failureMode`; succeeded/interrupted `message` uninhabited; `SearchInput` default page size 10 |
| `codemode-root-R1-013` | closed — all 8 tool-schema owning exports tagged and exemplified |
| `codemode-root-R1-014` | closed — `export type IdentifierSegment`; renderer Gotchas (`"unknown"` fallback, `decoded` → `S.toType`, `outputTypeScript` unions only for `failureMode === "return"`) |
| `codemode-root-R1-015` | closed — values module header (`@packageDocumentation` / `@since 0.0.0`); class / union / guard Examples; type companion tags |
| `codemode-root-R1-016` | closed — class `@category` is `models` (not `runtime`); identity Gotchas; `@see` among union members, `isCodeModeValue` vs excluded `CodeModePromise`, `CodeModeURL` ↔ `CodeModeURLSearchParams` |

## Residual risk

- Census still classifies `export declare namespace ToolError` as `value` and will keep flagging missing `@example`. Law: namespaces are type-level; no titled Example was added (rejected false positive in the inventory).
- `Codemode.method-names.ts` and `Codemode.values.ts` are not barrel-exported. Their Examples import via `../../../codemode/Codemode.*.ts` so extracted docgen example files under `.jsdoc-loop/generated-docs/examples/` can resolve them without a barrel change. Hover copy-paste from those files is therefore not `@beep/scratchpad/codemode`.
- Barrel-exported symbols use `@beep/scratchpad/codemode`. `scratchpad/docgen.json` `examplesCompilerOptions.paths` are written as `../../codemode/index.ts`, which is correct only if TypeScript resolves them from `generated-docs/` rather than `generated-docs/examples/`. If example tsc cannot resolve the alias, switch those imports to `../../../codemode/index.ts` rather than adding re-exports.
- Nested `ToolError.Encoded` is not a module-level owning export; it was still upgraded to `@category type-level` with a described `@see`.
- `CodeModeRegExp.lastIndex` is an instance getter. Docgen `enforceExamples` inventories getters, so it received a titled Example. The setter is undocumented by parser design.

## Commands run

Not executed in this subagent: no shell tool was available in the fixer session.

Parent / follow-up should run:

```bash
bun scratchpad/.jsdoc-loop/census.ts
bun run docgen:local -- --package @beep/scratchpad
zsh -ic 'tsgo -p scratchpad/codemode/tsconfig.json --noEmit --pretty false'
```

Then confirm census open owning exports for the eight root files (plus `index.ts`) are empty except the known `ToolError` namespace `@example` false positive.
