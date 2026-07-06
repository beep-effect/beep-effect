# Always / Never — Core Modeling (Examples 1-9)

Loaded on demand from `effect-first-development/SKILL.md`. Repository laws win on conflict.

## Table of Contents

- [1) Absence handling](#1-absence-handling)
- [2) Typed error boundary](#2-typed-error-boundary)
- [3) Schema naming + annotation](#3-schema-naming--annotation)
- [4) Type checks](#4-type-checks)
- [4b) Schema-backed guards + internal modeling](#4b-schema-backed-guards--internal-modeling)
- [5) Match over switch](#5-match-over-switch)
- [6) Tagged unions and exhaustive branching](#6-tagged-unions-and-exhaustive-branching)
- [7) Service identity via package composer](#7-service-identity-via-package-composer)
- [8) Discriminated union schemas](#8-discriminated-union-schemas)
- [9) Effect-returning functions](#9-effect-returning-functions)

### 1) Absence handling

```ts
import { pipe } from "effect"
import * as A from "effect/Array"
import * as O from "effect/Option"

// NEVER: User | undefined
// const user = users.find((u) => u.id === id)

// ALWAYS: Option<User>
const user = pipe(
  users,
  A.findFirst((u) => u.id === id)
)

const name = pipe(
  user,
  O.map((u) => u.name),
  O.getOrElse(() => "anonymous")
)
```

### 2) Typed error boundary

```ts
import { Effect } from "effect"
import * as S from "effect/Schema"
import { $PackageNameId } from "@beep/identity/packages"
import { TaggedErrorClass } from "@beep/schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class JsonParseError extends TaggedErrorClass<JsonParseError>($I`JsonParseError`)(
  "JsonParseError",
  { message: S.String, input: S.String },
  $I.annote("JsonParseError", { description: "Invalid JSON payload" })
) {}

const parseJson = (raw: string) =>
  S.decodeUnknownEffect(S.UnknownFromJsonString)(raw).pipe(
    Effect.mapError((cause) => new JsonParseError({ message: cause.message, input: raw }))
  )
```

### 3) Schema naming + annotation

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

// NEVER: export const UserSchema = S.Struct(...)
// NEVER: export interface User { readonly id: string; readonly name: string }
// ALWAYS: prefer S.Class for object schemas.
export class User extends S.Class<User>($I`User`)(
  {
    id: S.String,
    name: S.String
  },
  $I.annote("User", {
    description: "Application user payload."
  })
) {}

const decodeUser = S.decodeUnknownEffect(User)
```

### 4) Type checks

```ts
import * as P from "effect/Predicate"

// NEVER: typeof value === "string"
// ALWAYS:
const isStringValue = P.isString(value)
```

### 4b) Schema-backed guards + internal modeling

```ts
import { LiteralKit } from "@beep/schema"
import { $PackageNameId } from "@beep/identity/packages"
import { Match, pipe } from "effect"
import * as A from "effect/Array"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

const TopicKind = LiteralKit(["plain", "scoped"])

const ContainsScopeSeparator = S.String.check(
  S.isIncludes(":", {
    identifier: $I`ContainsScopeSeparatorCheck`,
    title: "Contains Scope Separator",
    description: "A string that contains `:`.",
    message: "Topic text must contain :"
  })
).pipe(
  S.brand("ContainsScopeSeparator"),
  $I.annoteSchema("ContainsScopeSeparator", {
    description: "A string containing the topic scope separator `:`."
  })
)

const isContainsScopeSeparator = S.is(ContainsScopeSeparator)

const TopicSegment = S.NonEmptyString.check(
  S.makeFilter(P.not(isContainsScopeSeparator), {
    identifier: $I`TopicSegmentNoSeparatorCheck`,
    title: "Topic Segment No Separator",
    description: "A topic segment that does not contain `:`.",
    message: "Topic segments must not contain :"
  })
).pipe(
  S.brand("TopicSegment"),
  $I.annoteSchema("TopicSegment", {
    description: "A non-empty topic segment without the scope separator."
  })
)

const isTopicSegment = S.is(TopicSegment)

const splitNonEmpty =
  (separator: string | RegExp) =>
  (value: string): ReadonlyArray<string> =>
    pipe(Str.split(separator)(value), A.filter(Str.isNonEmpty))

const classifyTopicKind = Match.type<string>().pipe(
  Match.when(isContainsScopeSeparator, TopicKind.thunk.scoped),
  Match.orElse(TopicKind.thunk.plain)
)

export const TopicName = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(P.not(Str.endsWith(":")), {
        identifier: $I`TopicNameNoTrailingSeparatorCheck`,
        title: "Topic Name No Trailing Separator",
        description: "A topic name that does not end with `:`.",
        message: "Topic names must not end with :"
      }),
      S.makeFilter((value: string) =>
        pipe(
          value,
          classifyTopicKind,
          TopicKind.$match({
            plain: isTopicSegment,
            scoped: () => pipe(value, splitNonEmpty(":"), A.every(isTopicSegment))
          })
        ), {
        identifier: $I`TopicNameSegmentsCheck`,
        title: "Topic Name Segments",
        description: "A topic name whose segments are valid topic segments.",
        message: "Topic names must contain only valid segments"
      })
    ],
    {
      identifier: $I`TopicNameChecks`,
      title: "Topic Name",
      description: "Checks for a plain or scoped topic name."
    })
  )
).pipe(
  S.brand("TopicName"),
  $I.annoteSchema("TopicName", {
    description: "A topic name composed from valid plain or scoped segments."
  })
)
```

// NEVER: build forests of regex/predicate helpers when the named concepts can be schemas.

### 5) Match over switch

```ts
import { Match } from "effect"
import * as A from "effect/Array"

type Status = "queued" | "running" | "failed"

// NEVER:
// switch (status) {
//   case "queued": return "queued"
//   case "running": return "running"
//   case "failed": return "failed"
// }

// ALWAYS:
const toLabel = Match.type<Status>().pipe(
  Match.when("queued", () => "queued"),
  Match.when("running", () => "running"),
  Match.when("failed", () => "failed"),
  Match.exhaustive
)

const summarize = (items: ReadonlyArray<string>) =>
  A.match(items, {
    onEmpty: () => "none",
    onNonEmpty: (values) => `count:${A.length(values)}`
  })
```

### 6) Tagged unions and exhaustive branching

```ts
import { LiteralKit } from "@beep/schema"
import { $PackageNameId } from "@beep/identity/packages"
import { Tuple } from "effect"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

const JobStateTag = LiteralKit(["queued", "running", "failed"])

export class JobQueued extends S.Class<JobQueued>($I`JobQueued`)(
  { state: S.tag("queued") },
  $I.annote("JobQueued", { description: "Queued job state." })
) {}

export class JobRunning extends S.Class<JobRunning>($I`JobRunning`)(
  { state: S.tag("running"), workerId: S.String },
  $I.annote("JobRunning", { description: "Running job state." })
) {}

export class JobFailed extends S.Class<JobFailed>($I`JobFailed`)(
  { state: S.tag("failed"), reason: S.String },
  $I.annote("JobFailed", { description: "Failed job state." })
) {}

export const JobState = JobStateTag
  .mapMembers(Tuple.evolve([
    () => JobQueued,
    () => JobRunning,
    () => JobFailed
  ]))
  .pipe(S.toTaggedUnion("state"))
  .annotate($I.annote("JobState", { description: "Job lifecycle state union." }))

export type JobState = typeof JobState.Type

export const render = (state: JobState) =>
  JobState.match(state, {
    queued: () => "queued",
    running: ({ workerId }) => `running:${workerId}`,
    failed: ({ reason }) => `failed:${reason}`
  })
```

### 7) Service identity via package composer

```ts
import { $PackageNameId } from "@beep/identity/packages"
import { Context } from "effect"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class MyService extends Context.Service<MyService, {
  readonly ping: () => string
}>()($I`MyService`) {}
```

### 8) Discriminated union schemas

```ts
import { LiteralKit } from "@beep/schema"
import { $PackageNameId } from "@beep/identity/packages"
import { Tuple } from "effect"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

// Preferred when the discriminant is `_tag`.
export const TaskEvent = S.TaggedUnion({
  Created: { id: S.String },
  Completed: { id: S.String, at: S.String }
}).annotate($I.annote("TaskEvent", {
  description: "Canonical internal event union discriminated by `_tag`."
}))

// Use toTaggedUnion for external unions or non-standard discriminants.
export class ExternalTaskCreated extends S.Class<ExternalTaskCreated>($I`ExternalTaskCreated`)({
  kind: S.tag("created"),
  id: S.String
}) {}

export class ExternalTaskCompleted extends S.Class<ExternalTaskCompleted>($I`ExternalTaskCompleted`)({
  kind: S.tag("completed"),
  id: S.String,
  at: S.String
}) {}

const ExternalTaskKind = LiteralKit(["created", "completed"])

export const ExternalTaskEvent = ExternalTaskKind
  .mapMembers(Tuple.evolve([
    () => ExternalTaskCreated,
    () => ExternalTaskCompleted
  ]))
  .pipe(S.toTaggedUnion("kind"))
  .annotate($I.annote("ExternalTaskEvent", {
    description: "External task events discriminated by `kind`."
  }))
```

### 9) Effect-returning functions

```ts
import { Effect } from "effect"
import * as S from "effect/Schema"

// Public or reusable flow: traced.
export const fetchProfile = Effect.fn("Profile.fetch")(function* (userId: string) {
  yield* Effect.logDebug("fetch profile", userId)
  return { userId }
})

// Internal hot-path flow: untraced.
const parseSmallPayload = Effect.fnUntraced(function* (raw: string) {
  return yield* S.decodeUnknownEffect(S.UnknownFromJsonString)(raw)
})

// Zero-arg reusable values can stay as effects instead of immediate Effect.fn() invocation.
const loadAppConfig = Effect.gen(function* () {
  return yield* S.decodeUnknownEffect(S.Struct({ port: S.Number }))({ port: 8787 })
}).pipe(Effect.withSpan("AppConfig.load"))
```
