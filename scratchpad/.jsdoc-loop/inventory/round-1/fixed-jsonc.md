# Pack jsonc — round 1 fixer report

## Changed files

- `scratchpad/jsonc/index.ts`
- `scratchpad/jsonc/Jsonc.ts`
- `scratchpad/jsonc/JsoncEdit.ts`
- `scratchpad/jsonc/JsoncFingerprint.ts`
- `scratchpad/jsonc/JsoncFormatter.ts`
- `scratchpad/jsonc/JsoncModifier.ts`
- `scratchpad/jsonc/JsoncNode.ts`
- `scratchpad/jsonc/JsoncVisitor.ts`
- `scratchpad/jsonc/internal/limits.ts`
- `scratchpad/jsonc/internal/navigate.ts`
- `scratchpad/jsonc/internal/parser.ts`
- `scratchpad/jsonc/internal/scanner.ts`
- `scratchpad/jsonc/internal/skip.ts`

Runtime code was not changed (JSDoc only). `$I.annote` was not added: inventory rejected it until identity wiring exists.

## Items closed

Mechanical: `jsonc-R1-001` … `jsonc-R1-013` (module headers + owning-export `@category` / `@since` / titled Examples; types prose-only).

Editorial: `jsonc-R1-014` … `jsonc-R1-021`.

- Converted every `@example` / `@remarks` / `@effected/jsonc` / named `Schema`/`Option` fence.
- Barrel + `Jsonc` class: titled **Example** (Parse JSONC with a line comment), `import { Jsonc } from "@beep/scratchpad/jsonc"`, `import * as S from "effect/Schema"` where Schema is used, `Effect.runSync` / `Result` observable results.
- **Gotchas** preserved: aggregate `JsoncParseError` discards recovered value/tree; `stripComments` offset contract; `JsoncEdit.applyAll` overlap throws (`@throws` defect).
- `makeNodeUnsafe` lead rewritten around the omit-undefined contract (`@internal`); no `effect@4` fake tag.
- `JsoncVisitor.visit`: only `disallowComments` is read; in-band `Error` events.

## Residual risk

- Internal value Examples import via `../../jsonc/...` (not barrel-exported). Those paths are relative to scratchpad docgen `examples/` (`docgen.json` `examplesCompilerOptions.paths` uses the same `../../jsonc` root).
- `JsoncFingerprint.hash` / `hashText` are documented in Details (`R` includes `Crypto.Crypto`) rather than a runnable Crypto-provided Example.
- `{@link parseValue}` on `JsoncParseError` points at the internal recovery pair; it is not a public barrel export.
- This subagent had no shell tool, so `bun scratchpad/.jsdoc-loop/census.ts` and `bun run docgen:local` were not executed here. Mechanical gates were applied from `census.ts` rules (`@packageDocumentation`/`@since` on every exporting module; `@category`/`@since` on every owning export; titled `**Example** (` on every value; zero `@example`/`@remarks`/`@module`/`@template`; described `@see`; no type-brace/`@returns -` tags). Re-run those two commands to confirm pack opens are `0` and examples typecheck.

## Commands run

- Mechanical census-equivalent greps over `scratchpad/jsonc/**/*.ts` (legacy carriers, category/since counts vs 55 owning exports + 13 modules, titled Example presence, undescribed `@see`, type braces).
- Not run in this process: `/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts`
- Not run in this process: `bun run docgen:local` (scratchpad examples compile through `scratchpad/package.json` `docgen` / `scratchpad/docgen.json`).
