# Round 1 JSDoc fixer brief

You are a fixer for the scratchpad JSDoc quality loop.

## Write surface

Edit **only** the files listed in your prompt. Other fixers share the repo. Do not revert unrelated dirty files, especially `scratchpad/ontoskills/registry/Registry.models.ts` unless that file is in your owned surface.

Do not change runtime behavior. Allowed code edits: JSDoc blocks, `$I.annote` / `$I.annoteSchema` / `.annotate($I.annote(...))`, and missing exported same-name type aliases for non-class schemas.

## Law (read these)

- `.patterns/jsdoc-documentation.md`
- `.agents/skills/jsdoc-annotation-specialist/references/conventions.md`
- `.agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md` (schemas)

## Required shape

Module (every file that exports): useful lead, `@packageDocumentation`, `@since 0.0.0`. Never `@module`.

Value-level owning export: useful lead; optional When to use / Details / Gotchas only when they add facts; titled `**Example** (Title)` with exactly one `ts` fence and an observable result; `@category` canonical kebab role; `@since 0.0.0`. Convert `@example` → titled Example. Move `@remarks` into Details or Gotchas.

Type-level: useful prose, `@category`, `@since`. Example optional.

Every `@see` has a purpose phrase. Tag order per law. Namespace imports: `import * as S from "effect/Schema"` (and A/O/P/R). Examples must not use `@effected/*`; use `@beep/scratchpad/<kit>` or `effect-claudecode` as mapped in `scratchpad/docgen.json`.

Do not pad empty sections. Do not document barrel re-exports.

## Report

Write `scratchpad/.jsdoc-loop/inventory/round-1/fixed-<PACK>.md` listing changed files, items closed, residual risk, and commands run.
