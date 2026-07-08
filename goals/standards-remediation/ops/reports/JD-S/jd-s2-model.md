# JD-S2 — `@beep/schema` shard: Color / FilePath / Model / EntitySchema

Lane: `JD-S2`, wave `JD-S`. File fence: `src/Color/**`, `src/FilePath/**`,
`src/Model/**`, `src/EntitySchema/**` only. No commits made; no
`standards/*.jsonc` files touched. Findings extracted read-only from
`standards/jsdoc-documentation.inventory.jsonc`'s `@beep/schema` `exports[]`
slice, filtered to the four fenced directories: 106 open findings across 30
files. All 106 fixed; target zero reached.

## Recipe applied

- `missingExportExamples` on a `Type for {@link X}` alias (the
  `export type X = typeof X.Type` sibling of a branded/derived schema const):
  added an `@example` showing type-level evidence —
  `const value: X = S.decodeUnknownSync(X)(<encoded sample>)`.
- `missingExportExamples` on genuinely internal, non-barrel-exported symbols
  (identity composers, regex constants, helper functions in `*.shared.ts`
  files, plus two `TaggedErrorClass`es in `EntitySchema.shape.ts` that are
  intentionally excluded from the `EntitySchema/index.ts` re-export list):
  imported via a relative path from the compiled example location
  (`docs/examples/*.ts`) back to source — `../../src/<Dir>/<File>.ts` —
  since no `@beep/schema/*` path alias reaches these modules. Verified this
  resolves correctly via `bun run docgen`.
- `exampleImportViolations` (`wrong-required-namespace-alias`): replaced
  `import * as Schema from "effect/Schema"` with the mandated `S` alias
  across `Model.codecs.ts`, `Model.datetime.ts`, `Model.fields.ts`,
  `Model.sqlite.ts`, `Model.uuid.ts`, `Model.variants.ts`.
- `unsafeExampleViolations` (`no-type-assertions-in-examples`), all six in
  `EntitySchema.persist.ts`: replaced `console.log({} as { k: X })` casts with
  real typed-const construction — either a literal object matching the
  narrowed conditional type (`PersistDescriptorByValueStrategy`,
  `PersistDescriptorFor`, `PersistDescriptorForInput`, `PersistedFor`,
  `CheckedPersistedFor`, each swapped from an abstract base type parameter to
  a concrete one, e.g. `typeof S.String`, so a plain object literal
  type-checks against the narrowed result) or an indexed-access scalar
  extraction (`EntityIdLike["entityType"]`) for the one type
  (`EntityIdLike`) that intersects a full `S.Codec` interface and has no
  reasonable literal witness.
- `schemaAnnotationGaps` on `Model.datetime.ts`'s `Date` (the only schema in
  the four directories without `$I.annote(Schema)` metadata, since `Model/`
  had no local identity composer): added
  `const $I = $SchemaId.create("Model")` (unexported, matching the
  single-file pattern in `Age.schema.ts`/`Html.ts`), applied
  `$I.annoteSchema("Date", {...})`, and converted the pre-existing
  self-referential `interface Date extends S.decodeTo<...>` (schema-type
  annotation) to the repo's dominant `export type Date = typeof Date.Type`
  decoded-value-type convention — safe because `Model.Date` as a type was
  referenced nowhere else in the repo (grep-verified) and `Date` as a value
  is only ever consumed as a schema, never type-annotated elsewhere in this
  file.
- Model.variants.ts's 8 `BindingElement` findings (`Class`, `extract`,
  `Field`, `FieldExcept`, `FieldOnly`, `fieldEvolve`, `Struct`, `Union`, all
  missing `@example`/`@category`/`@since`): the standards-inventory checker
  attributes required tags to the *original declaring node* — the destructured
  `const { Class, ... } = VariantSchema.make(...)` binding elements at line 15
  — not to the `export { /** doc */ Class, ... }` specifier block further
  down where the docs previously lived. Moved each full doc block (description
  + `@example` + `@category` + `@since`) onto its binding element. Discovered
  mid-flight that the *actual* `docgen` tool (a different checker from the
  standards inventory) independently requires `@since` on the export
  specifiers too — so both locations now carry docs: full blocks on the
  binding elements, minimal `@category`/`@since` blocks on the re-export
  specifiers pointing back at them.

## Files touched (14, no commits)

`src/Color/{Color.adjust,Color.hex,Color.oklch,Color.rgb,Color.scale,Color.shared,Color.transforms}.ts`,
`src/FilePath/{FilePath.guards,FilePath.roots,FilePath.schema,FilePath.segments,FilePath.shared,FilePath.windows}.ts`,
`src/Model/{Model.codecs,Model.datetime,Model.fields,Model.sqlite,Model.uuid,Model.variants}.ts`,
`src/EntitySchema/{EntitySchema.persist,EntitySchema.shape,EntitySchema.shared}.ts`.

## Verify

- `bun run docgen` (direct, package cwd) — re-run 4 times across the pass to
  catch regressions early: 1243 examples found, zero errors, `✓ Docs
  generation succeeded!` on every run after the fixes landed. Two errors
  surfaced and were self-fixed mid-flight: (1) `Model.variants.ts` missing
  `@since` on export specifiers after the binding-element move (see recipe
  above); (2) `EntitySchema.shape.ts`'s two `TaggedErrorClass` examples
  initially imported from the `@beep/schema/EntitySchema` barrel, but
  `EntityFieldInputError`/`EntitySchemaAttachmentError` are deliberately
  excluded from that barrel's named re-export list — switched both to the
  relative-import pattern.
- `turbo run docgen --filter=@beep/schema` (the assigned proof command):
  green — `5 successful, 5 total`, schema package example count 1243, zero
  errors.
- `npx tsgo -b` at package root: clean, no output (zero errors) — confirms
  no regressions from the `Model.datetime.ts` interface-to-type-alias
  restructuring or the `Model.variants.ts` destructuring reshuffle.
- `npx vitest run`: 70 files, 617 tests, all passed.
- `bunx biome check --write` scoped to the four fenced directories only: 31
  files checked, 1 fixed (import-order reflow in `Model.datetime.ts` after
  adding the `$SchemaId` import — cosmetic, re-verified docgen green after).

All errors observed during the pass were attributed to files inside this
lane's fence and fixed here; two transient failures seen in earlier
whole-package `bun run docgen` runs (`src/Graph/*`, `src/ExpectCt/*`) belong
to sibling shard lanes mid-flight and were left untouched, per fence
discipline — they cleared on their own by the final `turbo run docgen`
green run.
