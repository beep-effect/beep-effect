---
name: schema-model-specialist
description: >
  Advanced schema-first domain modeling with Model.Class, EntityId, $I identity
  composers, LiteralKit, S.TemplateLiteral, S.toTaggedUnion, Table.make, and
  DomainModel.make. Use when creating persisted CRUD entities, defining entity
  ids, composing tagged unions, building URI schemas, wiring drizzle tables, or
  reviewing domain model code for repo-law compliance.
---

# Schema Model Specialist

Domain model authoring for this repository. Extends `schema-first-development`
with the advanced patterns for persisted entities, identity composers,
variant-aware Model classes, and drizzle table factories. Treat every rule
below as enforced repository law.

## Workflow

1. Classify the task, then load ONLY the matching reference file(s):
   - New persisted CRUD entity (Model.Class + Table.make) →
     `references/model-class.md` (also covers field helpers, audit fields,
     `withKeyDefaults`, table/read models)
   - New EntityId or URI/template-validated string →
     `references/entity-ids-uris.md`
   - New literal domain or tagged union (LiteralKit, `S.toTaggedUnion`) →
     `references/literalkit-unions.md`
   - `$I` setup, `annote` vs `annoteSchema`, TaggedErrorClass identity →
     `references/identity-composer.md`
   - Review or lint-fix of model code → Enforcement Rules + Verification
     Checklist below
2. Consult `schema-first-development` (repo schema laws) and
   `effect-first-development` (Effect rules) as needed.
3. Apply the patterns from the loaded references.
4. Verify before finishing using the checklist below.

## Enforcement Rules

Non-negotiable; override any conflicting guidance.

1. **Schema-first**: Always `S.Class` or `Model.Class` over type aliases and
   interfaces for data models, even without immediate runtime validation.
2. **Identity required**: Every schema MUST use `$I.annote(...)` (class
   schemas) or `$I.annoteSchema(...)` (non-class schemas). No anonymous
   schemas in exported APIs.
3. **Discriminated unions**: MUST use `S.tag(literal)` on discriminator fields
   and finalize with `S.toTaggedUnion(discriminant)` for `.match`, `.cases`,
   `.guards`. Use `S.TaggedUnion({...})` only when the discriminant is `_tag`.
4. **Literal unions**: MUST use `LiteralKit` for any literal string union
   needing guards, matching, or enum access. Never raw `S.Literal`/`S.Literals`
   for internal literal domains.
5. **Optional keys with defaults**: MUST use
   `S.optionalKey(schema).pipe(SchemaUtils.withKeyDefaults(default))` to set
   constructor and decoding defaults in one step.
6. **CRUD entities**: MUST use `DomainModel.make` with entity-specific fields
   for anything persisted to SQLite. The factory provides all audit columns.
7. **Append-only events**: Use `S.TaggedClass` or `S.Class` with `S.tag` and
   `$I` identity. No Model.Class for non-persisted event schemas.
8. **URIs and template strings**: Use `S.TemplateLiteral` for branded URI
   types. Brand and annotate the result.
9. **Tables**: Use `Table.make(entityId)(columns)`. Never define drizzle
   tables manually or redefine audit columns.
10. **EntityId**: Use `EntityId.factory(slice, $I)` for a per-slice maker,
    then `make(tag, { tableName })` per entity id. Always export the companion
    type alias: `export type TaskId = typeof TaskId.Type`.
11. **Non-class schema type aliases**: Always export the same-name runtime
    type alias: `export type TaskName = typeof TaskName.Type`.
12. **No `Schema` suffix**: Never suffix schema constants with `Schema`. Use
    the domain name directly.

## Source References

- `packages/common/identity/src/Id.ts` (IdentityComposer interface)
- `packages/common/identity/src/packages.ts` (pre-built composers)
- `packages/common/schema/src/Model.ts` (Model.Class, Generated, Field helpers)
- `packages/common/schema/src/LiteralKit.ts` (LiteralKit constructor and types)
- `packages/common/schema/src/SchemaUtils/withKeyDefaults.ts` (withKeyDefaults dual)
- `packages/common/schema/src/TaggedErrorClass.ts` (TaggedErrorClass constructor)
- `packages/tooling/tool/cli/test/fixtures/repo-architecture-automation/expected/fixture-lab/Specimen/packages/domain/src/Specimen.ts` (golden slice domain model)
- `packages/tooling/tool/cli/test/fixtures/repo-architecture-automation/expected/fixture-lab/Specimen/packages/tables/src/SpecimenReadModel.ts` (golden slice read model)
- `.repos/effect-v4/packages/effect/src/Schema.ts` (TemplateLiteral, toTaggedUnion)
- `.repos/effect-v4/packages/effect/src/unstable/schema/Model.ts` (upstream Model)

## Verification Checklist

Run these greps after model work (all with `--glob "*.ts"` over `packages`):

```sh
# Identity: every class schema carries $I annotation
rg -n "extends S\.Class<" packages --glob "*.ts" | grep -v "\$I"
rg -n "extends DomainModel\.make<" packages --glob "*.ts" | grep -v "\$I"
# No anonymous non-class schemas in exports
rg -n "^export const [A-Za-z]+ = S\." packages --glob "*.ts" | grep -v "annoteSchema\|annotate"
# Naming: no Schema suffix; non-class schemas export `type X = typeof X.Type`
rg -n "export const [A-Za-z0-9_]+Schema\b" packages --glob "*.ts"
# Models/tables: each Table.make entity has a Model.Class counterpart;
# EntityId uses the factory pattern
rg -n "Table\.make|EntityId\.factory|EntityId\.make" packages --glob "*.ts"
# LiteralKit: no raw S.Literal / S.Literals for internal domains
rg -n "S\.Literal\b\(|S\.Literals\b\(" packages --glob "*.ts"
# Tagged unions: S.tag on discriminators; no manual _tag guard helpers
rg -n "S\.toTaggedUnion" packages --glob "*.ts"
rg -n "P\.hasProperty.*_tag|_tag.*===|typeof.*_tag" packages --glob "*.ts"
# Read models stay in the owning slice
rg -n "ReadModel|TableName|sqliteTable" packages --glob "*.ts"
# withConstructorDefault paired with withDecodingDefaultKey => migrate to withKeyDefaults
rg -n "withConstructorDefault" packages --glob "*.ts"
```

## Escalation

- `schema-first-development` — basic schema work without Model.Class.
- `effect-first-development` — broader Effect patterns.
- `effect-services` / `effect-v4-services` — service and layer wiring.
- `effect-error-handling` / `effect-v4-errors` — recovery strategy outside
  schema modeling.
