# Round 2 JSDoc fix — glob, schemastore, memfs

- `round`: 2
- `fixer`: jsdoc-annotation-specialist
- `owned`: `scratchpad/glob/**`, `scratchpad/schemastore/**`, `scratchpad/memfs/**`
- `not edited`: `scratchpad/semver/**` (clean on this pass)

Runtime behavior is unchanged. JSDoc only.

## Changed files

Glob internals (owning-symbol Examples; `expand` Gotcha):

- `scratchpad/glob/internal/assertValidPattern.ts`
- `scratchpad/glob/internal/ast.ts`
- `scratchpad/glob/internal/balancedMatch.ts`
- `scratchpad/glob/internal/braceExpansion.ts`
- `scratchpad/glob/internal/braceExpressions.ts`
- `scratchpad/glob/internal/escape.ts`
- `scratchpad/glob/internal/unescape.ts`
- `scratchpad/glob/internal/limits.ts` (`GuardExceeded`, `isGuardExceeded`, `assertCap` only)
- `scratchpad/glob/internal/minimatch.ts`
- `scratchpad/glob/internal/types.ts`

Schemastore Promise observation:

- `scratchpad/schemastore/SchemaFile.ts`
- `scratchpad/schemastore/SchemaPipeline.ts`
- `scratchpad/schemastore/SchemaValidator.ts`

Memfs inspectable shape:

- `scratchpad/memfs/internal/volume.ts`

## Items closed

| ID | Closure |
| --- | --- |
| glob-R2-001 | Every listed internal value Example now relatively-imports its owning module (`../../glob/internal/…`, same pattern as `scratchpad/semver/internal/grammar.ts`) and calls that symbol. `balanced` / `range` show `pre`/`body`/`post` and `[start,end]`. `expand` expands `a{b,c}d`, shows the leading-`{}` pair, and trips `ExpansionBudgetExceeded` via `{0..2}` with `max: 2`. `parseClass` returns the `[a-z]` / `[_]` tuples and the non-`[` throw. `escape` / `unescape` share options bags. `assertValidPattern` is `TypeError` vs `GuardExceeded`. `isGuardExceeded(new GuardExceeded(...))`. `assertCap("braceExpandMax", 0)` in try/catch. `braceExpand` with `nobrace: true`. `new Minimatch("**/*.ts", {})`. `GLOBSTAR` is compared with `Minimatch.set`. Cap-constant Examples still go through `GlobPattern.compileResult` (rejected false positive). |
| glob-R2-002 | `expand` Gotchas now include the Bash 4.3 top-level leading-`{}` escape, with `{},a}b` vs `a{},b}c`. The Example logs both. |
| schemastore-R2-001 | `SchemaFile` / `SchemaPipeline` / `SchemaValidator` observe the resolved value via `Effect.runPromise(program).then((result) => console.log(...))`. Write comment is `{ outcome: "written", change: "created" }`. Check comment is `{ blocked: false, wouldWrite: true, change: "created" }`. Validator `// => []` now trails the logged array, not a Promise. |
| memfs-R2-001 | `makeInspectable` Example imports `../../memfs/internal/volume.ts`, destructures `{ fileSystem, entries }`, writes `/out.txt`, and logs decoded snapshot bytes from `entries()`. |

## Residual risk

- `@internal` symbols are still skipped by docgen `Parser.shouldIgnore`, so glob-internal and `makeInspectable` fences are hover documentation, not the extracted tsc corpus. Relative imports match the semver-internal convention (`../../<kit>/internal/…`). If those symbols ever lose `@internal`, the extract dir is `.jsdoc-loop/generated-docs/examples/` and a three-level `../../../` path (toml internals) would be the one that resolves on disk.
- Cap constants in `glob/internal/limits.ts` (`MAX_PATTERN_LENGTH`, `EXPANSION_MAX`, `MAX_GLOBSTAR_RECURSION`, `MAX_EXTGLOB_RECURSION`, `MAX_NESTING_DEPTH`) still Example the public compile failure at that numeric bound. Round-2 review rejected that as a finding.
- `SchemaPipeline.checkOne` `blocked: false` assumes `S.Struct({ name: S.String })` produces no warning-severity lint/validator findings (advisory `DescriptionWithoutUrl` does not block). `wouldWrite` / `change` are determined by the missing file.
- This session has no shell tool, so census / docgen / package `check` were not executed here.

## Commands run

- Grep of owned files for leftover facade-proxy fences on the glob-R2-001 symbols, `console.log(Effect.runPromise`, `volume.text`, `{ fileSystem, volume }`, `@example`, `@remarks`.
- Walked each rewritten fence against the census mechanical shape: titled `**Example** (Title)`, one `ts` fence, observable `console.log` / `// =>`, no `@example` / `@remarks` / `@module` / `@template`.

Acceptance runner (parent should execute):

```bash
/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts
/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun run --cwd /home/elpresidank/YeeBois/projects/beep-effect8 docgen:local -- --package scratchpad
```

Packs `glob`, `schemastore`, and `memfs` should remain `openModuleCount: 0` and `openOwningExportCount: 0`.
