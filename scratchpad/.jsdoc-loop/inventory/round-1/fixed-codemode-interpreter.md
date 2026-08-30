# Round 1 fix report — pack `codemode-interpreter`

Slice: `scratchpad/codemode/interpreter/**` only. Runtime behavior unchanged.
Barrel `index.ts` left undocumented (re-export graph; census `owningExportCount: 0`).
`Interpreter.methods.ts` `export { arrayStatics }` left undocumented (re-export).

## Changed files

- `scratchpad/codemode/interpreter/Interpreter.errors.ts`
- `scratchpad/codemode/interpreter/Interpreter.execute.ts`
- `scratchpad/codemode/interpreter/Interpreter.iterator.ts`
- `scratchpad/codemode/interpreter/Interpreter.methods.ts`
- `scratchpad/codemode/interpreter/Interpreter.model.ts`
- `scratchpad/codemode/interpreter/Interpreter.promises.ts`
- `scratchpad/codemode/interpreter/Interpreter.references.ts`
- `scratchpad/codemode/interpreter/Interpreter.runtime.ts`
- `scratchpad/codemode/interpreter/Interpreter.scope.ts`

Module headers (`@packageDocumentation`, `@since 0.0.0`, useful lead) added on every exporting file except the barrel and the already-compliant `Interpreter.model.ts` header.

Owning-export metadata (grep, post-edit):

- `@category` on owning exports: 113 / 113
- `@since 0.0.0` on owning exports + 9 module headers: 122
- `@packageDocumentation`: 9 (all owning modules)
- titled `**Example** (Title)`: 89 (every value-level export)
- type companions: prose + described `@see` + `@category type-level` + `@since 0.0.0`, no Example
- no `@example` / `@remarks` / `@module` / `@template`
- no bare `@see`

`$I` / `$I.annote` / `$I.annoteSchema` already present; no annotation gap.

Example imports use `../../../codemode/...` (docgen examples dir) or `@beep/scratchpad/codemode` for public `CodeMode` types.

## Items closed

| ID | Status | Notes |
| --- | --- | --- |
| R1-001 | closed | errors module header; 4 values documented |
| R1-002 | closed | `executeWithLimits` workflows + Example |
| R1-003 | closed | iterator module; types type-level; `preserveConsumerError` Example |
| R1-004 | closed | methods module; types + 6 values; `arrayStatics` not documented |
| R1-005 | closed | model.ts 78 remaining owning exports |
| R1-006 | closed | promises module; `PromiseRuntime` services |
| R1-007 | closed | references module; schema + walks |
| R1-008 | closed | `Interpreter` services + `run` Example |
| R1-009 | closed | `ScopeStack` constructors + reserve/initialize Example |
| R1-010 | closed | Gotchas on `executeWithLimits` (suspend, empty ParseError, wrapper, timeout-as-success, warning-first truncation, separate budgets) |
| R1-011 | closed | guest vs host `@see` / Gotchas on error helpers |
| R1-012 | closed | close-must-not-replace-consumer-cause Gotcha |
| R1-013 | closed | admission vs invocable; blocked globals; Date setter snapshot; `@throws` |
| R1-014 | closed | wrapper-adjusted locations; captured-scope identity; `InterpreterFailure` Details; `tryInterpreter` vs `asNode` |
| R1-015 | closed | observation/interrupt; empty `race`; `@throws` on `constructPromise` |
| R1-016 | closed | CodeMode-values-are-data; typeof constructor vs Math/JSON/console; cycle `@throws` |
| R1-017 | closed | shadowing frame, implicit async, construct-without-new, ISO Date |
| R1-018 | closed | reserve→initialize vs declare; const/TDZ/empty-stack `@throws` |
| R1-019 | closed | same-name type companions `@category type-level` + described `@see` (incl. `AstNode` / `ProgramNode`) |
| R1-020 | closed | `@throws` on sync AST readers, `rejectCircularInsertion`, `invokeGlobalMethod`, `applyCollectionCallback`, `constructPromise`, `ScopeStack` |

## Residual risk

- Example compilation is not proven in this fixer session until `bun run --cwd scratchpad docgen` / `bun run docgen:local -- --package scratchpad` runs. Likely first-fail sites: `ExecutionLimits.make({})`, `AstNode.fromUnknown`, `*.cases.*.make`, `Fiber.await` flatten, and `Scope.make()` in Promise/Interpreter examples.
- `{@link}` targets that live in another file (e.g. `sourceLocation` from execute, `invokeArrayFrom` from iterator) are described but not typechecked by census.
- `index.ts` remains a star-export barrel (intentional; not an open module).

## Commands run

- Mechanical census by export/`@category`/`@since`/`**Example**`/`@packageDocumentation` greps over `scratchpad/codemode/interpreter/**` (113 owning `@category`, 89 titled Examples, 9 module headers).
- `bun scratchpad/.jsdoc-loop/census.ts` — **not executed in this session** (no shell tool). Parent should run it and confirm interpreter modules/`owning` findings are empty.
- `bun run docgen:local -- --package scratchpad` (or `bun run --cwd scratchpad docgen`) — **not executed in this session**. Required before merge to prove Example compilation.
