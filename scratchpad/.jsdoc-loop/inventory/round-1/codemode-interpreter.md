# Round 1 inventory — pack `codemode-interpreter`

Slice: `scratchpad/codemode/interpreter/` only (from pack `codemode`).
Census confirmed: every owning export in this filter is mechanically open except
two type companions in `Interpreter.model.ts` (`AstNode`, `ProgramNode`) that
already carry lead + `@category` + `@since`. No source was edited.

## Files reviewed

| File | Owning | Module header | Notes |
| --- | --- | --- | --- |
| `scratchpad/codemode/interpreter/index.ts` | 0 | n/a (barrel) | Re-export graph only |
| `scratchpad/codemode/interpreter/Interpreter.errors.ts` | 4 | missing | All values open |
| `scratchpad/codemode/interpreter/Interpreter.execute.ts` | 1 | missing | `executeWithLimits` |
| `scratchpad/codemode/interpreter/Interpreter.iterator.ts` | 3 | missing | 2 types + 1 value |
| `scratchpad/codemode/interpreter/Interpreter.methods.ts` | 8 | missing | +1 re-export, not owning |
| `scratchpad/codemode/interpreter/Interpreter.model.ts` | 80 | present | 78 open; 2 types tagged |
| `scratchpad/codemode/interpreter/Interpreter.promises.ts` | 8 | missing | All open |
| `scratchpad/codemode/interpreter/Interpreter.references.ts` | 7 | missing | Schema + walks |
| `scratchpad/codemode/interpreter/Interpreter.runtime.ts` | 1 | missing | `Interpreter` class |
| `scratchpad/codemode/interpreter/Interpreter.scope.ts` | 1 | missing | `ScopeStack` |

Owning exports reviewed: **113**. Re-exports not documented: `index.ts` star
exports; `Interpreter.methods.ts` `export { arrayStatics }`.

---

### codemode-interpreter-R1-001: Interpreter.errors.ts missing module header, tags, and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.errors.ts:1
- `symbol`: Interpreter.errors
- `kind`: module
- `evidence`: Module lacks useful lead, `@packageDocumentation`, `@since 0.0.0`. Owning values all have one-line leads but miss `@category`, `@since`, and a titled Example: `normalizeError` (47, value/const), `caughtErrorValue` (102, value/const), `constructErrorValue` (118, value/const), `constructAggregateErrorValue` (123, value/const). Census `missing-required-tags` confirmed; not a false positive (JSDoc sits on the `export const`).
- `impact`: Callers cannot tell host diagnostics (`normalizeError`) from guest Error objects (`caughtErrorValue` / constructors). The ratchet counts four undocumented values plus an open module.
- `suggestedFix`: Add a module header describing guest/host error bridging. Document each export with a purpose lead (not a name echo), `@category error-handling` for `normalizeError`, `@category mapping` for `caughtErrorValue`, `@category constructors` for the two constructors, `@since 0.0.0`, and one titled observable Example per value. See R1-011 for sibling `@see` / Gotchas to include while touching the file.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-002: Interpreter.execute.ts missing module header, summary, tags, and Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.execute.ts:35
- `symbol`: executeWithLimits
- `kind`: value
- `evidence`: Module lacks lead / `@packageDocumentation` / `@since 0.0.0`. Sole owning export `executeWithLimits` (35, value/const) census `missing-summary|missing-required-tags` (`@category`, `@since`, titled Example). Confirmed: no JSDoc on the export.
- `impact`: This is the public entry that parses, evaluates, copies out, times out, and truncates guest programs. Without a lead or Example, callers cannot assemble `ExecuteOptions` + `ExecutionLimits` or interpret `ResultModel` success-with-timeout vs failure.
- `suggestedFix`: Module header for the limit-aware execute path. Document `executeWithLimits` with a purpose lead, `@category workflows`, `@since 0.0.0`, and one titled Example that runs a tiny program to a `SuccessModel` value (and optionally empty-code `ParseError`). Fold R1-010 Gotchas into the same block.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-003: Interpreter.iterator.ts missing module header, tags, and Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.iterator.ts:4
- `symbol`: Interpreter.iterator
- `kind`: module
- `evidence`: Module lacks lead / `@packageDocumentation` / `@since 0.0.0`. Owning exports, all `missing-summary|missing-required-tags`: `IteratorCursor` (4, type), `SyncIteratorRunner` (9, type), `preserveConsumerError` (14, value/const). Types miss `@category` + `@since` only; value also misses a titled Example. Census did not demand an Example on the types — keep that split.
- `impact`: Collection helpers (`invokeArrayFrom`, `invokeGroupBy`, `constructAggregateErrorValue`) take `SyncIteratorRunner`. Undocumented types hide the close-on-failure contract of `preserveConsumerError`.
- `suggestedFix`: Module header for guest iterator consumption. Types: useful prose, `@category type-level`, `@since 0.0.0`, described `@see`. Value: lead, `@category error-handling`, `@since 0.0.0`, titled Example showing a failed consumer still surfaces its original cause. Fold R1-012 Gotcha into the value block.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-004: Interpreter.methods.ts missing module header, tags, and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.methods.ts:90
- `symbol`: Interpreter.methods
- `kind`: module
- `evidence`: Module lacks lead / `@packageDocumentation` / `@since 0.0.0`. Owning exports, all `missing-summary|missing-required-tags`: types `CallbackRunner` (90), `SupportedCallback` (104) miss `@category`+`@since`; values `isSupportedCallback` (129), `invokeIntrinsic` (137), `invokeGlobalMethod` (228), `invokeArrayFrom` (462), `invokeGroupBy` (498), `applyCollectionCallback` (657) miss those plus a titled Example. `export { arrayStatics }` at 415 is a re-export — not owning; do not document it here.
- `impact`: This file is the dispatch surface for guest intrinsics vs globals vs collection callbacks. Callers will pick `invokeGlobalMethod` for `Array.from` / `Object.groupBy` and get "not available" unless docs point at the dedicated Effect helpers.
- `suggestedFix`: Module header for intrinsic/global/collection dispatch. Types `@category type-level`; `isSupportedCallback` `@category guards`; invoke helpers `@category combinators`; all `@since 0.0.0`. One titled Example per value (callback admission, a blocked global, `Array.from` over an iterable). Fold R1-013 Gotchas/`@see` into the same blocks.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-005: Interpreter.model.ts owning exports missing required tags and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.model.ts:59
- `symbol`: Interpreter.model
- `kind`: module
- `evidence`: Module header is already present (`@packageDocumentation`, `@since 0.0.0`, useful lead) — do not rewrite it. 80 owning exports; 78 still open. Miss classes: (1) Value schemas/classes with lead+`@category`+`@since` but no titled Example — `SourcePosition` (59), `SourceLocation` (81), `AstNode` (129), `ProgramNode` (156), `RuntimeReference` (828), `InterpreterRuntimeError` (891), `InterpreterFailure` (938). (2) Values with a one-line lead (or none) missing `@category` `@since` and Example — `Binding` (178), `Scope` (196), `StatementNone` (209), `StatementReturn` (220), `StatementBreak` (232), `StatementContinue` (248), `StatementResult` (264), `MemberReference` (291), `CodeModeFunction` (332, also missing-summary), `GeneratorRequestKind` (361), `CodeModeGenerator` (371), `GeneratorMethodKind` (394), `GeneratorMethodReference` (407), `IntrinsicMethod` (445, missing-summary), `IntrinsicReference` (504), `ComputedValue` (518), `PromiseNamespace` (533), `SymbolNamespace` (544), `AsyncIteratorSymbol` (554), `IteratorSymbol` (555), `IteratorSymbols` (556), `PromiseMethodName` (559), `PromiseMethodReference` (568), `PromiseInstanceMethodName` (580), `PromiseInstanceMethodReference` (588), `PromiseCapabilityFunction` (606), `GlobalNamespaceName` (620), `GlobalNamespace` (640), `GlobalMethod` (651), `GlobalMethodReference` (672), `JsonMethodName` (686), `JsonMethodReference` (694), `CoercionFunctionName` (705), `CoercionFunction` (721), `UriFunctionName` (732), `UriFunction` (745), `SearchFunction` (756), `ProgramThrow` (766), `GeneratorReturn` (778), `ErrorConstructorName` (791), `ErrorConstructorReference` (809), `DiagnosticKind` (860), `OptionalShortCircuit` (880), `supportedSyntaxMessage` (882), `tryInterpreter` (957), `unsupportedSyntax` (973), `isRecord` (981), `asNode` (983), `getArray` (991), `getString` (1000), `getBoolean` (1009), `getOptionalNode` (1018), `getNode` (1024), `sourceLocation` (1026), `formatLocation` (1034). (3) Type companions missing `@category` `@since` (Example not required) — `Scope` (206), `StatementResult` (277), `GeneratorRequestKind` (368), `GeneratorMethodKind` (404), `IntrinsicMethod` (501), `PromiseMethodName` (566), `PromiseInstanceMethodName` (586), `GlobalNamespaceName` (638), `GlobalMethod` (670), `JsonMethodName` (692), `CoercionFunctionName` (719), `UriFunctionName` (743), `RuntimeReference` (857), `DiagnosticKind` (878), `InterpreterFailure` (953). Compliant (do not churn): type `AstNode` (148) and type `ProgramNode` (175). `$I.annote` / `$I.annoteSchema` already present on exported schemas.
- `impact`: The entire guest runtime vocabulary is undocumented for docgen. Value-level schemas and unique symbols fail the kind-split Example law; type companions fail the required-tag law.
- `suggestedFix`: One pass over the file. Classes/unions/LiteralKits: `@category models` (errors for `InterpreterRuntimeError` / `InterpreterFailure` / `ProgramThrow` / `GeneratorReturn`), unique symbols `@category symbols`, AST readers `@category parsing`, `tryInterpreter`/`unsupportedSyntax` `@category error-handling`, `isRecord` `@category guards`, `sourceLocation`/`formatLocation` `@category formatting`, all `@since 0.0.0`. Type companions: prose + described `@see` + `@category type-level` + `@since 0.0.0`, no Example. Every value gets one titled observable Example (construct/decode/match, not `console.log(fn)`). Fold R1-014 / R1-019 / R1-020 into the relevant blocks while touching them. Do not add empty When-to-use/Details.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-006: Interpreter.promises.ts missing module header, tags, and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.promises.ts:49
- `symbol`: Interpreter.promises
- `kind`: module
- `evidence`: Module lacks lead / `@packageDocumentation` / `@since 0.0.0`. Owning exports, all `missing-summary|missing-required-tags`: `PromiseRuntime` (49, value/class), `selfResolutionError` (138, value/const), `PromiseIdentity` (141, type), `resolvePromiseValue` (144), `resolvePromise` (181), `invokePromiseMethod` (196), `invokePromiseInstanceMethod` (325), `constructPromise` (373). Type misses `@category`+`@since` only.
- `impact`: Un-awaited rejection reporting, `Promise.race([])`, and constructor-executor checks live only in comments. Callers of `CallbackRunner` will misuse `markObserved` vs `create`.
- `suggestedFix`: Module header for guest Promise scheduling. `PromiseRuntime` `@category services`; `selfResolutionError`/`constructPromise` `@category constructors`; resolve/invoke helpers `@category combinators`; `PromiseIdentity` `@category type-level`; all `@since 0.0.0`. One titled Example per value. Fold R1-015 Gotchas into the same blocks. `@throws` on `constructPromise` (sync TypeError when the executor is not a `CodeModeFunction`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-007: Interpreter.references.ts missing module header, tags, and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.references.ts:22
- `symbol`: Interpreter.references
- `kind`: module
- `evidence`: Module lacks lead / `@packageDocumentation` / `@since 0.0.0`. Owning: `RuntimeReferenceValue` (22, value/const) has a lead, misses `@category` `@since` Example; type `RuntimeReferenceValue` (35) has a lead, misses `@category` `@since`; `isRuntimeReference` (37), `containsRuntimeReference` (65), `containsOpaqueReference` (86), `rejectCircularInsertion` (109), `typeofValue` (134) miss summary+tags+Example. Schema already has `$I.annoteSchema` and a same-name type alias.
- `impact`: `containsRuntimeReference` vs `containsOpaqueReference` is a caller-choice pair (CodeMode values are data in the latter). Without docs, copy-out and throw-message code will treat branded guest data as opaque.
- `suggestedFix`: Module header for identity-bearing guest values. Schema `@category schemas` + Example; type `@category type-level` + described `@see`; `isRuntimeReference` `@category guards`; contains-* `@category predicates`; `rejectCircularInsertion` `@category assertions` plus `@throws`; `typeofValue` `@category getters`. Fold R1-016 into those blocks.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-008: Interpreter.runtime.ts missing module header, tags, and Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.runtime.ts:417
- `symbol`: Interpreter
- `kind`: value
- `evidence`: Module lacks lead / `@packageDocumentation` / `@since 0.0.0`. Sole owning export `Interpreter` (417, value/class) census `missing-summary|missing-required-tags` (`@category`, `@since`, titled Example). Confirmed: class has no JSDoc. Implementation comments at 495, 524, 1639, 1669, 2391–2395 already encode caller-visible semantics.
- `impact`: This is the evaluator. Without a lead, callers of `executeWithLimits` cannot see that `run` wraps the program in an implicit async body, shadows builtins in a fresh frame, and adopts returned promises before copy-out.
- `suggestedFix`: Module header for the confined evaluator. Document the class with a purpose lead, `@category services`, `@since 0.0.0`, and one titled Example that constructs `Interpreter` with a `PromiseRuntime` and `run`s a tiny `ProgramNode` (or points at `executeWithLimits` if construction is too heavy — still show `run` producing a value). Fold R1-017 Gotchas/`@see` into the block.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-009: Interpreter.scope.ts missing module header, tags, and Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.scope.ts:13
- `symbol`: ScopeStack
- `kind`: value
- `evidence`: Module lacks lead / `@packageDocumentation` / `@since 0.0.0`. Sole owning export `ScopeStack` (13, value/class) has lead "Mutable stack of Effect hash maps containing immutable binding models." but misses `@category`, `@since`, titled Example. Census `missing-required-tags` confirmed. Methods `reserve`/`initialize`/`declare`/`get`/`set`/`current` throw `InterpreterRuntimeError` synchronously.
- `impact`: TDZ vs already-initialized `declare` is invisible from the class name. Callers will `declare` where they must `reserve` then `initialize`, or assign to `const`.
- `suggestedFix`: Module header for lexical scope. Document the class with a purpose lead (keep the immutable-binding fact), `@category constructors`, `@since 0.0.0`, titled Example showing reserve→initialize vs const assign TypeError. Fold R1-018 Gotchas and `@throws` into the block.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

### codemode-interpreter-R1-010: executeWithLimits — missing Gotchas already in implementation comments

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.execute.ts:51
- `symbol`: executeWithLimits
- `kind`: value
- `evidence`: Implementation comments the signature cannot show: "Allocate execution state inside suspension so reused Effects never share it." (51); "Set only after copy-out so timeouts cannot report invalid values as completed." (57); "Keep the timeout warning first so truncation preserves it." (145); "Warnings have a separate budget so result data cannot starve diagnostics." (311). Empty trimmed code short-circuits to `FailureModel` `ParseError` (40–49). TypeScript is wrapped as `async function __codemode__() { ... }` before Acorn parse (198). Copy-out uses `"nullify"` (96). Last top-level `ExpressionStatement` is the result (runtime 503–505). Timeout after successful copy-out yields `SuccessModel` with a leading `TimeoutExceeded` warning, not a failure (146–158).
- `impact`: Callers will treat timeout as always-failure, reuse a built Effect and leak logs/tool state, or blame Acorn coordinates that `sourceLocation` later rewrites.
- `suggestedFix`: On the `executeWithLimits` block, add a **Gotchas** section covering suspend-allocated state, empty-code ParseError, implicit async wrapper, copy-out-before-timeout-success, warning-first truncation, and separate warning vs value byte budgets. `@see` `{@link Interpreter}` for evaluation, `{@link PromiseRuntime}` for un-awaited rejection, `{@link ResultModel}` for the encoded result. Do not invent extra Examples once one observable Example exists.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-002
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-011: error helpers — missing described `@see` and guest vs host Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.errors.ts:47
- `symbol`: normalizeError
- `kind`: value
- `evidence`: Four sibling exports with no `@see`. `normalizeError` maps interpreter / Toolkit / guest / host failures to `DiagnosticModel` (46). `caughtErrorValue` unwraps `ProgramThrow` to the thrown guest value and otherwise builds a guest Error via `createErrorValue` (101–114). `constructErrorValue` uses `args[0]` coerced to string, empty message when missing (118–119). `constructAggregateErrorValue` requires a synchronous iterable or fails `TypeError` "expects a synchronous iterable of errors" (129–134). `normalizeError` maps host `RangeError` call-stack messages to "Execution exceeded the maximum nesting depth" (91–93) and `ProgramThrow` of a runtime reference to "a non-data value" (76–77). Leads for the constructors restate the name ("Constructs one guest Error value.").
- `impact`: A caller normalizing a catch for guest `try/catch` will publish a diagnostic object into the program; a caller constructing host diagnostics will emit a branded guest Error. AggregateError silently TypeErrors on async iterables.
- `suggestedFix`: Replace signature-echo leads. Cross-link with described `@see`: `normalizeError` for public diagnostics vs `caughtErrorValue` for guest catch bindings vs constructors for `new Error`. Gotchas: call-stack RangeError rewrite; runtime-reference throws render as "a non-data value"; AggregateError first argument must be a sync iterable. `@throws` is not needed on `normalizeError` (it never throws; `Result.try` fallback).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-001
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-012: preserveConsumerError — close failures must not replace the consumer cause

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.iterator.ts:14
- `symbol`: preserveConsumerError
- `kind`: value
- `evidence`: On success it returns the value; on failure it `Effect.exit(cursor.close)` then `Effect.failCause(exit.cause)` of the original consumer (18–21). Close errors are discarded. Used by `invokeArrayFrom` / `invokeGroupBy` mapper failures so iteration cleanup cannot mask a callback TypeError.
- `impact`: Without a Gotcha, a fixer or caller will `andThen(close, fail(consumer))` in the opposite order or surface close failures, changing guest-visible errors.
- `suggestedFix`: **Gotchas**: closing the cursor must not replace the consumer `Cause`; close is best-effort. `@see` `{@link SyncIteratorRunner}` for cursor production and `{@link invokeArrayFrom}` for the call site. Type `IteratorCursor` should `@see` `preserveConsumerError` for failure cleanup.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-003
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-013: methods dispatch — admission vs invocable, blocked globals, Effect vs sync

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.methods.ts:100
- `symbol`: isSupportedCallback
- `kind`: value
- `evidence`: Comment at 100–103: "Admission means dispatchable, not necessarily invocable: new-requiring constructors pass the gate and throw a TypeError on call, like JS." Comment at 132–133: Math/JSON/console stay non-callable; Array/Object/Date/RegExp construct. `invokeGlobalMethod` is **synchronous** and throws; it hard-rejects `Object.fromEntries`, `Object.groupBy`, `Math.random`, `Math.sumPrecise`, `Array.from`, `Date.now`, all `console.*`, all `Map.*` (228–256). Those live on `invokeArrayFrom` / `invokeGroupBy` (Effect) instead. Date setters snapshot `receiver.time` before coercing arguments whose callbacks may mutate the Date (170–180). String replace callbacks cannot be arbitrary host callables; wrap in an arrow (147–151). `applyCollectionCallback` throws immediately if the callback is a non-supported function (663–670).
- `impact`: Callers will invoke `invokeGlobalMethod` for `Array.from` and hit "is not available", or treat `isSupportedCallback(Map)` as "safe to call". Mixing the sync global helper with Effect intrinsic helpers will not typecheck the same way.
- `suggestedFix`: Gotchas on `isSupportedCallback` (admission ≠ call-safe). Gotchas on `invokeGlobalMethod` listing blocked names and that it throws rather than returning Effect. Described `@see` from `invokeGlobalMethod` to `invokeArrayFrom` / `invokeGroupBy`; from `invokeIntrinsic` to `applyCollectionCallback` and `isSupportedCallback`. `@throws` on `invokeGlobalMethod` and `applyCollectionCallback` (sync TypeError / InterpreterRuntimeError). Date-setter initialTime Gotcha on `invokeIntrinsic`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-004
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-014: model — wrapper-adjusted locations, captured-scope identity, closed failure channel

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.model.ts:1026
- `symbol`: sourceLocation
- `kind`: value
- `evidence`: `SourcePosition` annote already says "zero- or one-based parser source coordinate before CodeMode wrapper adjustment." `sourceLocation` then does `line: max(1, (start.line ?? 2) - 1)` and `column: max(1, (start.column ?? 4) - 3)` (1026–1031) to undo `async function __codemode__() {\n` wrapping in execute.ts:198. `CodeModeFunction` comment 307–308: "Captured scopes are runtime references, not serialized data. Validate the collection kind without rebuilding it so closures retain map identity." `InterpreterFailure` lead is two paragraphs (929–933); law requires exactly one lead paragraph — the second ("Arbitrary guest-thrown values remain data inside ProgramThrow; the Effect error channel itself is therefore closed") belongs in **Details**. `unsupportedSyntax` embeds `supportedSyntaxMessage` as both message suffix and suggestions array (973–978) with no `@see`. `tryInterpreter` captures sync throws into the closed channel; `asNode`/`get*` throw instead.
- `impact`: Diagnostics will be off-by-one if callers print raw Acorn `loc`. Rebuilding captured scopes as new maps breaks closure identity. A second lead paragraph fails the section grammar. Callers will wrap `getNode` in `tryInterpreter` or let `asNode` escape the Effect channel.
- `suggestedFix`: Gotcha on `sourceLocation`/`formatLocation` describing the wrapper offset; `@see` `SourcePosition` for unadjusted parser coords. Gotcha on `CodeModeFunction` about captured `MutableHashMap` identity. Split `InterpreterFailure` into one lead + **Details** about `ProgramThrow` staying data; `@see` `normalizeError` for public diagnostics. `@see` from `unsupportedSyntax` to `supportedSyntaxMessage`. `@see` from `tryInterpreter` to `asNode` explaining throw-vs-Result. Fold `@throws` (R1-020) onto the AST readers in the same pass.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-005
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-015: PromiseRuntime — observation, interrupt, thenable jobs, race([])

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.promises.ts:48
- `symbol`: PromiseRuntime
- `kind`: value
- `evidence`: Comment 48: "Observation only controls rejection reporting; program completion interrupts all promise work." Comment 63: allocate id before fork so reruns get distinct IDs. Comment 90: "Observation must be recorded when responsibility transfers, before the consumer fiber runs." Comment 120: interrupt loops because "a straggler can create promises before its interruption lands." `resolvePromiseValue` yields before invoking a thenable (162–163). `selfResolutionError` is the cycle TypeError. `invokePromiseMethod` `race` on an empty iterable fails with "Promise.race([]) would never settle" (279–285) instead of hanging. `constructPromise` **throws** (does not `Effect.fail`) when the executor is not a `CodeModeFunction` (379–384). Reaction handlers: teardown bypasses handlers; settled reactions yield once so handlers never run inline (443).
- `impact`: Missing `markObserved` turns awaited rejections into "Unhandled rejection from an un-awaited promise" diagnostics. A single `Fiber.interruptAll` without the while-loop leaks straggler promises. Callers wrapping `constructPromise` in `Effect.try` will miss a sync throw.
- `suggestedFix`: Gotchas on `PromiseRuntime` for observation-vs-interrupt, id-before-fork, interrupt-until-empty. Gotcha on `resolvePromiseValue` for thenable job delay and self-resolution. Gotcha on `invokePromiseMethod` for empty `race`. `@throws` on `constructPromise`. Described `@see` among `resolvePromise` / `resolvePromiseValue` / `constructPromise` / `selfResolutionError`. `@see` `{@link executeWithLimits}` for the timeout path that calls `interrupt()`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-006
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-016: reference walks — CodeMode values are data; typeof lies like JS namespaces

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.references.ts:65
- `symbol`: containsOpaqueReference
- `kind`: value
- `evidence`: Comment 85: "CodeMode values are data here, not opaque interpreter references." `containsRuntimeReference` returns true for `CodeModeValue` (via the union). `containsOpaqueReference` skips `isCodeModeValue` then tests `isRuntimeReference` (98–99). `rejectCircularInsertion` comment 107: "Reject cycles before mutation so later boundary walks remain safe"; throws `InvalidDataValue` when `current === container` (121–122); skips runtime references while walking. `typeofValue`: function-like `RuntimeReference`s and non-empty `ToolReference` paths are `"function"`; `GlobalNamespace` Math/JSON/console are `"object"`, constructors are `"function"` (134–150).
- `impact`: Using `containsRuntimeReference` in copy-out/throw rendering treats `CodeModeDate`/`Map` as illegal. Using host `typeof` on a `GlobalNamespace` reports `"object"` for everything. Inserting a cycle and catching later makes JSON/copy walks diverge.
- `suggestedFix`: Described `@see` pairing the two contains-* predicates and `typeofValue`. Gotchas quoting the CodeMode-values-are-data rule, constructor vs Math/JSON/console typeof, and pre-mutation cycle rejection. `@throws` on `rejectCircularInsertion`. Type `RuntimeReferenceValue` already has `{@link}` in the lead; add a described `@see` to the runtime schema per annotation-patterns.md.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-007
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-017: Interpreter class — shadowing, implicit async, construct-without-new, ISO Date

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.runtime.ts:417
- `symbol`: Interpreter
- `kind`: value
- `evidence`: Comment 495: "Keep top-level declarations separate so they can shadow builtins." Comment 524: "The implicit async body adopts returned promises before copy-out." Comment 1639: "Await always suspends, including for plain values." Comment 1669: "Array and Object construct identically with or without new, like JS." Comments 2391–2395: Array/Object/Date/RegExp may be called without `new`; Date-as-function formats ISO so timezone does not leak; Map/Set/URL/URLSearchParams require `new`; Math/JSON/console are not functions. Comment 530: tool-call promises fork at the call site so admission/hooks run when the call is made. Comment 542: fiber exits make settlement idempotent; yielding prevents inline continuation.
- `impact`: Guests (and host callers embedding `Interpreter` directly) will expect locale Date strings, hanging await on numbers, or `new Array` to differ from `Array(...)`. Shadowing `Promise` at top level is intentional and undocumented.
- `suggestedFix`: **Gotchas** on the class covering the extra scope frame, implicit async adoption, await-always-suspends, construct-without-new matrix, ISO Date, and call-site tool fork. Described `@see` `{@link executeWithLimits}` as the supported entry, `{@link ScopeStack}` for TDZ, `{@link PromiseRuntime}` for settlement, `{@link invokeCallable}` is private — link public `RuntimeReference` / `GlobalNamespace` instead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-008
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-018: ScopeStack — reserve/initialize TDZ vs declare, empty-stack throw

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.scope.ts:23
- `symbol`: ScopeStack
- `kind`: value
- `evidence`: `reserve` inserts an uninitialized binding and throws if the name exists (23–31). `initialize` requires a reserved uninitialized slot (34–47). `declare` requires absence and stores an initialized binding (50–59). `get`/`set` throw `ReferenceError` for unknown or TDZ names; `set` throws `TypeError` for const (61–100). `current` throws "Interpreter scope stack is empty." (110–118). Bindings themselves are immutable; updates replace the `Binding` value in a `MutableHashMap` (class lead).
- `impact`: Using `declare` for `let`/`const` hoisting skips TDZ and allows premature reads. Assigning to a reserved-but-uninitialized name should throw; a naive `set` after `reserve` currently throws "has not been reserved for initialization" only on `initialize`, while `set` throws "Cannot access before initialization" — both need to be stated.
- `suggestedFix`: **Gotchas** for the reserve→initialize protocol vs `declare`, const assignment, TDZ reads, and empty-stack `current()`. `@see` `{@link Binding}` and `{@link Scope}`. `@throws` listing `InterpreterRuntimeError` (ReferenceError/TypeError via `.as`). Lead already useful — keep it, do not echo "ScopeStack is a stack of scopes."
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-009
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-019: same-name schema type companions missing described `@see` and `@category type-level`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.model.ts:148
- `symbol`: AstNode
- `kind`: type
- `evidence`: Law/annotation-patterns require same-name type aliases to carry precise prose, a described `@see {@link Schema}` purpose phrase, `@category type-level`, `@since 0.0.0`, and no Example. Present: `AstNode` (148) and `ProgramNode` (175) use `@category models` and `{@link}` in the lead but no `@see` tag. Open types with only `/** Runtime type for {@link X}. */` (or no lead) and no tags: `Scope` (206), `StatementResult` (277), `GeneratorRequestKind` (368), `GeneratorMethodKind` (404), `IntrinsicMethod` (501), `PromiseMethodName` (566), `PromiseInstanceMethodName` (586), `GlobalNamespaceName` (638), `GlobalMethod` (670), `JsonMethodName` (692), `CoercionFunctionName` (719), `UriFunctionName` (743), `RuntimeReference` (857), `DiagnosticKind` (878), `InterpreterFailure` (953), plus `RuntimeReferenceValue` (references.ts:35), `PromiseIdentity` (promises.ts:141), `IteratorCursor` / `SyncIteratorRunner` / `CallbackRunner` / `SupportedCallback`. Census correctly did **not** require Examples on these types.
- `impact`: Hover on the type does not send the reader to the runtime schema/guard. Using `@category models` on a pure type companion mixes decoded values with type-level companions.
- `suggestedFix`: While applying R1-003/005/006/007, give every type companion the annotation-patterns template (`@see {@link Name} for the runtime schema and decoded representation.` / `@category type-level` / `@since 0.0.0`). Leave `AstNode`/`ProgramNode` Examples omitted. Do not add vacuous type-only Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-005
- `status`: open
- `fixedCommit`: pending

### codemode-interpreter-R1-020: synchronous throws outside the Effect error channel need `@throws`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/codemode/interpreter/Interpreter.model.ts:983
- `symbol`: asNode
- `kind`: value
- `evidence`: Conditional-tag law: `@throws` only for synchronous throws/defects outside the typed error channel. These owning values throw `InterpreterRuntimeError` (sometimes `.as("TypeError"|"ReferenceError"|"RangeError")`) instead of returning `Effect`/`Result`: `asNode`, `getArray`, `getString`, `getBoolean`, `getNode` (model.ts 983–1024); `rejectCircularInsertion` (references.ts 109); `invokeGlobalMethod` (methods.ts 228); `applyCollectionCallback` (methods.ts 657, throws before returning the function); `constructPromise` (promises.ts 379, executor check); `ScopeStack` methods (scope.ts 23–118). Contrast: `tryInterpreter` captures those throws into `Result`; `normalizeError` never throws.
- `impact`: Callers composing AST readers inside `Effect.gen` without `tryInterpreter` leak defects. Docgen readers will assume failures stay on `InterpreterFailure`.
- `suggestedFix`: Add `@throws` (no hyphen, no `{Type}`) on each sync-throwing export describing when and that `tryInterpreter` is the capture hatch. `@see` `{@link tryInterpreter}` from the AST readers. Do not add `@throws` on Effect-returning functions whose failures already occupy `InterpreterFailure`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: codemode-interpreter
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: codemode-interpreter-R1-005
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives

1. **`index.ts` module header** — exporting module is a star-export barrel (`owningExportCount: 0`). Census findings are empty. Law requires `@packageDocumentation` at package entry points, not internal re-export barrels. Do not invent a module block or document re-exports as new symbols.
2. **`Interpreter.methods.ts` `export { arrayStatics }`** — graph edge to `Codemode.method-names.ts`. Census correctly excluded it from owning exports (`exportCount` 9 / `owningExportCount` 8).
3. **Type-level Example requirement** — census did not flag types for missing `@example`. Keep Examples optional on `IteratorCursor`, `CallbackRunner`, schema type companions, `PromiseIdentity`, etc.
4. **`AstNode` / `ProgramNode` type companions** — already have lead + `@category` + `@since`. Not mechanically open. Editorial R1-019 only (`@see` / `@category type-level` on touch).
5. **Missing `$I.annote` / `$I.annoteSchema`** — exported schemas in `Interpreter.model.ts` and `RuntimeReferenceValue` already annotate. No gap item.
6. **Legacy `@example` / `@remarks` / `@module` / `@template`** — none in this slice (only `@packageDocumentation` on the model module header).
7. **Extra Examples / empty When-to-use** — rejected as taste. One titled observable Example per value is enough.

---

## Pack verdict

- files reviewed: 10
- owning exports reviewed: 113
- confirmed mechanical items: 9
- editorial items: 11
- rejected false positives: 7
- accepted findings: 20
