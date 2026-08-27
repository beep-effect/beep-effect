# Round 2 fix report — docgen class members

Scratchpad `docgen` was failing on 156 missing description/example/`@since`
findings for class members and one nested type alias (not owning exports).
Runtime behavior was not changed.

## Changed files

- `scratchpad/codemode/interpreter/Interpreter.runtime.ts`
- `scratchpad/codemode/interpreter/Interpreter.promises.ts`
- `scratchpad/codemode/interpreter/Interpreter.model.ts`
- `scratchpad/beep-docs/api-reference/CodeSnippet.ts`

## Members documented

Each runtime method has a one-paragraph lead, one titled `**Example** (Title)`
with a single `ts` fence, and `@since 0.0.0`. The nested `Encoded` alias is
prose + `@category type-level` + `@since 0.0.0` (no Example).

### `Interpreter` (`Interpreter.runtime.ts`) — 84 methods

Public:

- `run`

Private (flagged by docgen because `parseMethod` does not skip `private`):

- `createToolCallPromise`
- `createPromise`
- `settlePromise`
- `evaluateStatement`
- `evaluateBlock`
- `createFunction`
- `hoistFunctions`
- `hoistVariables`
- `predeclareLexical`
- `predeclarePattern`
- `evaluateIfStatement`
- `evaluateSwitchStatement`
- `evaluateWhileStatement`
- `evaluateDoWhileStatement`
- `evaluateForStatement`
- `evaluateForOfStatement`
- `awaitValue`
- `awaitAsyncFromSyncValue`
- `syncIterator`
- `customIterator`
- `nextIteratorResult`
- `closeIterator`
- `requireIteratorObject`
- `requireIterator`
- `requireIteratorMethod`
- `enumerableKeys`
- `evaluateForInStatement`
- `evaluateBreakStatement`
- `evaluateContinueStatement`
- `evaluateLabeledStatement`
- `evaluateThrowStatement`
- `evaluateTryStatement`
- `evaluateVariableDeclaration`
- `declarePattern`
- `assignPattern`
- `destructureArrayPattern`
- `destructuringPropertyKey`
- `destructuringPropertyValue`
- `evaluateExpression`
- `evaluateNewExpression`
- `constructArray`
- `constructObject`
- `constructDate`
- `toDatePrimitive`
- `constructRegExp`
- `constructMap`
- `constructSet`
- `constructURL`
- `constructURLSearchParams`
- `readURLSearchParamsPair`
- `evaluateBinaryExpression`
- `applyBinaryOperator`
- `evaluateLogicalExpression`
- `evaluateUnaryExpression`
- `evaluateAssignmentExpression`
- `evaluateLogicalAssignment`
- `evaluateUpdateExpression`
- `evaluateCallExpression`
- `invokeCallable`
- `invokeObjectMethodOnTools`
- `invokeConsole`
- `evaluateCallArguments`
- `invokeFunction`
- `createGenerator`
- `completeGeneratorRequests`
- `takeGeneratorRequest`
- `dequeueGeneratorRequest`
- `evaluateYieldExpression`
- `suspendGenerator`
- `delegateYield`
- `evaluateObjectExpression`
- `evaluateArrayExpression`
- `evaluateTemplateLiteral`
- `evaluateConditionalExpression`
- `applyCompoundAssignment`
- `getMemberReference`
- `readMember`
- `writeMember`
- `evaluateDeleteExpression`
- `modifyMember`
- `readReferenceValue`
- `assignToReference`
- `toPropertyKey`

Private-method Examples go through `CodeMode.make` + `runtime.execute` with a
guest program that exercises that path. `run` uses `Interpreter` +
`ProgramNode` like the class Example.

### `PromiseRuntime` (`Interpreter.promises.ts`) — 6 methods

- `create`
- `markObserved`
- `await`
- `fork`
- `diagnostics`
- `interrupt`

### `InterpreterRuntimeError` (`Interpreter.model.ts`) — 1 property

- `as` — brands a copy with a different guest `errorName`

### `CodeSnippetLanguageFromExtension` (`CodeSnippet.ts`) — 1 nested type

- `export type Encoded` — file-extension input of the codec

Also upgraded same-name type companions in `CodeSnippet.ts` to
`@category type-level`, replaced the `CodeSnippetLanguage` Enum-log Example
with `S.is` true/false, and pointed Example imports at
`../../../beep-docs/api-reference/CodeSnippet.ts` so they compile from the
docgen examples directory.

## Residual risk

- Private `Interpreter` methods are not callable from Examples; fences prove
  the public `execute`/`run` path that reaches them.
- `PromiseRuntime.diagnostics` depends on the unhandled-rejection observer
  running after `Effect.yieldNow`; if that races, the Example still typechecks.
- `{@link}` targets that live in another file are described but not
  typechecked by docgen.

## Commands

```bash
zsh -ic 'bun run --cwd scratchpad docgen --include "codemode/interpreter/Interpreter.runtime.ts,codemode/interpreter/Interpreter.promises.ts,codemode/interpreter/Interpreter.model.ts,beep-docs/api-reference/CodeSnippet.ts"'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
```
