# Effect-First Development

This document defines the working model behind Effect-first code in this repository.
Treat it as the long-form companion to `standards/effect-laws-v1.md`.

## Definition

Effect-first development means domain code is written in Effect-native constructs first, and native JavaScript/TypeScript patterns only at explicit boundaries.

The goal is to make failure, absence, decoding, and dependency wiring explicit and typed.

## Primary References

- [Effect LLMS guide](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/LLMS.md)
- [Effect ai-docs index](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/ai-docs/src/index.md)
- [Effect migration notes](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/MIGRATION.md)
- [Effect Schema docs](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/SCHEMA.md)

## Operating Model

Use three layers:

1. Boundary layer:
   - Parse and decode unknown input with Effect schema codecs such as `S.decodeUnknownEffect`.
   - Convert nullish values to `Option`.
   - Convert throwable/rejecting APIs to typed Effect failures.
2. Domain layer:
   - Use Effect modules (`A`, `O`, `R`, `Str`, `HashMap`, `HashSet`) and typed services.
   - Keep business logic pure, explicit, and exhaustive.
3. Runtime layer:
   - Compose layers and run effects.
   - Keep platform concerns (process, filesystem, env, network) outside core domain logic.

## Laws and Conventions

### EF-1: Errors are data, not side effects

- If logic can fail, return `Effect.Effect<A, E, R>` with a typed error `E`.
- Use `TaggedErrorClass` from `@beep/schema` for public or cross-module failures.
- Do not `throw` or use `new Error(...)` in production domain logic.

Example:

```ts
import { Effect } from "effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { $PackageNameId } from "@beep/identity/packages"
import { TaggedErrorClass } from "@beep/schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class MissingConfigError extends TaggedErrorClass<MissingConfigError>($I`MissingConfigError`)(
  "MissingConfigError",
  { key: S.String },
  $I.annote("MissingConfigError", { description: "Required configuration key is missing" })
) {}

const requireEnv = (key: string) =>
  Effect.sync(() => process.env[key]).pipe(
    Effect.flatMap((value) =>
      O.match(O.fromNullishOr(value), {
        onNone: () => Effect.fail(new MissingConfigError({ key })),
        onSome: Effect.succeed
      })
    )
  )
```

### EF-2: Absence is `Option`

- Inside domain code, avoid `| null` and `| undefined`.
- Convert nullable values at boundaries via `O.fromNullishOr`.
- Consume via `O.map`, `O.flatMap`, `O.match`, `O.getOrElse`.
- For `Option`-valued object fields, prefer `O.getSomesStruct({...})` (`@beep/utils`) for heterogeneous struct spreads with known keys — runtime-identical to `R.getSomes` but preserves per-key literal types; reserve `R.getSomes({...})` for homogeneous dynamic-key dictionaries. Use `O.all({...})` when the whole object is all-or-nothing, and `S.OptionFrom*` when optionality/nullability belongs at the schema boundary. (Amended 2026-07-05 — see `standards/architecture/DECISIONS.md`.)
- Avoid `O.match(...)` with `onNone: () => ({})`; for a single `Option` becoming an object, prefer `O.map(...)` plus `O.getOrElse(() => ({}))`.

Example:

```ts
import { pipe } from "effect"
import * as O from "effect/Option"

const toDisplayName = (rawName: string | null | undefined) =>
  pipe(
    O.fromNullishOr(rawName),
    O.map((name) => name.trim()),
    O.filter((name) => name.length > 0),
    O.getOrElse(() => "anonymous")
  )
```

### EF-3: Decode unknown input with `Schema`

- Unknown or external data must be decoded at the boundary.
- Prefer Effect codecs by default: `S.decodeUnknownEffect` / `S.decodeEffect` for decoding, and `S.encodeUnknownEffect` / `S.encodeEffect` for encoding.
- When schema errors cross a local boundary, immediately map them into the boundary's typed error with `Effect.mapError(...)`.
- Use `S.decodeUnknownResult` / `S.decodeResult` or `S.decodeUnknownOption` only for deliberately synchronous, non-throwing local paths. Do not use `S.decodeSync`, `S.decodeUnknownSync`, `S.encodeSync`, or `S.encodeUnknownSync` by default.
- Never use `JSON.parse` / `JSON.stringify`; use schema JSON codecs (`S.UnknownFromJsonString`, `S.fromJsonString`, `S.decodeUnknownEffect`, `S.encodeUnknownEffect`, or the explicit non-throwing Result/Option forms).
- Prefer `S.Class` over `S.Struct` for object/domain schemas.
- Repo-wide outstanding schema-first findings are tracked in `standards/schema-first.inventory.jsonc` and verified by `bun run beep lint schema-first`.
- Do not name schemas with a `Schema` suffix; schema constants should be named after the domain type.
- For non-class schemas, export type aliases with the same identifier name as the schema value.

Example:

```ts
import { $PackageNameId } from "@beep/identity/packages"
import { Effect } from "effect"
import * as S from "effect/Schema"
import { TaggedErrorClass } from "@beep/schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class CreateTaskInputError extends TaggedErrorClass<CreateTaskInputError>($I`CreateTaskInputError`)(
  "CreateTaskInputError",
  { message: S.String },
  $I.annote("CreateTaskInputError", {
    description: "Failed to decode create-task input."
  })
) {}

export class CreateTaskInput extends S.Class<CreateTaskInput>($I`CreateTaskInput`)({
  id: S.String,
  title: S.String,
  priority: S.Int
}) {}

export const decodeCreateTaskInput = (input: unknown) =>
  S.decodeUnknownEffect(CreateTaskInput)(input).pipe(
    Effect.mapError((error) => new CreateTaskInputError({ message: error.message }))
  )
```

### EF-4: Canonical imports

- Required aliases:
  - `import * as A from "effect/Array"`
  - `import * as O from "effect/Option"`
  - `import * as P from "effect/Predicate"`
  - `import * as R from "effect/Record"`
  - `import * as S from "effect/Schema"`
- Prefer dedicated namespace imports for stable helper/data modules:
  - `import * as Str from "effect/String"`
  - `import * as Eq from "effect/Equal"`
  - `import * as Bool from "effect/Boolean"`
- Reserve root imports from `"effect"` for core combinators/types such as `Effect`, `Match`, `pipe`, and `flow`.
- Keep unstable imports deliberate and local.

### EF-5: Effect modules over native collection helpers

- Use `A`, `R`, `Str`, `Eq`, `HashMap`, `HashSet`, `MutableHashMap`, `MutableHashSet`.
- Avoid domain usage of native `Object`, `Map`, `Set`, `Date`, and direct native string helpers.
- When behavior is unchanged, prefer the tersest helper form: direct helper refs over trivial wrapper lambdas, `flow(...)` over passthrough `pipe(...)` callbacks, and shared thunk helpers when already in scope.

Example:

```ts
import { pipe } from "effect"
import * as A from "effect/Array"
import * as O from "effect/Option"

const findActiveEmail = (users: ReadonlyArray<{ readonly active: boolean; readonly email: string }>) =>
  pipe(
    users,
    A.findFirst((user) => user.active),
    O.map((user) => user.email)
  )
```

### EF-6: Predicate checks over raw runtime checks

- Prefer `P.isString`, `P.isNumber`, `P.isObject`, and predicate composition.
- Avoid raw `typeof`/ad-hoc runtime checks when a Predicate helper exists.

### EF-7: Branch with `Match` / `A.match`; model states with schema tagged unions

- Replace brittle if/else ladders with `Match`.
- For empty/non-empty array branching, prefer `A.match` over manual length checks.
- Do not use native `switch` statements for domain branching.
- Model domain states as schema tagged unions (see EF-13), then branch exhaustively.

Example:

```ts
import { Match } from "effect"
import * as A from "effect/Array"

type SyncPhase = "idle" | "running" | "failed"

const phaseLabel = (phase: SyncPhase) =>
  Match.value(phase).pipe(
    Match.when("idle", () => "idle"),
    Match.when("running", () => "running"),
    Match.when("failed", () => "failed"),
    Match.exhaustive
  )

const summarizeAttempts = (attempts: ReadonlyArray<number>) =>
  A.match(attempts, {
    onEmpty: () => "no-attempts",
    onNonEmpty: (values) => `attempts:${A.length(values)}`
  })
```

### EF-7b: Prefer `Bool.match` for booleans

- For boolean-driven branching, prefer `Bool.match` from `effect/Boolean` over ad-hoc `if/else`.
- This keeps control flow expression-oriented and consistent with Effect matching style.

### EF-8: Services use `Context.Service` + `Layer`

- Service identity comes from `@beep/identity` composer keys.
- Service constructors are explicit and layered.
- Dependency wiring happens in Layer composition, not hidden global state.
- Prefer `Context.Service` over older service-constructor patterns for repo-aligned service construction.
- Service identity must use package-specific composer `.create("path")` and the tagged template key form `$I\`ServiceName\``.

Example:

```ts
import { $PackageNameId } from "@beep/identity/packages"
import { Context } from "effect"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class MyService extends Context.Service<MyService, {
  readonly ping: () => string
}>()($I`MyService`) {}
```

### EF-9: Time/randomness should be effectful

- Prefer Effect runtime services such as `Clock` and `Random`.
- Avoid direct `Date.now()` and `Math.random()` in domain logic.

### EF-9b: Runtime HTTP uses Effect HTTP modules

- Do not use native `fetch` in runtime source.
- Compose requests/responses with `HttpClientRequest`, `HttpClientResponse`, `Headers`, `UrlParams`, `HttpMethod`, and `HttpBody`.
- Provide runtime client layers explicitly (`@effect/platform-bun/BunHttpClient.layer` for Bun runtimes).

### EF-10: Tests stay effect-native

- Use `@effect/vitest` and `it.effect(...)` for effectful tests.
- Keep fixtures typed and schema-validated where useful.
- When behavior claims to hold across a schema-modeled domain, prefer
  `S.toArbitrary(sourceSchema)` with FastCheck over happy-path fixture data
  alone. Add arbitrary annotations to the source schema when generation needs
  domain-specific realism.

### EF-11: Public APIs are documented

- Exported APIs in package/tooling source require JSDoc.
- Examples must remain docgen-clean.

### EF-12: Schema annotation is required

- New schemas must include meaningful annotation metadata via canonical `$I.annote(...)`.
- Annotation descriptions should encode intent, not repeat the symbol name.

Example:

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export const Tenant = S.String.annotate(
  $I.annote("Tenant", {
    description: "Logical tenant identifier used for request and storage partitioning."
  })
)

export type Tenant = typeof Tenant.Type
```

### EF-12b: Schema-first internal domain building blocks

- If an intermediate domain concept is named, reused, matched on, or structurally validated, model it as a schema first instead of an ad-hoc boolean helper.
- Prefer built-in schema constructors/checks such as `S.NonEmptyString`, `S.NonEmptyArray`, `S.TupleWithRest`, `S.Union`, `S.isPattern`, and `S.isIncludes` before reaching for `S.makeFilter`.
- Derive domain guards with `S.is(SomeSchema)`.
- If an internal literal domain needs `.is`, `.thunk`, `$match`, or an annotation-bearing schema value, use `LiteralKit`.
- Do not add `as const` to inline array literals passed directly to `LiteralKit(...)`; `LiteralKit` uses const type parameters already.
- Prefer named intermediate schemas; export and document them when reusable or when they materially clarify the module’s domain model, otherwise keep them module-local.

### EF-12c: Reusable schema checks carry metadata

- Reusable `S.makeFilter`, `S.makeFilterGroup`, and reusable built-in check blocks must include `identifier`, `title`, and `description`.
- Keep `message` focused on the user-facing decode failure.
- Tiny one-off test checks may stay lighter when the schema itself is not reusable.

### EF-13: Discriminated union schemas

- Model finite variants, lifecycle states, status/result cases, and
  case-specific payloads as discriminated unions instead of optional/nullish
  payload bags.
- If an external wire shape forces an optional/nullish bag, decode or normalize
  it at the boundary into an internal tagged model before case-specific
  branching.
- If schema properties are a union of literal strings (for example `kind`,
  `state`, `category`, `profile`, or `family`), compose variants with
  `LiteralKit`, `.mapMembers`, and `Tuple.evolve`, then finalize with
  `S.toTaggedUnion("<field>")`.
- Prefer `S.Class` for tagged union member schemas, and use the schema-derived
  `.match` helper when branching directly on the union.
- Use `S.TaggedUnion` only for canonical `_tag` object-union construction.
- Reference: [Effect schema docs](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/SCHEMA.md:1891) and [toTaggedUnion notes](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/SCHEMA.md:1934).

Example:

```ts
import { LiteralKit } from "@beep/schema"
import { $PackageNameId } from "@beep/identity/packages"
import { Tuple } from "effect"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

const ExternalJobKind = LiteralKit(["created", "completed"])

export class ExternalJobCreated extends S.Class<ExternalJobCreated>($I`ExternalJobCreated`)(
  {
    kind: S.tag("created"),
    id: S.String
  },
  $I.annote("ExternalJobCreated", {
    description: "Created event from external job source."
  })
) {}

export class ExternalJobCompleted extends S.Class<ExternalJobCompleted>($I`ExternalJobCompleted`)(
  {
    kind: S.tag("completed"),
    id: S.String,
    at: S.String
  },
  $I.annote("ExternalJobCompleted", {
    description: "Completed event from external job source."
  })
) {}

export const ExternalJobEvent = ExternalJobKind
  .mapMembers(
    Tuple.evolve([
      () => ExternalJobCreated,
      () => ExternalJobCompleted
    ])
  )
  .pipe(S.toTaggedUnion("kind"))
  .annotate($I.annote("ExternalJobEvent", {
    description: "External job event union discriminated by `kind`."
  }))

export type ExternalJobEvent = typeof ExternalJobEvent.Type

export const InternalJobEvent = S.TaggedUnion({
  Created: { id: S.String },
  Completed: { id: S.String, at: S.String }
}).annotate($I.annote("InternalJobEvent", {
  description: "Canonical internal union discriminated by `_tag`."
}))
```

### EF-14: Effect-returning functions use `Effect.fn` or `Effect.fnUntraced`

- Prefer `Effect.fn("Name")(...)` for reusable/public effectful functions.
- Use `Effect.fnUntraced(...)` for internal hot paths where tracing overhead is unnecessary.
- Reference: [Effect.fn docs](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:12850) and [Effect.fnUntraced docs](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:12821).

Example:

```ts
import { Effect } from "effect"
import * as S from "effect/Schema"

export const loadUser = Effect.fn("User.load")(function* (userId: string) {
  yield* Effect.logDebug("loading user", userId)
  return { userId }
})

const parseInternal = Effect.fnUntraced(function* (input: string) {
  return yield* S.decodeUnknownEffect(S.UnknownFromJsonString)(input)
})
```

### EF-15: Effects must be observable

- Instrument key workflows with logs, log annotations, spans, and metrics.
- Prefer built-in helpers:
  - Logging: `Effect.logWithLevel`, `Effect.log`, `Effect.logFatal`, `Effect.logWarning`, `Effect.logError`, `Effect.logInfo`, `Effect.logDebug`, `Effect.logTrace`
  - Logger/context: `Effect.withLogger`, `Effect.annotateLogs`, `Effect.annotateLogsScoped`, `Effect.withLogSpan`
  - Metrics/tracking: `Effect.track`, `Effect.trackSuccesses`, `Effect.trackErrors`, `Effect.trackDefects`, `Effect.trackDuration`
  - Tracing: `Effect.annotateSpans`, `Effect.annotateCurrentSpan`

Example:

```ts
import { Effect } from "effect"
import * as Metric from "effect/Metric"

const durationMs = Metric.histogram("workflow_duration_ms", {
  boundaries: Metric.boundariesFromIterable([10, 50, 100, 250, 500, 1000])
})
const failures = Metric.counter("workflow_failures_total")

const workflow = Effect.fn("Workflow.run")(function* (requestId: string) {
  yield* Effect.annotateCurrentSpan("requestId", requestId)
  yield* Effect.logInfo("workflow started")
  return "ok"
}).pipe(
  Effect.withLogSpan("workflow.run"),
  Effect.annotateLogs({ service: "beep-effect" }),
  Effect.trackDuration(durationMs),
  Effect.trackErrors(failures)
)
```

### EF-16: Durations and windows use `effect/Duration`

- Model timeouts, intervals, and windows with `Duration`.
- Avoid magic number time values in domain logic.

Example:

```ts
import { Duration, Effect } from "effect"

const timeout = Duration.seconds(30)
const pollInterval = Duration.millis(250)

const program = Effect.sleep(pollInterval).pipe(Effect.timeout(timeout))
```

### EF-17: Nullable/nullish schema fields should decode to `Option`

- Use dedicated schema helpers for optional/null conversions:
  - `S.OptionFromNullOr`
  - `S.OptionFromNullishOr`
  - `S.OptionFromOptionalKey`
  - `S.OptionFromOptional`
- Reference: [Schema Option helpers](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Schema.ts:5422) and [Schema optional field docs](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/SCHEMA.md:636).

Example:

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class AccountInput extends S.Class<AccountInput>($I`AccountInput`)({
  nickname: S.OptionFromNullishOr(S.String),
  bio: S.OptionFromNullOr(S.String),
  phone: S.OptionFromOptionalKey(S.String),
  timezone: S.OptionFromOptional(S.String)
}) {}
```

### EF-18: Exported helper APIs should be dual

- For reusable helper combinators, support both styles:
  - Data-first: `fn(self, arg)`
  - Data-last: `pipe(self, fn(arg))`
- Build these helpers with `dual` from `effect/Function`.
- Reference: [dual API](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Function.ts:106).

Example:

```ts
import { dual } from "effect/Function"
import { pipe } from "effect"

export const addPrefix: {
  (prefix: string): (self: string) => string
  (self: string, prefix: string): string
} = dual(2, (self: string, prefix: string) => `${prefix}${self}`)

const a = addPrefix("value", "p:")
const b = pipe("value", addPrefix("p:"))
```

### EF-19: JSON parse/stringify must use Schema

- Use `S.UnknownFromJsonString` for unknown JSON payloads.
- Use `S.fromJsonString(MySchema)` for typed JSON string boundaries.
- Avoid direct `JSON.parse` / `JSON.stringify` in Effect-first code.
- Prefer Effect codecs for JSON boundaries; map schema errors with `Effect.mapError(...)` when returning from a local module or service boundary.
- Use Result/Option codecs only for intentional non-throwing synchronous helpers.
- Reference: [UnknownFromJsonString](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/SCHEMA.md:4011) and [fromJsonString](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/SCHEMA.md:4028).

Example:

```ts
import { $PackageNameId } from "@beep/identity/packages"
import { Effect } from "effect"
import * as S from "effect/Schema"
import { TaggedErrorClass } from "@beep/schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class UserJsonError extends TaggedErrorClass<UserJsonError>($I`UserJsonError`)(
  "UserJsonError",
  { message: S.String },
  $I.annote("UserJsonError", {
    description: "Failed to decode or encode a user JSON payload."
  })
) {}

export class User extends S.Class<User>($I`User`)({
  id: S.String,
  name: S.String
}) {}

const UserJson = S.fromJsonString(User)

const decodeUserJson = (input: unknown) =>
  S.decodeUnknownEffect(UserJson)(input).pipe(
    Effect.mapError((error) => new UserJsonError({ message: error.message }))
  )

const encodeUserJson = (user: User) =>
  S.encodeEffect(UserJson)(user).pipe(
    Effect.mapError((error) => new UserJsonError({ message: error.message }))
  )
```

### EF-20: Completion gate is strict

You are not done if these fail:

- `bun run check`
- `bun run lint`
- `bun run test`
- `bun run docgen`

If agent instruction surfaces changed, also run:

- `bun run agents:pathless:check`

### EF-21: Runtime execution stays at the boundary

- Application entrypoints and tests may execute effects with `Effect.run*`.
- Library and domain exports should return `Effect` values.
- Keep runtime execution in one place so wiring, logging, and lifecycle behavior stay auditable.
- Reference: [runPromise](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:8423), [runSync](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:8606), and [runFork](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:8264).

Example:

```ts
import { Effect } from "effect"

export const runJob = Effect.fn("Job.run")(function* (id: string) {
  return { id }
})

// Runtime boundary only (for example, in main.ts):
// Effect.runPromise(runJob("job-1"))
```

### EF-22: Promise boundaries must be lifted into Effect

- Use `Effect.tryPromise` for Promise APIs that may reject.
- Keep Promise rejection details in typed failure values.
- Domain APIs should return `Effect`, not raw `Promise`.

Example:

```ts
import { Effect } from "effect"

const fetchText = (url: string) =>
  Effect.tryPromise({
    try: () => fetch(url).then((response) => response.text()),
    catch: (cause) => new HttpRequestError({ url, message: String(cause) })
  })
```

### EF-23: Resource lifetime must be explicit and scoped

- Use `Effect.acquireUseRelease` for acquisition/use/release flows.
- Prefer `Effect.scoped` for helper composition that allocates resources.
- Do not manually open resources without an explicit finalization strategy.
- Reference: [acquireUseRelease](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:6254) and [scoped](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:6079).

Example:

```ts
import { Effect } from "effect"

const withConnection = <A, E, R>(
  use: (conn: Connection) => Effect.Effect<A, E, R>
) =>
  Effect.acquireUseRelease(
    openConnection,
    use,
    closeConnection
  )
```

### EF-24: Retry policy is declarative

- Encode retries with `Effect.retry` and `Schedule`.
- Avoid manual retry loops and ad-hoc mutable counters.
- Keep retry policy close to the failing effect.
- Reference: [retry](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:3978).

Example:

```ts
import { Effect, Schedule } from "effect"

const resilientFetch = fetchRemote.pipe(
  Effect.retry(Schedule.recurs(3))
)
```

### EF-25: Timeouts are modeled outcomes

- Use `Effect.timeoutOption` when timeout should become `Option.None`.
- Use `Effect.timeoutOrElse` when timeout should produce a typed fallback effect.
- Avoid manually racing ad-hoc timers for business logic timeouts.
- Reference: [timeoutOption](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:4421) and [timeoutOrElse](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:4467).

Example:

```ts
import { Duration, Effect } from "effect"

const lookupCachedOnTimeout = slowLookup.pipe(
  Effect.timeoutOrElse({
    duration: Duration.seconds(2),
    onTimeout: () => Effect.succeed("cached-value")
  })
)
```

### EF-26: Structured concurrency is the default

- Prefer `Effect.forkChild` so lifecycle is supervised by parent scope.
- Use `Effect.forkDetach` only for explicit daemon semantics.
- Make fork intent explicit in code review and comments for detached work.
- Reference: [forkChild](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:7978) and [forkDetach](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:8121).

Example:

```ts
import { Effect, Fiber } from "effect"

const runWithHeartbeat = Effect.fn("Worker.run")(function* () {
  const heartbeat = yield* Effect.forkChild(heartbeatLoop)
  const result = yield* doWork
  yield* Fiber.interrupt(heartbeat)
  return result
})
```

### EF-27: Parallel fan-out needs explicit concurrency

- For non-trivial fan-out, set concurrency in `Effect.forEach`, `Effect.all`, or `Effect.validate`.
- Avoid implicit unbounded parallelism on large collections.
- Concurrency should be part of API intent for throughput-sensitive paths.
- Reference: [forEach concurrency](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:990), [all concurrency](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:751), [withConcurrency](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:6001).

Example:

```ts
import { Effect } from "effect"

const hydrateUsers = (ids: ReadonlyArray<string>) =>
  Effect.forEach(ids, fetchUser, { concurrency: 8 })
```

### EF-28: Configuration is an effect, not a global read

- Use `Config` and `ConfigProvider` for configuration loading and parsing.
- Keep direct `process.env` access out of domain code.
- Layer/provide config sources explicitly for tests and non-default environments.
- Reference: [Config](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Config.ts) and [ConfigProvider](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/ConfigProvider.ts:358).

Example:

```ts
import { Config, Effect } from "effect"

const loadPort = Effect.fn("Config.loadPort")(function* () {
  return yield* Config.int("PORT")
})
```

### EF-29: Secrets must stay redacted

- Use `Config.redacted` for secret config values.
- Use `Redacted.make` for sensitive values coming from non-config sources.
- Never log secret values after unwrapping.
- Reference: [Config.redacted](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Config.ts:1161) and [Redacted](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Redacted.ts).

Example:

```ts
import { Config, Effect } from "effect"

const loadApiKey = Effect.fn("Config.loadApiKey")(function* () {
  const apiKey = yield* Config.redacted("API_KEY")
  yield* Effect.logDebug(`apiKey=${String(apiKey)}`)
  return apiKey
})
```

### EF-30: Recovery should be precise, not blanket

- Prefer `Effect.catchTag` and `Effect.catchFilter` for targeted recovery.
- Do not hide unrelated failures behind broad fallback handlers.
- Keep recoverable error cases explicit in code.

Example:

```ts
import { Effect } from "effect"
import * as O from "effect/Option"

const findUserOptional = (id: string) =>
  findUser(id).pipe(
    Effect.map(O.some),
    Effect.catchTag("UserNotFoundError", () => Effect.succeed(O.none()))
  )
```

### EF-31: Separate expected failures from defects

- Use `Effect.fail` for expected business/domain failures.
- Reserve `Effect.die` / `Effect.orDie` for invariant violations and impossible states.
- Do not model normal user-facing errors as defects.
- Reference: [die](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:1745) and [orDie](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:3557).

Example:

```ts
import { Effect } from "effect"

const validateInput = Effect.fn("Input.validate")(function* (value: string) {
  if (value.length === 0) {
    return yield* Effect.fail(new ValidationError({ message: "value must be non-empty" }))
  }

  if (value === "__unreachable__") {
    return yield* Effect.die("unreachable state")
  }

  return value
})
```

### EF-32: Layer memoization isolation must be intentional

- Understand that layer provisioning is shared by default.
- When isolation is required, use `Effect.provide(..., { local: true })` or `Layer.fresh`.
- Document why isolation is necessary for behavior-sensitive paths.
- Reference: [Effect.provide local option](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Effect.ts:5592) and [Layer.fresh](/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Layer.ts:1621).

Example:

```ts
import { Effect, Layer } from "effect"

const runIsolated = program.pipe(
  Effect.provide(Layer.fresh(AppLayer), { local: true })
)
```

### EF-33: Schema-first development for domain models

- If a domain data model can be expressed as `Schema`, define the schema first.
- Prefer `S.Class` (or another schema constructor) over plain `type` / `interface` for property-based domain shapes.
- Derive runtime types from schema definitions instead of duplicating parallel `type` / `interface` models.
- Keep plain `type` / `interface` for cases schema cannot represent cleanly (complex type-level transforms, utility types, overload-only surfaces).
- Before choosing nontrivial Schema APIs, check the local Effect v4 source at
  `.repos/effect-v4/packages/effect/SCHEMA.md` and the relevant source module.

Example:

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

// Prefer schema-first over plain interfaces for domain payloads.
export class CreateOrderInput extends S.Class<CreateOrderInput>($I`CreateOrderInput`)(
  {
    orderId: S.String,
    customerId: S.String
  },
  $I.annote("CreateOrderInput", {
    description: "Input payload for creating an order."
  })
) {}
```

### EF-34: Schema defaults over fallback object logic

- Put defaults in schema definitions, not in handler/service fallback object literals.
- Use `S.withConstructorDefault` for constructor-time defaults.
- Use `S.withDecodingDefault` / `S.withDecodingDefaultKey` for decode-time defaults.

Example:

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as O from "effect/Option"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class VersionSyncOptions extends S.Class<VersionSyncOptions>($I`VersionSyncOptions`)(
  {
    shouldCheck: S.Boolean.pipe(
      S.withDecodingDefault(() => true),
      S.withConstructorDefault(() => O.some(true))
    ),
    categories: S.Array(S.String).pipe(
      S.withDecodingDefault(() => []),
      S.withConstructorDefault(() => O.some([]))
    )
  },
  $I.annote("VersionSyncOptions", {
    description: "Version sync options with schema-level defaults."
  })
) {}
```

### EF-35: Schema-backed guards and internal domain modeling

- If a guard validates domain strings/paths/tags, define a branded schema and use `S.is(...)`.
- If a domain constraint is named, reused, matched on, or structurally validated, model it as a schema first rather than a forest of ad-hoc predicate helpers.
- Prefer built-in schema constructors/checks before `S.makeFilter`.
- Keep guard intent and reusable check intent in schema annotations and check metadata.
- Use `LiteralKit` for internal literal domains whenever `.Options`, `.Enum`,
  `.is`, `.thunk`, `$match`, subset helpers, or annotation-bearing schema
  values are useful.
- Use `MappedLiteralKit` when a literal protocol/code map needs helpers on both
  the encoded and decoded sides.
- Treat broad exported/domain/boundary primitives such as `S.String`,
  `S.Number`, and unbounded arrays as prompts to encode the real domain with
  non-empty, finite, integer, pattern, length, range, brand, or collection
  checks.
- Do not add `as const` to inline array literals passed directly to `LiteralKit(...)`; `LiteralKit` uses const type parameters already.
- Prefer named intermediate schemas; export them only when reusable or when they materially clarify the module’s domain model.

Example:

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
    description: "A string that contains the topic scope separator `:`."
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
    }
  )
).pipe(
  S.brand("TopicName"),
  $I.annoteSchema("TopicName", {
    description: "A topic name composed from valid plain or scoped segments."
  })
)
```

Avoid this:

- A forest of `const hasX = ...`, `const isY = /.../.test(...)`, and unannotated predicate helpers when the named concepts can be expressed as schemas and reused with `S.is(...)`.

### EF-35b: Prefer schema-derived static APIs

- Use `S.TaggedUnion` / `S.toTaggedUnion` static APIs (`.cases`, `.guards`,
  `.isAnyOf`, `.match`) for construction, guards, grouped checks, and
  exhaustive branching.
- Use `LiteralKit` static APIs (`.Options`, `.Enum`, `.is`, `.pickOptions`,
  `.omitOptions`, `.$match`, `.thunk`, `.toTaggedUnion`) instead of duplicate
  literal arrays, enum-like objects, and ad-hoc literal guards.
- Use class-local statics for repeated `decode`, `encode`, `arbitrary`, and
  `equivalence` helpers when they reduce repeated plumbing without introducing
  import cycles.
- Reference scratch proof:
  `scratchpad/test/schema-static-apis.test.ts`.

### EF-36: Prefer schema equivalence for domain comparisons

- For schema-modeled domain values, use `S.toEquivalence(schema)` instead of manual `===` / `!==`.
- This keeps comparison semantics aligned with schema intent and future schema changes.

Example:

```ts
import * as S from "effect/Schema"

const stringArrayEq = S.toEquivalence(S.Array(S.String))

const arraysEqual = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  stringArrayEq(left, right)
```

### EF-37: Use schema transformations for deterministic conversions

- If conversion is deterministic and type-shaping (path normalization, filename conversion, tagged-string normalization), model it with `S.decodeTo(..., SchemaTransformation.transform(...))`.
- Prefer schema transformation helpers over ad-hoc conversion functions.

Example:

```ts
import { SchemaTransformation } from "effect"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const NativePathToPosixPath = S.String.pipe(
  S.decodeTo(
    S.String.check(S.isPattern(/^[^\\]*$/)).pipe(S.brand("PosixPath")),
    SchemaTransformation.transform({
      decode: (pathString) => Str.replaceAll("\\", "/")(pathString),
      encode: (pathString) => pathString
    })
  )
)
```

### EF-38: Never use native array sort in Effect-first code

- Use `A.sort(values, order)` from `effect/Array`.
- Define ordering with `effect/Order` (`Order.String`, `Order.Number`, `Order.mapInput`, etc.).
- Do not call native `.sort()` directly on arrays.

Example:

```ts
import { Order } from "effect"
import * as A from "effect/Array"

const byName = Order.mapInput(Order.String, (item: { readonly name: string }) => item.name)
const sorted = A.sort(items, byName)
```

### EF-39: Avoid ad-hoc `String(...)` coercion for domain comparisons

- When unknown/scalar data must normalize to domain strings, model the conversion with schema transformations.
- Compare resulting values with `S.toEquivalence(S.String)` (or domain schema equivalence), not raw string equality.

Example:

```ts
import { SchemaTransformation } from "effect"
import * as S from "effect/Schema"

const UnknownToString = S.Unknown.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (value) => `${value}`,
      encode: (value) => value
    })
  )
)
```

## Copy-Paste Templates

### Template: Tagged error with Identity composer

```ts
import { TaggedErrorClass } from "@beep/schema"
import * as S from "effect/Schema"
import { $PackageNameId } from "@beep/identity/packages"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class DomainError extends TaggedErrorClass<DomainError>($I`DomainError`)(
  "DomainError",
  {
    message: S.String
  },
  $I.annote("DomainError", { description: "Domain failure" })
) {}
```

### Template: Safe nullable boundary conversion

```ts
import { pipe } from "effect"
import * as O from "effect/Option"

const fromNullableName = (name: string | null | undefined) =>
  pipe(
    O.fromNullishOr(name),
    O.filter((value) => value.length > 0)
  )
```

### Template: Decode unknown at API edge

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class Payload extends S.Class<Payload>($I`Payload`)({
  query: S.String
}) {}

const decodePayload = S.decodeUnknownEffect(Payload)
```

### Template: Schema naming + type alias (no `Schema` suffix)

```ts
import * as S from "effect/Schema"

export const OrderId = S.String
export type OrderId = typeof OrderId.Type
```

### Template: Schema-first replacement for interface

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class UserProfile extends S.Class<UserProfile>($I`UserProfile`)(
  {
    id: S.String,
    displayName: S.String
  },
  $I.annote("UserProfile", {
    description: "User profile model used in domain workflows."
  })
) {}
```

### Template: Match, LiteralKit([/* ... */]).$match or effect/Schema TaggedUnion over switch

```ts
import { Match } from "effect"
import * as A from "effect/Array"
import { LiteralKit } from "@beep/schema";


const Phase = LiteralKit(
  [
    "draft",
    "running",
    "done"
  ]
)

const TaggedPhase = Phase.mapMembers(Tuple.evolve([
  () => S.Struct({ phase: S.tag(Phase.Enum.draft)}),
  () => S.Struct({ phase: S.tag(Phase.Enum.running)}),
  () => S.Struct({ phase: S.tag(Phase.Enum.done)})
])).pipe(S.toTaggedUnion("phase"))
type TaggedPhase = typeof TaggedPhase.Type;
const phaseLabel = Phase.$match({
  draft: () => "draft",
  running: () => "running",
  done: () => "done"
})

const matchPhase: (taggedPhase: TaggedPhase) => Phase = TaggedPhase.match({
  draft: ({phase}) => phase,
  running: ({ phase }) => phase,
  done: ({ phase }) => phase,
})(taggedPhase)

const summarize = (items: ReadonlyArray<string>) =>
  A.match(items, {
    onEmpty: () => "none",
    onNonEmpty: (values) => `count:${A.length(values)}`
  })

export class SomeErrorOne extends TaggedErrorClass<SomeErrorOne>($I`SomeErrorOne`)("SomeErrorOne", { message: S.String}) {}
export class SomeErrorTwo extends TaggedErrorClass<SomeErrorTwo>($I`SomeErrorTwo`)("SomeErrorTwo", { message: S.String}) {}

export const SomeError = S.Union(
  [
    SomeErrorOne,
    SomeErrorTwo,
  ]
).pipe(S.toTaggedUnion("_tag"));

const matchError = SomeError.match({
  SomeErrorOne: () => "SomeErrorOne",
  SomeErrorTwo: () => "SomeErrorTwo",
});

const MyTaggedUnion = S.TaggedUnion({
  One: { message: S.String },
  Two: { message: S.String }
})

const matchTaggedUnion = MyTaggedUnion.match({
  One: () => "One",
  Two: () => "Two",
})
```

### Template: Effect-returning function constructor

```ts
import { Effect } from "effect"

export const runTask = Effect.fn("Task.run")(function* (taskId: string) {
  yield* Effect.logInfo("run task", taskId)
  return taskId
})
```

### Template: Option schema from nullish/optional

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class Input extends S.Class<Input>($I`Input`)({
  maybeName: S.OptionFromNullishOr(S.String),
  maybeEmail: S.OptionFromOptionalKey(S.String)
}) {}
```

### Template: Dual helper (data-first + data-last)

```ts
import { dual } from "effect/Function"

export const rename: {
  (to: string): (self: { readonly name: string }) => { readonly name: string }
  (self: { readonly name: string }, to: string): { readonly name: string }
} = dual(2, (self, to) => ({ ...self, name: to }))
```

### Template: JSON boundary without native JSON APIs

```ts
import { $PackageNameId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class Payload extends S.Class<Payload>($I`Payload`)({
  query: S.String
}) {}

const PayloadJson = S.fromJsonString(Payload)

export const decodePayloadJson = S.decodeUnknownEffect(PayloadJson)
export const encodePayloadJson = S.encodeUnknownEffect(PayloadJson)
```

### Template: Runtime boundary execution

```ts
import { Effect } from "effect"

export const buildReport = Effect.fn("Report.build")(function* () {
  return "ok"
})

// runtime boundary only
// Effect.runPromise(buildReport())
```

### Template: Scoped resource helper

```ts
import { Effect } from "effect"

export const withResource = <A, E, R>(
  use: (resource: Resource) => Effect.Effect<A, E, R>
) =>
  Effect.acquireUseRelease(
    acquireResource,
    use,
    releaseResource
  )
```

### Template: Retry + timeout

```ts
import { Duration, Effect, Schedule } from "effect"

export const resilientTask = task.pipe(
  Effect.retry(Schedule.recurs(3)),
  Effect.timeoutOption(Duration.seconds(5))
)
```

### Template: Config + redacted secret

```ts
import { Config, Effect } from "effect"

export const loadConfig = Effect.fn("Config.load")(function* () {
  const port = yield* Config.int("PORT")
  const apiKey = yield* Config.redacted("API_KEY")
  return { port, apiKey }
})
```

### Template: Isolated layer provide

```ts
import { Effect, Layer } from "effect"

export const runIsolated = program.pipe(
  Effect.provide(Layer.fresh(AppLayer), { local: true })
)
```

## LLM Review Checklist

Use this before submitting code:

1. No `any`, no type assertions, no `@ts-ignore`, no non-null assertions.
2. No untyped error throwing in domain logic.
3. Nullish converted to `Option` at boundaries.
4. Unknown input decoded with `Schema`.
5. `A/O/P/R/S` aliases present and used.
6. No native `Object/Map/Set/Date/String` helpers in domain logic.
7. Branching logic is exhaustive where appropriate (`Match.exhaustive`, schema `.match`, and `A.match` for array emptiness).
8. No new schema constants end with `Schema`.
9. For non-class schemas, new schema constants expose `export type X = typeof X.Type`.
10. New schemas are annotated using `$I.annote(...)`.
11. `Effect`-returning reusable functions are created with `Effect.fn`/`Effect.fnUntraced`.
12. Critical flows include logs/spans/metrics instrumentation.
13. Durations/time windows use `Duration` values.
14. Nullish schema fields use `S.OptionFrom*` helpers when representing absence as `Option`.
15. Exported helper combinators support dual API via `dual`.
16. No `JSON.parse` / `JSON.stringify` in Effect-first domain paths.
17. Prefer `S.Class` over `S.Struct` for new object schemas.
18. Required verification commands are green.
19. `Effect.run*` appears only in runtime boundaries (entrypoint/test harness).
20. Promise-based APIs are lifted with `Effect.tryPromise`.
21. Acquired resources use `Effect.acquireUseRelease` or `Effect.scoped`.
22. Retries are declared with `Effect.retry` + `Schedule`.
23. Timeouts use `Effect.timeoutOption` / `Effect.timeoutOrElse`.
24. Forking intent is explicit (`forkChild` default; `forkDetach` justified).
25. Large fan-out operations specify concurrency deliberately.
26. Config values come from `Config` / `ConfigProvider`, not direct `process.env` in domain logic.
27. Secrets are `Redacted` (`Config.redacted` / `Redacted.make`) and not logged raw.
28. Recovery uses `catchTag` / `catchFilter` for targeted cases.
29. Expected failures use `Effect.fail`; defects are reserved for invariants.
30. Isolation-sensitive layer provisioning uses `{ local: true }` or `Layer.fresh`.
31. New domain data models are schema-first; plain `type` / `interface` is used only when schema is not a practical fit.
32. Finite variants, lifecycle states, status/result cases, and case-specific payloads are modeled as discriminated unions; literal-string discriminants and internal literal domains use `LiteralKit` when `.mapMembers`, `.is`, `.thunk`, `$match`, or annotation-bearing schema values are needed.
33. Schema defaults use `S.withConstructorDefault` / `S.withDecodingDefault*`, not ad-hoc fallback objects in handlers/services.
34. Named or reused domain constraints are modeled as schemas first; built-in schema constructors/checks are preferred before `S.makeFilter`.
35. Guard helpers for domain strings/paths/tags come from branded schemas with `S.is(...)`, not ad-hoc `regex.test(...)` predicates.
36. Reusable schema checks and filter groups carry `identifier`, `title`, and `description`.
37. Intermediate schemas are exported only when reusable or materially clarifying; otherwise they stay module-local.
38. Schema-modeled comparisons use `S.toEquivalence(...)` where practical.
39. Deterministic format conversions use `S.decodeTo(..., SchemaTransformation.transform(...))`.
40. Trivial helper wrapper lambdas are collapsed to direct helper refs where safe, and passthrough `pipe(...)` callbacks are expressed with `flow(...)`.
41. Runtime source avoids `node:fs` / `node:path` / `node:child_process`; use Effect `FileSystem` / `Path` / process services.
42. Runtime source avoids native `fetch`; HTTP boundaries use `effect/unstable/http` + platform layers (`BunHttpClient.layer`, etc.).
43. Runtime sorting uses `A.sort` with explicit `Order`, not native `Array.prototype.sort`.
44. Boolean branching prefers `Bool.match` over ad-hoc `if/else` when branching on booleans.
45. HTTP request/response composition uses Effect HTTP modules (`HttpClientRequest`, `HttpClientResponse`, `Headers`, `UrlParams`, `HttpMethod`, `HttpBody`).
