# Identity Composer Pattern ($I)

Every schema in the codebase receives a unique identity path via an
`IdentityComposer`. The root composers live in `@beep/identity/packages` and
are named `$SharedDomainId`, `$SchemaId`, `$IamDomainId`, etc.

## Setup

```ts
import { $SharedDomainId } from "@beep/identity/packages"

// Create a file-scoped composer. The segment is the path from the package
// `src/` directory to this file, without extension.
const $I = $SharedDomainId.create("entities/Task/Task.model")
```

## Usage with class schemas (S.Class, Model.Class)

The first argument to `S.Class` or `Model.Class` is the schema identifier
produced by the template-literal call. The annotation object produced by
`$I.annote(...)` is passed as a trailing argument.

```ts
class Task extends S.Class<Task>($I`Task`)({
  name: S.String,
}, $I.annote("Task", { description: "A task entity." })) {}
```

## Usage with TaggedErrorClass

```ts
import { TaggedErrorClass } from "@beep/schema"

class TaskNotFoundError extends TaggedErrorClass<TaskNotFoundError>($I`TaskNotFoundError`)(
  "TaskNotFoundError",
  { taskId: S.Number, message: S.String },
  $I.annote("TaskNotFoundError", { description: "Raised when a task lookup fails." })
) {}
```

## Usage with non-class schemas

Non-class schemas use `$I.annoteSchema(...)` which returns a function that
calls `self.annotate(...)`.

```ts
const TaskName = S.NonEmptyTrimmedString.pipe(
  S.brand("TaskName"),
  $I.annoteSchema("TaskName", { description: "A validated task name." })
)
export type TaskName = typeof TaskName.Type
```

## How $I works internally

- `$I\`SchemaName\`` (template literal call) produces an identity string such as
  `"@beep/fixture-lab-specimen-domain/domain/Specimen/SchemaName"` in the
  golden fixture.
- `$I.annote("Name", extras)` returns an annotation record containing
  `schemaId` (an interned `Symbol` via `Symbol.for`), `identifier`, `title`,
  and any caller-supplied extras (e.g. `description`).
- `$I.annoteSchema("Name", extras)` returns a function
  `(self: Schema) => Schema` that applies the annotation record to a schema via
  `self.annotate(...)`.
- `$I.create("subpath")` creates a child composer for deeper nesting.
- `$I.compose("a", "b")` batch-creates child composers keyed as `$AId`, `$BId`.
