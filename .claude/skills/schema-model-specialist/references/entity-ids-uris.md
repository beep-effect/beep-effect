# EntityId and Template-Literal URIs

## EntityId

Entity ids are branded values created in the slice that owns the persisted
concept. The lean slate no longer has a shared entity-id factory.

### Defining entity ids

```ts
import { $FixtureLabSpecimenId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $FixtureLabSpecimenId.create("entity-ids/MySlice")
export const TaskId = S.String.pipe(
  S.brand("TaskId"),
  $I.annoteSchema("TaskId", { description: "Task identifier." })
)
export type TaskId = typeof TaskId.Type
```

The resulting schema:
- validates the chosen persisted id representation
- carries the slice-local identity annotation

### Using entity ids in models

```ts
id: M.Generated(Shared.TaskId)
```

The `M.Generated` wrapper ensures the `id` field is omitted from `insert`
(auto-increment) and present in `select`, `update`, and `json`.

## S.TemplateLiteral for branded URIs

Use `S.TemplateLiteral` to create schemas that validate strings matching a
template literal pattern. Each part can be a literal string or a schema.

```ts
import * as S from "effect/Schema"

// Simple URI pattern
const PageNodeId = S.TemplateLiteral(["beep:page/", S.NonEmptyString]).pipe(
  $I.annoteSchema("PageNodeId", { description: "URI for page nodes." })
)
// Validates: "beep:page/my-page-slug"

// Compound URI with multiple schema parts
const SymbolNodeId = S.TemplateLiteral([
  "beep:symbol/", RepoId, "/", QualifiedName
]).pipe(
  $I.annoteSchema("SymbolNodeId", { description: "URI for code symbol nodes." })
)
// Validates: "beep:symbol/my-repo/com.example.MyClass"
```

For parsing the matched parts back into a tuple, use `S.TemplateLiteralParser`:

```ts
const UserPath = S.TemplateLiteralParser(["/user/", S.NumberFromString])
// Decodes "/user/42" => readonly ["/user/", 42]
```
