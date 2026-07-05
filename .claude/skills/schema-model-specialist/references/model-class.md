# Model.Class, Field Helpers, Defaults, and Tables

## Contents

- [Model.Class (variant-aware domain models)](#modelclass-variant-aware-domain-models)
- [Auto-generated variants](#auto-generated-variants)
- [Audit fields](#audit-fields)
- [Model field helpers](#model-field-helpers)
- [S.optionalKey + withKeyDefaults](#soptionalkey--withkeydefaults)
- [Table/read models](#tableread-models)

## Model.Class (variant-aware domain models)

For variant-aware entities, use `@beep/schema/Model` directly. The old shared
domain factory was removed with the lean slate; the topology generator will
reintroduce any slice-local factory only after the golden fixture proves the
shape.

### Canonical pattern

```ts
import { $FixtureLabSpecimenId } from "@beep/identity/packages"
import * as M from "@beep/schema/Model"
import * as S from "effect/Schema"

const $I = $FixtureLabSpecimenId.create("domain/Task")
const TaskId = S.String.pipe(S.brand("TaskId"))

export class Task extends M.Class<Task>($I`TaskModel`)(
  {
    id: M.GeneratedByApp(TaskId),
    name: S.NonEmptyTrimmedString,
    status: TaskStatus,
  },
  $I.annote("TaskModel", { description: "Persisted task entity." })
) {}
```

## Auto-generated variants

A Model class produces six variant schemas:

| Variant          | Purpose                 | Generated/Optional fields            |
|------------------|-------------------------|--------------------------------------|
| `Task`           | select (default)        | All fields present                   |
| `Task.insert`    | database insert          | `M.Generated` fields omitted         |
| `Task.update`    | database patch           | id required, rest optional           |
| `Task.json`      | API read                 | `M.Sensitive` fields omitted         |
| `Task.jsonCreate`| API creation payload     | No Generated or Sensitive fields     |
| `Task.jsonUpdate`| API update payload       | id required, rest optional, no Sensitive |

Each variant has a `.make()` constructor.

## Audit fields

Until the topology factory extracts a slice-local model helper, define audit
fields explicitly with `@beep/schema/Model` field helpers when a persisted
model needs them. Do not import a removed shared factory.

## Model field helpers

| Helper                    | Variants present                        | Use case                          |
|---------------------------|-----------------------------------------|-----------------------------------|
| `M.Generated(schema)`    | select, update, json                    | DB-generated (id, version)        |
| `M.GeneratedByApp(schema)` | select, insert, update, json          | App-generated (UUID, slug)        |
| `M.Sensitive(schema)`    | select, insert, update                  | Never in JSON (password hash)     |
| `M.FieldOption(schema)`  | All variants, nullable/optional         | Nullable columns                  |
| `M.Field({...})`         | Specified variants only                 | Custom per-variant schemas        |
| `M.FieldOnly(["json"])(s)` | Only listed variants                  | JSON-only computed fields         |
| `M.FieldExcept(["insert"])(s)` | All except listed                 | Read-only fields                  |
| `M.DateTimeInsertFromNumber` | select+insert+json, auto-now on insert | `createdAt`                    |
| `M.DateTimeUpdateFromNumber` | select+insert+update+json, auto-now   | `updatedAt`                    |
| `M.BooleanSqlite`        | All (0/1 in DB, boolean in JSON)        | Boolean columns                   |

## S.optionalKey + withKeyDefaults

When a field should have a default value for both construction and decoding of
missing keys:

```ts
import { SchemaUtils } from "@beep/schema"
import * as S from "effect/Schema"

const status = S.optionalKey(TaskStatus).pipe(SchemaUtils.withKeyDefaults("draft"))
// Constructor: new Task({}) => status defaults to "draft"
// Decoding: missing "status" key => defaults to "draft"
```

`withKeyDefaults` is a dual that combines `S.withConstructorDefault` and
`S.withDecodingDefaultKey` using the same value. The default value must be
valid for both the schema's `Type` and `Encoded` representations.

## Table/read models

The lean slate does not keep a shared table factory. Put read models and table
metadata in the generated slice table package and mirror the golden fixture
until the generator extracts a reusable helper.

```ts
import type { SpecimenStatus } from "@beep/fixture-lab-specimen-domain"

export type SpecimenReadModel = {
  readonly id: string
  readonly label: string
  readonly status: SpecimenStatus
  readonly observedAt: Date | null
}

export const specimenTableName = "fixture_lab_specimen"
```

The fixture source is
`packages/tooling/tool/cli/test/fixtures/repo-architecture-automation/expected/fixture-lab/Specimen/packages/tables/src/SpecimenReadModel.ts`.

Never define these columns manually. Never create drizzle tables without
`Table.make`.
