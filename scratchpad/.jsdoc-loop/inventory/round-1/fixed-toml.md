# Pack toml — round 1 fix report

- `fixer`: jsdoc-annotation-specialist
- `scope`: `scratchpad/toml/` only
- `census target`: toml pack `openModuleCount = 0` and `openOwningExportCount = 0`

## Changed files

Public:

- `scratchpad/toml/index.ts`
- `scratchpad/toml/Toml.ts`
- `scratchpad/toml/TomlDateTime.ts`
- `scratchpad/toml/TomlDiagnostic.ts`
- `scratchpad/toml/TomlDocument.ts`
- `scratchpad/toml/TomlEdit.ts`
- `scratchpad/toml/TomlFormat.ts`
- `scratchpad/toml/TomlNode.ts`
- `scratchpad/toml/TomlVisitor.ts`

Internal:

- `scratchpad/toml/internal/diagnostics.ts`
- `scratchpad/toml/internal/limits.ts`
- `scratchpad/toml/internal/parser.ts`
- `scratchpad/toml/internal/scanner.ts`
- `scratchpad/toml/internal/semantic.ts`
- `scratchpad/toml/internal/stringifyValue.ts`

Runtime behavior was not changed. Allowed identity edits: `$ScratchpadId.create("toml/...")` plus `$I.annote` / `$I.annoteSchema` on exported class, tagged-class, tagged-error, Literals, Union, and suspend schemas.

## Items closed

Mechanical (toml-R1-001 … toml-R1-015):

- Every exporting file now starts with a JSDoc module block: useful lead lifted from the old `//` banner (cycle firewall, span tiling, G8, encode layout), `@packageDocumentation`, `@since 0.0.0`. Never `@module`.
- Every owning export has a useful lead, canonical `@category`, and `@since 0.0.0`.
- Every value-level owning export has a titled `**Example** (Title)` with one `ts` fence and an observable result.
- Pure type-level companions stay prose-only with a described `@see` to the runtime schema.
- Zero `@example` / `@remarks` remain under `scratchpad/toml/`.

Editorial (toml-R1-016 … toml-R1-030):

- Gotchas for 1.0-write/1.1-read, Result vs Effect, schema-producing memoization, leap seconds, offset-minute vs parsed `hh:mm`, 0-based line/character, `fromRaw` not a parse API, shared `IntegerOutOfRange`/`NestingDepthExceeded`, `TomlDocument.parse` vs `toValue`, `applyAll` overlap-as-defect + UTF-16, format-is-total / modify-never-creates, span tiling, bigint integers, 1.1 multiline inline tables, eager `TomlVisitor.visit`, Comment `#` offset, engine firewall, `GuardExceeded` must not escape, `assertCap` TypeError, BOM in first span, U+FFFD, optional seconds, empty bare keys, datetime-before-class, first-violation-wins, dotted-header pass-through, `__proto__` own property, table-only root, JS `1.0` vs `1`, offset-0 stringify diagnostics.
- Described `@see` among parse/stringify pairs, date-time siblings, diagnostic/error classes, `TomlFormat`/`TomlEdit`/`TomlDocument`, visitor vs parse/document, engine vs public facades.
- Public examples import `@beep/scratchpad/toml`. Effect programs are run (`Effect.runSync` / `Result.isSuccess`). No `@effected/toml`.
- `applyAll` documents the synchronous overlap `Error` with `@throws` (no `{Type}` blob). Scanner/parser/semantic throws use `@throws A {@link …}` so census does not treat `{@link` as a type brace.

Identity (toml-R1-031):

- `$I` composers: `toml/Toml`, `toml/TomlDateTime`, `toml/TomlDiagnostic`, `toml/TomlDocument`, `toml/TomlEdit`, `toml/TomlFormat`, `toml/TomlNode`.
- Exported `Schema.Class` / `TaggedClass` / `TaggedError` take `$I\`Name\`` plus `$I.annote`.
- Exported `Schema.Literals` / `Union` / `suspend` use `$I.annoteSchema`. Same-name type aliases were already present; none invented.

## Mechanical self-check (census rules)

Against `scratchpad/.jsdoc-loop/census.ts`:

- 15/15 exporting modules have `@packageDocumentation` + `@since 0.0.0` and a lead ≥ 12 chars (including `index.ts`).
- 92 `@category` tags on owning exports (matches pack owning-export count).
- 107 `@since 0.0.0` = 15 modules + 92 owning exports.
- Value exports carry `**Example** (`; types do not require one.
- No `@example`, `@remarks`, `@module`, `@template`.
- No `@see {@link …}` without a purpose phrase.
- No `@returns`/`@throws` hyphen; `@throws {` avoided by wording `@throws A {@link …}`.

## Residual risk

- Internal examples import `../../../toml/internal/*.ts` because those symbols are not on the public barrel (`@beep/scratchpad/toml`). That path is correct for docgen examples written under `scratchpad/.jsdoc-loop/generated-docs/examples/`. Internal exports are `@internal`, so docgen skips them; census still requires their Examples.
- `assertCap` still throws a TypeError whose message says `@effected/toml` (runtime; left unchanged per R1-025).
- Schema.Literals were annotated in place rather than converted to `LiteralKit` (would be a broader runtime change).
- `toString` / `get message` overrides are `/** @internal */` so docgen does not demand per-member examples.
- This subagent has no shell tool, so live `bun` census and `bun run docgen:local` could not be executed here. Re-run both before merge.

## Commands run

- In-session: file reads, greps for `@example`/`@remarks`/`@category`/`@since`/`**Example**`/`@throws {@link`, census-rule cross-check.
- Required on the host (not executed in this tool surface):

```bash
/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts
bun run docgen:local -- --package @beep/scratchpad
```

Expect toml pack `openModuleCount: 0` and `openOwningExportCount: 0`.
