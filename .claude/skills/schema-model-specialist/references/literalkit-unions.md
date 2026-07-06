# LiteralKit and Tagged Unions

## Contents

- [LiteralKit](#literalkit)
- [LiteralKit.toTaggedUnion](#literalkittotaggedunion)
- [LiteralKit with mapMembers + S.toTaggedUnion](#literalkit-with-mapmembers--stotaggedunion)
- [S.toTaggedUnion](#stotaggedunion)

## LiteralKit

Use `LiteralKit` for any literal string union that needs runtime helpers.
Never use raw `S.Literal(...)` or `S.Literals(...)` for internal literal
domains.

### Definition

```ts
import { LiteralKit } from "@beep/schema"

const TaskStatus = LiteralKit(["draft", "active", "completed", "archived"])
```

### Available helpers

| Helper                | Type                                     | Purpose                       |
|-----------------------|------------------------------------------|-------------------------------|
| `TaskStatus.Options`  | `readonly ["draft", "active", ...]`      | The raw literal tuple         |
| `TaskStatus.Enum`     | `{ draft: "draft", active: "active", ...}` | Enum-like object            |
| `TaskStatus.is.draft` | `(u: unknown) => boolean`                | Per-member type guard         |
| `TaskStatus.$match`   | `(value, cases) => result`               | Exhaustive pattern match      |
| `TaskStatus.thunk.draft` | `() => "draft"`                       | Thunk returning the literal   |
| `TaskStatus.pickOptions(["draft", "active"])` | Subset tuple          | Subset selection              |
| `TaskStatus.omitOptions(["archived"])` | Complement tuple             | Omit selection                |

## LiteralKit.toTaggedUnion

`LiteralKit` provides a `.toTaggedUnion(tag)` method that builds a full
discriminated union from a cases record:

```ts
const TaskEvent = TaskStatus.toTaggedUnion("status")({
  draft:     { body: S.String },
  active:    { activatedAt: S.DateTimeUtcFromMillis },
  completed: { completedBy: S.String },
  archived:  { reason: S.String },
})
```

This produces a union with `.match`, `.cases`, `.guards`, and `.isAnyOf`.

## LiteralKit with mapMembers + S.toTaggedUnion

`mapMembers` is inherited from the underlying `S.Literals` type, not a
LiteralKit-specific addition. Use it with `Tuple.evolve` + `S.toTaggedUnion`
when each member needs to be a full `S.Class` with methods and identity.

When to use each approach:
- `toTaggedUnion(tag)(cases)` -- quick struct-based unions from inline field definitions (no per-member class needed)
- `mapMembers` + `S.toTaggedUnion` -- when each member is a full `S.Class` with its own identity, methods, or annotations

```ts
import { LiteralKit } from "@beep/schema"
import { Tuple } from "effect"
import * as S from "effect/Schema"

const TaskStateTag = LiteralKit(["draft", "active", "archived"])

class TaskDraft extends S.Class<TaskDraft>($I`TaskDraft`)(
  { state: S.tag("draft"), body: S.String },
  $I.annote("TaskDraft", { description: "Draft task state." })
) {}

class TaskActive extends S.Class<TaskActive>($I`TaskActive`)(
  { state: S.tag("active"), assignee: S.String },
  $I.annote("TaskActive", { description: "Active task state." })
) {}

class TaskArchived extends S.Class<TaskArchived>($I`TaskArchived`)(
  { state: S.tag("archived"), reason: S.String },
  $I.annote("TaskArchived", { description: "Archived task state." })
) {}

export const TaskState = TaskStateTag
  .mapMembers(Tuple.evolve([
    () => TaskDraft,
    () => TaskActive,
    () => TaskArchived,
  ]))
  .pipe(S.toTaggedUnion("state"))
  .annotate($I.annote("TaskState", { description: "Task lifecycle states." }))

export type TaskState = typeof TaskState.Type
```

## S.toTaggedUnion

`S.toTaggedUnion` augments an existing `S.Union` of tagged structs with
utility methods keyed by the discriminant field.

### Construction

```ts
import * as S from "effect/Schema"

const A = S.TaggedStruct("A", { value: S.Number })
const B = S.TaggedStruct("B", { name: S.String })

const MyUnion = S.Union([A, B]).pipe(S.toTaggedUnion("_tag"))
```

### Attached helpers

| Helper              | Signature                                       | Purpose                    |
|---------------------|-------------------------------------------------|----------------------------|
| `MyUnion.match`     | `(value, cases) => R` or `(cases) => (value) => R` | Exhaustive pattern match |
| `MyUnion.cases.A`   | Schema for variant A                             | Per-variant schema access  |
| `MyUnion.guards.A`  | `(u: unknown) => u is A`                         | Per-variant type guard     |
| `MyUnion.isAnyOf`   | `(keys: K[]) => (value) => boolean`              | Multi-variant guard        |

Rules:
- Always use `S.tag(literal)` on the discriminator field in struct members.
- Use `S.toTaggedUnion` for non-`_tag` discriminants (e.g. `"kind"`, `"status"`, `"type"`).
- Use `S.TaggedUnion({...})` shorthand only for canonical `_tag` unions.
