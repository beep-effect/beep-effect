# Pack `glob` — Round 1 JSDoc fix report

Closed every accepted finding in `inventory/round-1/glob.md` (glob-R1-001 through glob-R1-024). Owned surface is `scratchpad/glob/` only. Runtime match/compile behavior is unchanged aside from schema identity annotations (`$I.annote`) on the four facade classes.

## Changed files

- `scratchpad/glob/index.ts`
- `scratchpad/glob/GlobPattern.ts`
- `scratchpad/glob/GlobSet.ts`
- `scratchpad/glob/internal/assertValidPattern.ts`
- `scratchpad/glob/internal/ast.ts`
- `scratchpad/glob/internal/balancedMatch.ts`
- `scratchpad/glob/internal/braceExpansion.ts`
- `scratchpad/glob/internal/braceExpressions.ts`
- `scratchpad/glob/internal/escape.ts`
- `scratchpad/glob/internal/limits.ts`
- `scratchpad/glob/internal/minimatch.ts`
- `scratchpad/glob/internal/types.ts`
- `scratchpad/glob/internal/unescape.ts`

## Items closed

| ID | Closure |
| --- | --- |
| glob-R1-001 | Module header on `GlobPattern.ts`. `GlobPatternError` / `GlobPatternOptions` / `GlobPattern` now have leads, `@category`, `@since 0.0.0`, titled Examples. |
| glob-R1-002 | Module header on `GlobSet.ts`. `GlobSet` tagged `@category schemas` with include/exclude and classification Examples. |
| glob-R1-003 | Package entry `@since 0.0.0`. Re-exports left undocumented. |
| glob-R1-004 | `assertValidPattern` module + export; `@throws` for `TypeError` vs `GuardExceeded`; titled Example via public compile. |
| glob-R1-005 | `ast.ts` module header; `ExtglobType` type-level prose; `AST` `@internal` `@category models` with Example. |
| glob-R1-006 | Dedicated module `/**` before `BalancedResult`; type-level tags on the interface; `balanced` / `range` `@category parsing` Examples. |
| glob-R1-007 | `braceExpansion.ts` module header; `BraceExpansionOptions` prose; `expand` Gotchas + Example including budget trip. |
| glob-R1-008 | `braceExpressions.ts` module; `ParseClassResult` tuple prose; `parseClass` Gotchas, `@throws`, Example. |
| glob-R1-009 | `escape.ts` module header; JSDoc on `export const escape`; `@category encoding` Example. |
| glob-R1-010 | Dedicated `limits.ts` module header; all nine exports tagged; value Examples; `GuardReason` type-level only. |
| glob-R1-011 | `minimatch.ts` module header; `braceExpand` Example (`nobrace` no-op); `Minimatch` `@internal` with Example. `GLOBSTAR` remains a graph-edge re-export (`export { GLOBSTAR } from "./types.ts"`). |
| glob-R1-012 | Dedicated `types.ts` module header; types tagged; `GLOBSTAR` `@category symbols` Example. |
| glob-R1-013 | `unescape.ts` module header; JSDoc on `export const unescape`; `@category decoding` Example. |
| glob-R1-014 | Gotchas on `GlobPattern`, `GlobPatternError`, `expand`, `assertValidPattern`, `GuardExceeded`. Brace-bomb / over-length failures in `compileResult` Examples. |
| glob-R1-015 | Gotchas on `GlobPattern` / `matches`, `MAX_GLOBSTAR_RECURSION`, `Minimatch`: over-cap is silent `false`; `noglobstar` rewrites `**`. |
| glob-R1-016 | Gotchas on `GlobSet` and `GlobPattern` (`negated` / `enumerationPrefix` / `crossesSegments`): SET bang vs pattern bang. |
| glob-R1-017 | All `@remarks` converted to `**When to use**` / `**Gotchas**`. Zero `@remarks` / `@example` remain under `glob/`. |
| glob-R1-018 | `$ScratchpadId` from `@beep/identity/packages`. `$I.annote` on `GlobPatternError`, `GlobPatternOptions`, `GlobPattern`, `GlobSet`. TaggedError keeps tag `"GlobPatternError"`; identifier is `$I\`GlobPatternError\``. |
| glob-R1-019 | Public facade members have titled Examples. Engine classes (`Minimatch`, `AST`, `GuardExceeded`) tagged `@internal` so docgen `checkClass` skips their method surfaces. |
| glob-R1-020 | Gotchas + Examples on internals and `GlobPattern.escape` / `unescape`: default `magicalBraces` false vs true; `windowsPathsNoEscape` `[]` wrap. |
| glob-R1-021 | Details/Gotchas + classification Example on `GlobSet` and `literals` / `wildcards` / `excludes`. |
| glob-R1-022 | Gotchas on `MAX_EXTGLOB_RECURSION` and `AST`: degrade-to-literal vs `MAX_NESTING_DEPTH` throw vs globstar false-negative. |
| glob-R1-023 | `parseClass` Gotchas + `@throws` + Example (`[a-z]`, `[_]`). |
| glob-R1-024 | `GlobPatternOptions` Gotchas and field prose (`nonegate`, `noglobstar`, `flipNegate`, `platform`, `braceExpandMax`, …). Defect-at-make remains. |

## Residual risk

- Internal examples import `@beep/scratchpad/glob` (public facade) so they typecheck if docgen ever extracts them; `@internal` currently skips that extraction.
- Brace-budget Example uses `{0..100000}` (101_001 alternatives) — compile-time only in typecheck; not marked doctest-runnable.
- Expected console comments for `literals` / `wildcards` classification assume the engine's unescaped-row keys (`foo*bar`) and per-alternative brace split. If classification order ever changes, comments would drift; behavior was not altered.
- `$I\`…\`` schema identifiers change AST identity from the bare `"GlobPattern"` strings. That is the allowed `$I.annote` exception, not a matcher-behavior change.

## Commands run

- Walked every `export` under `scratchpad/glob/` against `census.ts` predicates:
  useful lead (`>= 12` chars), `@category`, `@since 0.0.0`, titled `**Example** (Title)` on every value-level owning export, module `@packageDocumentation` + `@since 0.0.0`, zero `@remarks` / `@example` / `@module` / type-braces / hyphen-after-throws.
- Confirmed 13 exporting modules, 33 owning exports after turning `minimatch.ts` `GLOBSTAR` into a `from "./types.ts"` re-export (the inventory's rejected false positive).
- `grep` for `@remarks` / `@example` under `scratchpad/glob/` is empty.
- Acceptance runner (parent should execute if this session cannot spawn a shell):

```bash
/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts
```

Pack `glob` should report `openModuleCount: 0` and `openOwningExportCount: 0`.
