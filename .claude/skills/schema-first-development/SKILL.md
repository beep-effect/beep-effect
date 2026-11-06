---
name: schema-first-development
description: >
  Focused schema-first guidance for this repo's effect/Schema and @beep/schema
  patterns. Use when adding or refactoring schemas, replacing exported
  interface/type data models, fixing schema-first lint violations, modeling
  literal domains or tagged unions, applying schema defaults or transformations,
  decoding external input, or reviewing schema code for repo-law compliance.
---

# Schema-First Development

Use this skill for schema-heavy work in this repository.

Treat schema-first rules as enforced repository law, not style preference.
The primary sources are:

- `standards/effect-first-development.md`
- `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`
- `standards/schema-first.inventory.jsonc`

Keep `Schema` as the source of truth for pure data models.

## Workflow

1. Classify the task.
- New schema or domain model
- Refactor from exported `interface` / type literal
- Boundary decode, transform, or defaulting work
- Literal domain or tagged union modeling
- Review or lint-fix

2. Load only the reference file you need.
- Repository laws: `references/repo-laws.md`
- Local shared schema primitives: `references/local-primitives.md`
- Pattern selection and anti-patterns: `references/pattern-catalog.md`
- Real repository examples: `references/examples.md`

3. Check local Effect v4 source for nontrivial Schema API choices.
   `.repos/effect` points to `$HOME/YeeBois/references/effect/effect`, the Effect
   child of the reference workspace; Effect `main` is v4.
- Start with `.repos/effect/packages/effect/SCHEMA.md`.
- Confirm behavior in `.repos/effect/packages/effect/src/Schema.ts` or the
  specialized module (`SchemaAST`, `SchemaGetter`, `SchemaIssue`,
  `SchemaRepresentation`, `SchemaTransformation`) when using advanced APIs.
- Prefer exact upstream or repo-local helpers over memory and ad-hoc plumbing.

4. Apply the laws in this order.
- Model pure data with `Schema` first.
- Model plain object data as a branded `S.Opaque` over an annotated
  `S.Struct` (`S.TaggedStruct` for `_tag` data). Keep `S.Class` /
  `S.TaggedClass` / `S.Error` / `S.TaggedError` for errors, persisted
  entities, schemas with instance members, and `.extend` chains. Every schema
  class and Opaque declaration carries `{ readonly brand: unique symbol }`.
- Check upstream `effect/Schema` first, then reuse `@beep/schema` and existing
  local schemas before inventing new checks. Where upstream covers a
  `foundation/modeling` concept's intent, its covered facets retire in the
  same PR that migrates their consumers, with no alias; the whole concept
  retires unless the lines reading its uncovered members outnumber the lines
  using its covered facets (ADAPT, per the facet census in
  `standards/architecture/DECISIONS.md` "Upstream-First Foundation/Modeling").
- Move normalization, defaults, nullable handling, and JSON parsing into the
  schema.
- Annotate reusable non-class schemas with `.pipe($I.annoteSchema(...))`
  (`LiteralKit` included); classes take `$I.annote(...)` as their trailing
  argument.
- Derive guards, equivalence, arbitraries, codecs, tagged-union helpers, and
  literal helpers from the schema instead of writing parallel helpers.
- Prefer Effect schema codecs; map schema errors with `Effect.mapError(...)`
  when the error leaves the local helper/module boundary.

5. Verify before finishing.
- No exported pure-data `interface` or type literal remains.
- No schema value ends with `Schema`.
- Non-class schemas export same-name runtime type aliases.
- Tagged unions use the repo-preferred construction.
- Finite variants are modeled as discriminated unions instead of optional
  payload bags.
- JSON boundaries use schema codecs, not native JSON helpers.

## Fast Rules

- Prefer `import * as S from "effect/Schema"` and canonical Effect aliases.
- Create file-local identity composers with `@beep/identity/packages`.
- Plain data is `class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema("X", {...}))) {}`.
  Construct with `X.make(...)`; there is no `new X(...)` and no `.extend`.
  Annotate the Struct inside the pipe, because `X.annotate(...)` drops the
  statics. See `references/repo-laws.md` section 2.
- Use named intermediate schemas for reused concepts.
- Prefer `LiteralKit` for named literal domains: its keyed API (`.Enum`,
  `.is`, `match`, `.toTaggedUnion(...)`) plus the `S.Literals` members it
  inherits (`.literals`, `.pick(...)`, `.mapMembers(...)`). Use `S.Literals`
  for anonymous inline unions never referenced by name.
- Prefer `MappedLiteralKit` when a protocol/code mapping needs both encoded and
  decoded literal helper surfaces.
- Do not add `as const` to inline array literals passed directly to
  `LiteralKit(...)`; its const type parameters preserve the literal tuple.
- Model finite variants, lifecycle states, status/result cases, and
  case-specific payloads as discriminated unions, not one optional/nullish
  payload bag.
- Decode external optional/nullish case bags into internal tagged models when
  compatibility requires the wire shape.
- Use `S.toTaggedUnion("<field>")` for discriminators such as `kind`,
  `status`, `type`, `subtype`, `profile`, or `family`.
- Use `S.TaggedUnion(...)` only for canonical `_tag` object unions.
- Fix a tag with `S.TaggedStruct` / `S.TaggedClass` / `S.TaggedError`, and any
  other required single-literal field with `S.tag(v)`, never `S.Literal(v)`;
  `bun run beep laws schema-tag-idioms --check` enforces it.
- Prefer schema-derived tagged-union helpers (`.cases`, `.guards`, `.isAnyOf`,
  `.match`) when constructing, guarding, or branching on a schema tagged union.
- Use `S.OptionFromNullOr`, `S.OptionFromNullishOr` and
  `S.OptionFromOptionalKey` for absence at the boundary. Optional fields use
  exact keys (EF-40): `S.optionalKey`, `S.withDecodingDefaultKey`,
  `S.OptionFromOptionalKey`, never their `undefined`-admitting siblings.
- Use `S.OptionFrom*` when the wire/schema field is optional or nullish. If
  runtime `Option` values are already being shaped into an object, prefer
  `O.getSomesStruct({...})` (`@beep/utils`) for heterogeneous struct spreads
  with known keys — runtime-identical to `R.getSomes` but type-preserving per
  key; reserve `R.getSomes({...})` for homogeneous dynamic-key dictionaries.
  Use `O.all({...})` for all-or-nothing fixed-shape composition. (Amended
  2026-07-05 — see `standards/architecture/DECISIONS.md`.)
- Use `S.withConstructorDefault(...)`, `S.withDecodingDefaultKey(...)`, and
  `S.decodeTo(...)` with `SchemaTransformation` for normalization and fallback
  behavior.
- Prefer built-in schema constructors and checks before `S.makeFilter(...)`.
- Treat broad exported/domain/boundary primitives such as `S.String`,
  `S.Number`, and unbounded arrays as prompts to ask whether the schema should
  be more precise.
- If you need a custom reusable check, include `identifier`, `title`, and
  `description`.
- Use `S.is(schema)` for guards, `S.toEquivalence(schema)` for comparisons, and
  `Arbitrary.schema(schema)` (`effect/Arbitrary`) for schema-modeled property tests.
- Use `S.fromJsonString(S.Unknown)` or `S.fromJsonString(schema)` for JSON string
  boundaries.
- Use `S.decodeUnknownEffect` / `S.decodeEffect` and `S.encodeUnknownEffect` /
  `S.encodeEffect` by default. Reach for `S.decodeUnknownResult`,
  `S.decodeResult`, or `S.decodeUnknownOption` only for deliberate
  non-throwing synchronous helpers; do not teach or add `S.decodeSync`,
  `S.decodeUnknownSync`, `S.encodeSync`, or `S.encodeUnknownSync`. If a
  legacy synchronous wrapper must still throw, convert Result failures with
  `Result.getOrThrowWith(...)` so raw schema issues do not escape the boundary.

## Escalation

- Use `effect-first-development` when the task is broader than schema work,
  including service/layer wiring and typed error flow outside schema modeling.
