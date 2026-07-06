---
name: jsdoc-annotation-specialist
description: >
  JSDoc/TSDoc and schema annotation compliance: missing @example/@category/@since,
  $I.annote/$I.annoteSchema gaps, TSDoc grammar violations, docgen failures, and
  documentation post-pass or annotation review on exported symbols.
version: 0.2.0
status: active
---

# JSDoc Annotation Specialist

Use this skill as a post-pass on code written by other agents, or when adding,
fixing, or reviewing JSDoc documentation and schema annotations. The primary
source of truth is `.patterns/jsdoc-documentation.md`. This skill enforces and
extends those conventions.

## References (load on demand)

- `references/conventions.md` — JSDoc block structure and tag order, quality
  rubric, import aliases in examples, canonical `@category` slugs, forbidden
  patterns in examples.
- `references/annotation-patterns.md` — `$I.annote` / `$I.annoteSchema`
  patterns per schema kind (S.Class, TaggedErrorClass, non-class, LiteralKit,
  unions) and the same-name type-alias convention.
- `references/agent-lifting-and-greps.md` — agent context lifting rules and
  the full grep audit command set.

## Workflow

1. Identify all exported symbols in the target file(s).
2. For each export, verify JSDoc block, `@example`, `@category`, `@since`
   (structure/order/categories: `references/conventions.md`).
3. For each export, evaluate whether conditional tags (`@param`, `@returns`,
   `@typeParam`, `@throws`, `@remarks`, `@effects`, `@precondition`,
   `@postcondition`, `@invariant`, `@deprecated`, `@public`/`@beta`/etc.) are
   warranted by the symbol kind and content. Add them only when they encode
   information not present in the signature.
4. Evaluate whole-block usefulness: the description, tags, and examples should
   help a human or coding agent use the symbol without inventing intent.
5. For each schema value, verify `$I.annote` or `$I.annoteSchema`
   (`references/annotation-patterns.md`).
6. Add or fix any missing documentation.
7. Verify TSDoc grammar — no `{type}` blobs in tags, no `@template`, no
   `@module`, no hyphen on `@returns`.
8. Run `bun run docgen` to verify every example compiles.
9. Run `bun run beep docgen quality -p <package>` when touching a package and
   use the report as advisory remediation input.
10. Fix compilation failures in examples until docgen passes.

## TSDoc Grammar Hard Rules

Violations the post-pass MUST catch and fix:

1. **`{type}` blobs in `@param`, `@returns`, `@throws`** — drop the braces.
   The TS signature is authoritative. `@param x {string} - desc` becomes
   `@param x - desc`.
2. **`@template`** — replace with `@typeParam`.
3. **Hyphen after `@returns`** — drop it. The hyphen separator is
   `@param`-only. `@returns - The count` becomes `@returns The count`.
4. **`@module`** — replace with `@packageDocumentation` for package
   entry-point files.
5. **`@deprecated` without `{@link}` migration target** — every deprecation
   must point at its replacement.

## Conditional Tag Rules (summary)

Default is **omit**. Add a conditional tag only when it encodes information
not present in the TS signature; prose-padding `@param`/`@returns` that
restates the signature is a bug, not thoroughness.

- `@param` / `@returns` — only for units, constraints, ordering, filtering,
  ownership, or semantic interpretation beyond name + type; skip when
  `Effect<A, E, R>` channels speak for themselves.
- `@typeParam` — only when the constraint or semantic role isn't obvious;
  skip trivial `<A>`.
- `@throws` — synchronous throws or defects only; skip when all errors live
  in the `E` channel.
- `@remarks` — non-obvious semantics, ordering guarantees, idempotency,
  complexity.
- `@effects` — writes, publishes, cache mutations, other side effects; skip
  pure functions.

## Post-Pass Checklist

Run against every file before finishing:

1. Every `export const`/`function`/`class`/`interface`/`type` has a JSDoc
   block with at least one fenced `@example`, a canonical kebab-case
   `@category`, and `@since 0.0.0`.
2. Description explains purpose rather than restating the symbol name;
   `@example` shows meaningful input and an observable result (or type-level
   evidence for type-only exports). Error/type-only/schema/constant symbols
   get shape-appropriate examples; re-exports point at owning symbol docs.
3. Conditional tags present only when they add beyond the signature;
   `@remarks` on combinators with non-obvious semantics; `@effects` on
   side-effecting functions; `@deprecated` includes a `{@link}` target.
4. TSDoc grammar clean: no `{type}` blobs, no `@template`, no `@returns`
   hyphen, no `@module`.
5. Schema annotations: every `S.Class`/`Model.Class`/`TaggedErrorClass` call
   has `$I.annote(...)`; every non-class schema has `$I.annoteSchema(...)` in
   its pipe; every `LiteralKit` value has `.annotate($I.annote(...))`; every
   non-class schema export has a same-name `export type` alias.
6. Examples use correct import aliases (`S`/`A`/`O`/`P`/`R` namespaces; named
   imports only for core combinators); no empty `Effect.gen(function* () {})`
   bodies; no `any`, type assertions, `declare`, or deprecated
   `@effect/schema` imports.
7. If `@effects`/`@precondition`/`@postcondition`/`@invariant` appear,
   `tsdoc.json` registers them as block tags (verify once per workspace).
8. `bun run docgen` passes with zero errors; `bun run beep docgen quality -p
   <package>` produces a reviewable report.

Grep audits for each checklist group: `references/agent-lifting-and-greps.md`.

## Escalation

- `schema-first-development` — schema modeling beyond annotation work.
- `effect-first-development` — tasks broader than documentation.
- `effect-error-handling` — new TaggedErrorClass hierarchies.

## Source References

- `.patterns/jsdoc-documentation.md` — primary JSDoc/TSDoc standard
- `tsdoc.json` (workspace root) — custom tag registrations for `@effects`,
  `@precondition`, `@postcondition`, `@invariant`
- `packages/tooling/tool/cli/src/commands/Shared/JSDocCategories.ts` — canonical categories
- `packages/common/schema/src/SemanticVersion.ts` — TemplateLiteral + annoteSchema
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` — TaggedErrorClass + annote
- `packages/common/schema/src/Duration.ts` — S.Class + annote + LiteralKit + annotate
