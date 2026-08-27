# Round 3 fix report — docgen class members (schemastore + ontoskills)

Scratchpad `docgen` was failing on missing description / example / `@since`
findings for class members (and nested namespace type aliases in OntoSkills).
Runtime behavior was not changed. JSDoc only.

Finding counts in the prompt are checker errors, not member counts: a member
that already had a lead but no titled Example is one finding; a getter with
no JSDoc is two (`Missing description` + `Missing examples`). Nested
`export type` aliases also require a lead and `@since` (examples optional).

## Changed files

Schemastore:

- `scratchpad/schemastore/SchemaVersioning.ts`
- `scratchpad/schemastore/SchemaPipeline.ts`
- `scratchpad/schemastore/StoreDocument.ts`
- `scratchpad/schemastore/SchemaFile.ts`
- `scratchpad/schemastore/CanonicalJson.ts`
- `scratchpad/schemastore/DocumentDiff.ts`
- `scratchpad/schemastore/CatalogEntry.ts`
- `scratchpad/schemastore/AnnotationCarriers.ts`
- `scratchpad/schemastore/SchemaValidator.ts`
- `scratchpad/schemastore/SchemaTarget.ts`
- `scratchpad/schemastore/KeywordFamilies.ts`
- `scratchpad/schemastore/DocumentLint.ts`

OntoSkills:

- `scratchpad/ontoskills/OntoSkills.models.ts`

## Members documented

Each runtime method / getter has a one-paragraph lead, one titled
`**Example** (Title)` with a single `ts` fence, and `@since 0.0.0`. Nested
`Type` / `Encoded` aliases are prose + `@category type-level` + `@since 0.0.0`
(no Example). Existing `@throws` / `@see` tags stay after the Example.

### Schemastore — methods and getters

`SchemaVersioning.ts` (7 findings)

- `InvalidSchemaVersionError.message`
- `SchemaVersioning.parseResult`
- `SchemaVersioning.latest`
- `SchemaVersioning.fileName`
- `SchemaVersioning.schemaUrl`
- `SchemaVersioning.catalogUrls`

`SchemaPipeline.ts` (7)

- `PipelineFinding.label`
- `SchemaGateError.message`
- `SchemaPipeline.run`
- `SchemaPipeline.check`
- `SchemaPipeline.runOne`
- `SchemaPipeline.checkOne`

`StoreDocument.ts` (6)

- `SchemaConversionError.message`
- `StoreDocument.draft07`
- `StoreDocument.fromSchemaResult`
- `StoreDocument.toJson`
- `StoreDocument.serializeResult`

`SchemaFile.ts` (6)

- `SchemaFileReadError.message`
- `SchemaFileNotFoundError.message`
- `SchemaFileWriteError.message`

`CanonicalJson.ts` (5)

- `NonJsonValueError.message`
- `JsonDepthExceededError.message`
- `CanonicalJson.serializeResult`

`DocumentDiff.ts` (3)

- `DocumentDiff.classify`
- `DocumentDiff.isClean`
- `DocumentDiff.isAnnotationKeyword`

`CatalogEntry.ts` (3)

- `CatalogEntry.assemble`
- `CatalogEntry.lint`
- `CatalogEntry.lintFileMatch`

`AnnotationCarriers.ts` (3)

- `CarrierDepthExceededError.message`
- `AnnotationCarriers.carryResult`

`SchemaValidator.ts` (2)

- `SchemaValidatorError.message`

`SchemaTarget.ts` (1)

- `SchemaTarget.make` (first overload — `parseMethod` reads overload-head JSDoc)

`KeywordFamilies.ts` (1)

- `KeywordFamilies.isDeclared`

`DocumentLint.ts` (1)

- `DocumentLint.lint`

Schemastore Example imports stay on `@beep/scratchpad/schemastore` (and
`@beep/scratchpad/memfs` for pipeline write/check). Pipeline / `runOne` /
`checkOne` examples provide `SchemaFile.layer` + `SchemaValidator.layer` +
`MemoryFileSystem.layer` + `Path.layer`.

Static properties (`parse`, `Order`, `fromSchema`, `serialize`, `carry`,
`layer`, `make`, `noop`, `makeTest`, `layerTest`) are not parsed by
`parseClass` (`getStaticMethods` is `MethodDeclaration[]` only) and were
not in the finding counts.

### OntoSkills.models.ts (22 findings)

Getter (lead + Example + `@since`):

- `ExtractedSkill.skillType`

Nested namespace aliases (lead + `@category type-level` + `@since`; no Example):

- `ProcedureStep.Type` / `ProcedureStep.Encoded`
- `BulletItem.Type` / `BulletItem.Encoded`
- `ContentBlock.Type` / `ContentBlock.Encoded`
- `Section.Type` / `Section.Encoded`
- `SkeletonNode.Type` / `SkeletonNode.Encoded`

Also rewrote every Example import from `./OntoSkills.models.ts` to
`../../../ontoskills/OntoSkills.models.ts` so fences compile from
`.jsdoc-loop/generated-docs/examples/` once the description/example gate is
green and `typeCheckExamples` runs.

## Residual risk

- This fixer process has no shell tool, so focused `docgen` / `docgen:local`
  / package `check` were not executed here. Parent must run the commands
  below.
- `SchemaTarget.make` Example lives on the unversioned overload (the one
  `parseMethod` reads). The versioned overload and implementation keep their
  existing leads.
- Pipeline `run` / `check` Examples assume `S.Struct({ name: S.String })`
  produces no warning-severity findings (same assumption as the class-level
  `checkOne` Example).
- `thunkThis` lazy class thunks remain undocumented: they are static
  properties, not `MethodDeclaration`s, so docgen does not check them.

## Commands

```bash
zsh -ic 'bun run --cwd scratchpad docgen --include "schemastore/SchemaVersioning.ts,schemastore/SchemaPipeline.ts,schemastore/StoreDocument.ts,schemastore/SchemaFile.ts,schemastore/CanonicalJson.ts,schemastore/DocumentDiff.ts,schemastore/CatalogEntry.ts,schemastore/AnnotationCarriers.ts,schemastore/SchemaValidator.ts,schemastore/SchemaTarget.ts,schemastore/KeywordFamilies.ts,schemastore/DocumentLint.ts,ontoskills/OntoSkills.models.ts"'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
```
