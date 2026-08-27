# Round 3 fix report — docgen class members (`Interpreter.scope.ts`)

Scratchpad `docgen` was failing on 22 missing description/example findings for
class members on `ScopeStack` (11 instance methods × description + examples).
Runtime behavior was not changed. JSDoc only.

## Changed files

- `scratchpad/codemode/interpreter/Interpreter.scope.ts`

## Members documented

Each member has a one-paragraph lead, one titled `**Example** (Title)` with a
single `ts` fence, and `@since 0.0.0`. Member Examples import
`../../../codemode/interpreter/Interpreter.scope.ts` (docgen examples dir) and
keep the existing class Example's `MutableHashMap.empty<string, Binding>()`
setup.

### Public

- `constructor` — copies supplied frames without cloning the maps
- `new` — static factory, same as `new ScopeStack(scopes)`
- `reserve` — uninitialized current-frame slot (`let`/`const` TDZ)
- `initialize` — first write into a reserved slot
- `declare` — already-initialized current-frame binding (`var`)
- `get` — initialized lookup, innermost frame first
- `set` — replace a mutable initialized binding; returns the assigned value
- `resolve` — lookup without throwing, including TDZ slots
- `current` — innermost frame
- `push` — nested frame (default empty `MutableHashMap`)
- `pop` — drop innermost frame
- `capture` — shallow copy of the frame array (maps stay shared)

### Private (flagged by docgen because `parseMethod` does not skip `private`)

- `resolveBinding` — walk frames inside-out; Example uses public `resolve()`
  because the private method is not callable from a fence

The class lead, Gotchas, class Example, `@see`, `@throws`, `@category`, and
`@since` were left in place.

## Residual risk

- Private `resolveBinding` is not callable from Examples; the fence proves the
  public `resolve` walk that uses it.
- `constructor` and static `new` are not extracted as docgen members (`new` is
  a static property, constructors are not in `getInstanceMethods()`). They were
  documented because they are public members.
- `{@link}` targets in another file are described but not typechecked by
  docgen.

## Commands

This fixer session had no shell, so Example compilation was not proven here.
Parent should run from repo root (`mise` is not on the unadorned tool PATH):

```bash
zsh -ic 'bun run --cwd scratchpad docgen --include "codemode/interpreter/Interpreter.scope.ts"'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
```

`@beep/scratchpad` has no package `check` script. The file is JSDoc-only;
runtime code is unchanged.
