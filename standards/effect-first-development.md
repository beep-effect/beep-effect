# Effect-First Development

This document defines the working model behind Effect-first code in this repository.
Treat it as the long-form companion to `standards/effect-laws-v1.md`.

## Definition

Effect-first development means domain code is written in Effect-native constructs first, and native JavaScript/TypeScript patterns only at explicit boundaries.

The goal is to make failure, absence, decoding, and dependency wiring explicit and typed.

## Primary References

`.repos/effect` points to the Effect child at
`$HOME/YeeBois/references/effect/effect` (Effect `main` is v4). The workspace also
contains `effect-tsgo`; `bun run beep refs provision` provisions it from
`scripts/references.json`, with `BEEP_REFERENCES_ROOT` overriding the
`$HOME/YeeBois/references/effect` root.

- [Effect LLMS guide](../.repos/effect/LLMS.md)
- [Effect ai-docs index](../.repos/effect/ai-docs/src/index.md)
- [Effect migration notes](../.repos/effect/MIGRATION.md)
- [Effect Schema docs](../.repos/effect/packages/effect/SCHEMA.md)

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
- Extend `S.TaggedError` from `effect/Schema` directly for public or cross-module failures.
- Do not `throw` or use `new Error(...)` in production domain logic.

Example:

```ts
import * as Effect from "effect/Effect";
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Identity from "@beep/identity";

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class MissingConfigError extends S.TaggedError<MissingConfigError, { readonly brand: unique symbol }>($I`MissingConfigError`)(
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
import { pipe } from "effect/Function";
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
- Never use `JSON.parse` / `JSON.stringify`; use schema JSON codecs (`S.fromJsonString`, `S.decodeUnknownEffect`, `S.encodeUnknownEffect`, or the explicit non-throwing Result/Option forms).
- Model plain object data as a branded `S.Opaque` over an annotated `S.Struct`; keep `S.Class` for errors, persisted entities, classes with instance members, and `.extend` chains (EF-33).
- Repo-wide outstanding schema-first findings are tracked in `standards/schema-first.inventory.jsonc` and verified by `bun run beep lint schema-first`.
- Do not name schemas with a `Schema` suffix; schema constants should be named after the domain type.
- For non-class schemas, export type aliases with the same identifier name as the schema value.

Example:

```ts
import * as Identity from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class CreateTaskInputError extends S.TaggedError<CreateTaskInputError, { readonly brand: unique symbol }>($I`CreateTaskInputError`)(
  "CreateTaskInputError",
  { message: S.String },
  $I.annote("CreateTaskInputError", {
    description: "Failed to decode create-task input."
  })
) {}

export class CreateTaskInput extends S.Opaque<CreateTaskInput, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    title: S.String,
    priority: S.Int
  }).pipe($I.annoteSchema("CreateTaskInput", {
    description: "Input payload for creating a task."
  }))
) {}

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
- Prefer dedicated namespace imports for helper/data modules:
  - `import * as Str from "effect/String"`
  - `import * as Eq from "effect/Equal"`
  - `import * as Bool from "effect/Boolean"`
- Never import from the root `"effect"` barrel: `Effect`, `Match`, and every other module come from `effect/<Module>`; `pipe`, `flow`, and `identity` come from `effect/Function`.
- Use `@stability unstable` modules wherever they fit: the tag means the API may change on a bump, not that the module is unfit for production (AGENTS.md Code Laws).

### EF-5: Effect modules over native collection helpers

- Use `A`, `R`, `Str`, `Eq`, `HashMap`, `HashSet`, `MutableHashMap`, `MutableHashSet`.
- Avoid domain usage of native `Object`, `Map`, `Set`, `Date`, and direct native string helpers.
- When behavior is unchanged, prefer the tersest helper form: direct helper refs over trivial wrapper lambdas, `flow(...)` over passthrough `pipe(...)` callbacks, and shared thunk helpers when already in scope.

Example:

```ts
import { pipe } from "effect/Function";
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
import * as Match from "effect/Match";
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
import * as Identity from "@beep/identity";
import * as Context from "effect/Context";

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");
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
  `Arbitrary.schema(sourceSchema)` (`effect/Arbitrary`) with `it.prop` over
  happy-path fixture data alone. Add arbitrary annotations to the source schema when generation needs
  domain-specific realism.

### EF-11: Public APIs are documented

- Exported APIs in package/tooling source require JSDoc.
- Examples must remain docgen-clean.

### EF-12: Schema annotation is required

- New schemas must include meaningful annotation metadata from the file's
  identity composer `$I`.
- Non-class schemas (structs, literals and `LiteralKit`, brands, unions,
  tagged unions) annotate with `.pipe($I.annoteSchema("Name", {...}))`, never
  `.annotate($I.annote(...))`. `annoteSchema` writes the same identifier, title
  and schema id, types its extras against the schema, and keeps the schema's
  statics: a raw `.annotate` on an `S.toTaggedUnion(...)` result drops `match`,
  `cases`, `guards` and `isAnyOf` at runtime.
- Classes keep their trailing annotation argument: `$I.annote(...)` for
  `S.Class` / `S.TaggedClass`, `$I.annoteError<X>(...)` for errors. `S.Opaque`
  takes none: it wraps a struct annotated with `.pipe($I.annoteSchema(...))`
  (EF-33).
- Checks and filters take `$I.annote("Name", {...})` as their annotation
  argument: `S.isPattern(re, $I.annote("SlugPattern", {...}))`,
  `S.makeFilter(f, $I.annote(...))`, `S.makeFilterGroup([...], $I.annote(...))`.
  Never hand-build `{ identifier: $I\`Name\`, ... }`: it skips the schema id,
  IRI and CURIE the composer writes.
- A caller-supplied `title` wins over the title the composer derives from the
  identifier; `identifier`, `schemaId`, `iri` and `curie` always come from the
  identity.
- Struct fields use `.pipe($I.annoteKey("Parent.key", {...}))`, never
  `.annotate($I.annote(...))` or `.annotateKey($I.annote(...))`. A raw
  `.annotate({...})` on a field is fine. When a recursive class's own base
  expression trips TS2310 on the pipe form, apply the helper directly:
  `$I.annoteKey("Parent.key", {...})(S.suspend(() => Node))`.
- Annotation descriptions should encode intent, not repeat the symbol name.
- Biome enforces the composer forms in every package's `lint` task through two
  `@beep/lint-rules` GritQL rules: `prefer-identity-annote-pipe` rejects
  `.annotate($I.annote(...))` and `.annotateKey($I.annote(...))`, and
  `no-hand-built-identity-annotation` rejects `identifier:` values built from
  `` $I`Name` `` or `$I.make("Name")`.

Example:

```ts
import * as Identity from "@beep/identity";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export const Tenant = S.String.pipe(
  $I.annoteSchema("Tenant", {
    description: "Logical tenant identifier used for request and storage partitioning."
  })
)

export type Tenant = typeof Tenant.Type
```

### EF-12b: Schema-first internal domain building blocks

- If an intermediate domain concept is named, reused, matched on, or structurally validated, model it as a schema first instead of an ad-hoc boolean helper.
- Prefer built-in schema constructors/checks such as `S.NonEmptyString`, `S.NonEmptyArray`, `S.TupleWithRest`, `S.Union`, `S.isPattern`, and `S.isIncluding` before reaching for `S.makeFilter`.
- Where upstream covers a `foundation/modeling` concept's intent, its covered facets retire in the same PR that migrates their consumers, with no alias; the whole concept retires unless the lines reading its uncovered members outnumber the lines using its covered facets (ADAPT, per the facet census in `standards/architecture/DECISIONS.md` "Upstream-First Foundation/Modeling").
- Derive domain guards with `S.is(SomeSchema)`.
- Use `LiteralKit` for a named internal literal domain, especially one that needs `.Enum`, `.is`, `match`, `.toTaggedUnion`, or an annotation-bearing schema value; use `S.Literals` for anonymous inline unions never referenced by name.
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
- Define tagged union member schemas as branded `S.Opaque` classes over
  `S.Struct` (EF-33), and use the schema-derived `.match` helper when
  branching directly on the union.
- Use `S.TaggedUnion` only for canonical `_tag` object-union construction.
- Reference: [Effect schema docs](../.repos/effect/packages/effect/SCHEMA.md:1891) and [toTaggedUnion notes](../.repos/effect/packages/effect/SCHEMA.md:1934).

Example:

```ts
import { LiteralKit } from "@beep/schema"
import * as Identity from "@beep/identity";
import * as Tuple from "effect/Tuple";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

const ExternalJobKind = LiteralKit(["created", "completed"])

export class ExternalJobCreated extends S.Opaque<ExternalJobCreated, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("created"),
    id: S.String
  }).pipe($I.annoteSchema("ExternalJobCreated", {
    description: "Created event from external job source."
  }))
) {}

export class ExternalJobCompleted extends S.Opaque<ExternalJobCompleted, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("completed"),
    id: S.String,
    at: S.String
  }).pipe($I.annoteSchema("ExternalJobCompleted", {
    description: "Completed event from external job source."
  }))
) {}

export const ExternalJobEvent = ExternalJobKind
  .mapMembers(
    ([created, completed]) => Tuple.make(ExternalJobCreated, ExternalJobCompleted)
  )
  .pipe(
    S.toTaggedUnion("kind"),
    $I.annoteSchema("ExternalJobEvent", {
      description: "External job event union discriminated by `kind`."
    })
  )

export type ExternalJobEvent = typeof ExternalJobEvent.Type

export const InternalJobEvent = S.TaggedUnion({
  Created: { id: S.String },
  Completed: { id: S.String, at: S.String }
}).pipe($I.annoteSchema("InternalJobEvent", {
  description: "Canonical internal union discriminated by `_tag`."
}))
```

### EF-14: Effect-returning functions use `Effect.fn` or `Effect.fnUntraced`

- Prefer `Effect.fn("Name")(...)` for reusable/public effectful functions.
- Use `Effect.fnUntraced(...)` for internal hot paths where tracing overhead is unnecessary.
- Reference: [Effect.fn docs](../.repos/effect/packages/effect/src/Effect.ts:12850) and [Effect.fnUntraced docs](../.repos/effect/packages/effect/src/Effect.ts:12821).

Example:

```ts
import * as Effect from "effect/Effect";
import * as S from "effect/Schema"

export const loadUser = Effect.fn("User.load")(function* (userId: string) {
  yield* Effect.logDebug("loading user", userId)
  return { userId }
})

const parseInternal = Effect.fnUntraced(function* (input: string) {
  return yield* S.decodeUnknownEffect(S.fromJsonString(S.Unknown))(input)
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
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric"

const durationMs = Metric.timer("workflow_duration_ms", {
  boundaries: Metric.boundariesFromIterable([10, 50, 100, 250, 500, 1000])
})
const failures = Metric.counter("workflow_failures_total").pipe(Metric.mapInput((_: unknown) => 1))

const workflow = Effect.fn("Workflow.run")(function* (requestId: string) {
  yield* Effect.annotateCurrentSpan("requestId", requestId)
  yield* Effect.logInfo("workflow started")
  return "ok"
}, (effect) => effect.pipe(
  Effect.withLogSpan("workflow.run"),
  Effect.annotateLogs({ service: "beep-effect" }),
  Effect.trackDuration(durationMs),
  Effect.trackErrors(failures)
))
```

### EF-16: Durations and windows use `effect/Duration`

- Model timeouts, intervals, and windows with `Duration`.
- Avoid magic number time values in domain logic.

Example:

```ts
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
const timeout = Duration.seconds(30)
const pollInterval = Duration.millis(250)

const program = Effect.sleep(pollInterval).pipe(Effect.timeout(timeout))
```

### EF-17: Nullable/nullish schema fields should decode to `Option`

- Use dedicated schema helpers for optional/null conversions:
  - `S.OptionFromNullOr`
  - `S.OptionFromNullishOr`
  - `S.OptionFromOptionalKey`
- Never `S.OptionFromOptional`; it admits a present key holding `undefined` (EF-40).
- Reference: [Schema Option helpers](../.repos/effect/packages/effect/src/Schema.ts:5422) and [Schema optional field docs](../.repos/effect/packages/effect/SCHEMA.md:636).

Example:

```ts
import * as Identity from "@beep/identity";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class AccountInput extends S.Opaque<AccountInput, { readonly brand: unique symbol }>()(
  S.Struct({
    nickname: S.OptionFromNullishOr(S.String),
    bio: S.OptionFromNullOr(S.String),
    phone: S.OptionFromOptionalKey(S.String)
  }).pipe($I.annoteSchema("AccountInput", {
    description: "Account input whose absent fields decode to Option."
  }))
) {}
```

### EF-18: Exported helper APIs should be dual

- For reusable helper combinators, support both styles:
  - Data-first: `fn(self, arg)`
  - Data-last: `pipe(self, fn(arg))`
- Build these helpers with `dual` from `effect/Function`.
- Reference: [dual API](../.repos/effect/packages/effect/src/Function.ts:106).

Example:

```ts
import { dual, pipe } from "effect/Function"
export const addPrefix: {
  (prefix: string): (self: string) => string
  (self: string, prefix: string): string
} = dual(2, (self: string, prefix: string) => `${prefix}${self}`)

const a = addPrefix("value", "p:")
const b = pipe("value", addPrefix("p:"))
```

### EF-19: JSON parse/stringify must use Schema

- Use `S.fromJsonString(S.Unknown)` for unknown JSON payloads.
- Use `S.fromJsonString(MySchema)` for typed JSON string boundaries.
- Avoid direct `JSON.parse` / `JSON.stringify` in Effect-first code.
- Prefer Effect codecs for JSON boundaries; map schema errors with `Effect.mapError(...)` when returning from a local module or service boundary.
- Use Result/Option codecs only for intentional non-throwing synchronous helpers.
- Reference: `fromJsonString` in `.repos/effect/packages/effect/SCHEMA.md`.

Example:

```ts
import * as Identity from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class UserJsonError extends S.TaggedError<UserJsonError, { readonly brand: unique symbol }>($I`UserJsonError`)(
  "UserJsonError",
  { message: S.String },
  $I.annote("UserJsonError", {
    description: "Failed to decode or encode a user JSON payload."
  })
) {}

export class User extends S.Opaque<User, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    name: S.String
  }).pipe($I.annoteSchema("User", {
    description: "User payload carried as JSON."
  }))
) {}

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

### EF-21: Runtime execution stays at the boundary

- Application entrypoints and tests may execute effects with `Effect.run*`.
- Library and domain exports should return `Effect` values.
- Keep runtime execution in one place so wiring, logging, and lifecycle behavior stay auditable.
- Reference: [runPromise](../.repos/effect/packages/effect/src/Effect.ts:8423), [runSync](../.repos/effect/packages/effect/src/Effect.ts:8606), and [runFork](../.repos/effect/packages/effect/src/Effect.ts:8264).

Example:

```ts
import * as Effect from "effect/Effect";
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
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";

class HttpRequestError extends S.TaggedError<HttpRequestError, { readonly brand: unique symbol }>()("HttpRequestError", { url: S.String, message: S.String }) {}
const fetchText = (url: string) =>
  Effect.tryPromise({
    try: () => fetch(url).then((response) => response.text()),
    catch: (cause) => new HttpRequestError({ url, message: String(cause) })
  })
```

### EF-22b: `Result` boundaries must be lifted with `Effect.fromResult`

- A `Result` is not an `Effect`. `Effect.gen` and `Effect.fn` / `Effect.fnUntraced`
  constrain their yields to `Effect<any, any, any>`, and `Result` carries a
  different TypeId, so `yield* someResult` is rejected.
- Lift it with `Effect.fromResult`, whose signature is
  `<A, E>(result: Result<A, E>) => Effect<A, E>`.
- For table converters whose declared return type is `Result`, including the
  schema-encoding `to<Entity>Insert` converters, every generator call site
  bridges. Direct-value insert converters are already values and must not be
  passed to `Effect.fromResult`.
- The diagnostic is easy to misread. In the common shape
  `it.effect(name, Effect.fnUntraced(function* () { ... }))` the error is a
  `TS2769` "No overload matches this call" wall whose root cause
  (`Property '[TypeId]' is missing in type 'Success<…>'`) sits several frames
  down. Bypass the type error and the fiber dies at runtime with
  `Fiber.runLoop: Not a valid effect`.

Example:

```ts
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import * as Effect from "effect/Effect";

const CandorDisposition = S.Struct({ disposition: S.String });
type CandorDisposition = typeof CandorDisposition.Type;
declare const toCandorDispositionInsert: (value: CandorDisposition) => Result.Result<CandorDisposition, S.SchemaError>;
declare const write: (row: CandorDisposition) => Effect.Effect<void>;
const insertDisposition = Effect.fnUntraced(function* (disposition: CandorDisposition) {
  const row = yield* Effect.fromResult(toCandorDispositionInsert(disposition))
  return yield* write(row)
})
```

### EF-23: Resource lifetime must be explicit and scoped

- Use `Effect.acquireUseRelease` for acquisition/use/release flows.
- Prefer `Effect.scoped` for helper composition that allocates resources.
- Do not manually open resources without an explicit finalization strategy.
- Reference: [acquireUseRelease](../.repos/effect/packages/effect/src/Effect.ts:6254) and [scoped](../.repos/effect/packages/effect/src/Effect.ts:6079).

Example:

```ts
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";

const Connection = S.Struct({ id: S.String });
type Connection = typeof Connection.Type;
declare const openConnection: Effect.Effect<Connection>;
declare const closeConnection: (resource: Connection) => Effect.Effect<void>;
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
- Reference: [retry](../.repos/effect/packages/effect/src/Effect.ts:3978).

Example:

```ts
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

declare const fetchRemote: Effect.Effect<string, string>;
const resilientFetch = fetchRemote.pipe(
  Effect.retry(Schedule.recurs(3))
)
```

### EF-25: Timeouts are modeled outcomes

- Use `Effect.timeoutOption` when timeout should become `Option.None`.
- Use `Effect.timeoutOrElse` when timeout should produce a typed fallback effect.
- Avoid manually racing ad-hoc timers for business logic timeouts.
- Reference: [timeoutOption](../.repos/effect/packages/effect/src/Effect.ts:4421) and [timeoutOrElse](../.repos/effect/packages/effect/src/Effect.ts:4467).

Example:

```ts
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

declare const slowLookup: Effect.Effect<string>;
const lookupCachedOnTimeout = slowLookup.pipe(
  Effect.timeoutOrElse({
    duration: Duration.seconds(2),
    orElse: () => Effect.succeed("cached-value")
  })
)
```

### EF-26: Structured concurrency is the default

- Prefer `Effect.forkChild` so lifecycle is supervised by parent scope.
- Use `Effect.forkDetach` only for explicit daemon semantics.
- Make fork intent explicit in code review and comments for detached work.
- Reference: [forkChild](../.repos/effect/packages/effect/src/Effect.ts:7978) and [forkDetach](../.repos/effect/packages/effect/src/Effect.ts:8121).

Example:

```ts
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";

declare const heartbeatLoop: Effect.Effect<void>;
declare const doWork: Effect.Effect<string>;
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
- Reference: [forEach concurrency](../.repos/effect/packages/effect/src/Effect.ts:990), [all concurrency](../.repos/effect/packages/effect/src/Effect.ts:751), [withConcurrency](../.repos/effect/packages/effect/src/Effect.ts:6001).

Example:

```ts
import * as Effect from "effect/Effect";

declare const fetchUser: (id: string) => Effect.Effect<{ readonly id: string }>;
const hydrateUsers = (ids: ReadonlyArray<string>) =>
  Effect.forEach(ids, fetchUser, { concurrency: 8 })
```

### EF-28: Configuration is an effect, not a global read

- Use `Config` and `ConfigProvider` for configuration loading and parsing.
- Keep direct `process.env` access out of domain code.
- Layer/provide config sources explicitly for tests and non-default environments.
- Reference: [Config](../.repos/effect/packages/effect/src/Config.ts) and [ConfigProvider](../.repos/effect/packages/effect/src/ConfigProvider.ts:358).

Example:

```ts
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
const loadPort = Effect.fn("Config.loadPort")(function* () {
  return yield* Config.Port("PORT")
})
```

### EF-29: Secrets must stay redacted

- Use `Config.Redacted` for secret config values.
- Use `Redacted.make` for sensitive values coming from non-config sources.
- Never log secret values after unwrapping.
- Reference: [Config.Redacted](../.repos/effect/packages/effect/src/Config.ts) and [Redacted](../.repos/effect/packages/effect/src/Redacted.ts).

Example:

```ts
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
const loadApiKey = Effect.fn("Config.loadApiKey")(function* () {
  const apiKey = yield* Config.Redacted("API_KEY")
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
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option"

class UserNotFoundError extends S.TaggedError<UserNotFoundError, { readonly brand: unique symbol }>()("UserNotFoundError", {}) {}
declare const findUser: (id: string) => Effect.Effect<string, UserNotFoundError>;

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
- Reference: [die](../.repos/effect/packages/effect/src/Effect.ts:1745) and [orDie](../.repos/effect/packages/effect/src/Effect.ts:3557).

Example:

```ts
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";

class ValidationError extends S.TaggedError<ValidationError, { readonly brand: unique symbol }>()("ValidationError", { message: S.String }) {}
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
- Reference: [Effect.provide local option](../.repos/effect/packages/effect/src/Effect.ts:5592) and [Layer.fresh](../.repos/effect/packages/effect/src/Layer.ts:1621).

Example:

```ts
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Context from "effect/Context";
class AppService extends Context.Service<AppService, { readonly value: string }>()("example/AppService") {}
const program = AppService.use((service) => Effect.succeed(service.value));
const AppLayer = Layer.effect(AppService, Effect.sync(() => ({ value: "isolated instance" })));
const runIsolated = program.pipe(
  Effect.provide(Layer.fresh(AppLayer), { local: true })
)
```

### EF-33: Schema-first development for domain models

- If a domain data model can be expressed as `Schema`, define the schema first.
- Prefer a schema constructor over plain `type` / `interface` for property-based domain shapes.
- Plain data schemas use a branded `S.Opaque` over an annotated `S.Struct`:
  `class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema("X", {...}))) { static ... }`.
  Tagged data uses `S.TaggedStruct("X", {...})` as the source. Plain data means
  no instance members, not an error, not a persisted entity, and not part of an
  `.extend` chain.
- Opaque values are plain objects validated by shape. The class gives an opaque
  nominal type and a place for statics. Construct with `X.make(...)`; `new X(...)`
  is not available. There is no `X.extend`: build a wider struct by spreading
  `X.fields` into a new `S.Struct`, or with `S.fieldsAssign(...)`.
  `X.annotate(...)` returns a plain schema without the statics, so annotate the
  Struct inside the pipe.
- `S.Class`, `S.TaggedClass`, `S.Error`, and `S.TaggedError` stay for errors,
  persisted entities (built on `@beep/effect-drizzle`), schemas with instance
  members (getters or methods), and `.extend` chains. `bun run beep lint
  schema-first` flags a plain-data `S.Class` outside those cases.
- Every `S.Class` / `S.TaggedClass` / `S.Error` / `S.TaggedError` / `S.Opaque`
  declaration carries `{ readonly brand: unique symbol }` as its brand type
  argument. A structural `{}` brand needs a documented exception in
  `standards/schema-first.inventory.jsonc`. `schemaClassMissingBrand` becomes an
  error at the `@effect/tsgo` 0.52 bump.
- Why not `S.Class` for data: its type-side check is `instanceof`, so a
  structurally valid plain object fails `S.is`, encoding, and `HttpApiClient`
  payload encoding, and `structuredClone` / `postMessage` strip the class.
  Decision: `standards/architecture/DECISIONS.md` (2026-10-14).
- Derive runtime types from schema definitions instead of duplicating parallel `type` / `interface` models.
- Keep plain `type` / `interface` for cases schema cannot represent cleanly (complex type-level transforms, utility types, overload-only surfaces).
- Before choosing nontrivial Schema APIs, check the local Effect v4 source at
  `.repos/effect/packages/effect/SCHEMA.md` and the relevant source module.

Example:

```ts
import * as Identity from "@beep/identity";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

// Plain data: branded Opaque over an annotated Struct.
export class CreateOrderInput extends S.Opaque<CreateOrderInput, { readonly brand: unique symbol }>()(
  S.Struct({
    orderId: S.String,
    customerId: S.String
  }).pipe($I.annoteSchema("CreateOrderInput", {
    description: "Input payload for creating an order."
  }))
) {}

// Tagged data: TaggedStruct keeps `_tag` for Match / catchTag dispatch.
export class OrderPlaced extends S.Opaque<OrderPlaced, { readonly brand: unique symbol }>()(
  S.TaggedStruct("OrderPlaced", {
    orderId: S.String
  }).pipe($I.annoteSchema("OrderPlaced", {
    description: "Event recorded when an order is placed."
  }))
) {}

// Errors stay schema classes, branded.
export class OrderRejected extends S.TaggedError<OrderRejected, { readonly brand: unique symbol }>($I`OrderRejected`)(
  "OrderRejected",
  { reason: S.String },
  $I.annote("OrderRejected", {
    description: "The order could not be accepted."
  })
) {}

const input = CreateOrderInput.make({ orderId: "o-1", customerId: "c-1" })
```

### EF-34: Schema defaults over fallback object logic

- Put defaults in schema definitions, not in handler/service fallback object literals.
- Use `S.withConstructorDefault` for constructor-time defaults.
- Use `S.withDecodingDefaultKey` for decode-time defaults (never `S.withDecodingDefault`, EF-40).

Example:

```ts
import * as Effect from "effect/Effect";
import * as Identity from "@beep/identity";
import * as O from "effect/Option"
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class VersionSyncOptions extends S.Opaque<VersionSyncOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    shouldCheck: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(true)),
      S.withConstructorDefault(Effect.succeed(true))
    ),
    categories: S.Array(S.String).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    )
  }).pipe($I.annoteSchema("VersionSyncOptions", {
    description: "Version sync options with schema-level defaults."
  }))
) {}
```

### EF-35: Schema-backed guards and internal domain modeling

- If a guard validates domain strings/paths/tags, define a branded schema and use `S.is(...)`.
- If a domain constraint is named, reused, matched on, or structurally validated, model it as a schema first rather than a forest of ad-hoc predicate helpers.
- Prefer built-in schema constructors/checks before `S.makeFilter`.
- Keep guard intent and reusable check intent in schema annotations and check metadata.
- Use `LiteralKit` for named internal literal domains whenever `.Enum`, `.is`,
  `match`, `.toTaggedUnion`, or annotation-bearing schema values are useful;
  use `S.Literals` for anonymous inline unions never referenced by name.
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
import * as Identity from "@beep/identity";
import * as Match from "effect/Match";
import { pipe } from "effect/Function";
import * as F from "effect/Function"
import * as A from "effect/Array"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as Str from "effect/String"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

const TopicKind = LiteralKit(["plain", "scoped"])

const ContainsScopeSeparator = S.String.check(
  S.isIncluding(":", $I.annote("ContainsScopeSeparatorCheck", {
    title: "Contains Scope Separator",
    description: "A string that contains `:`.",
    message: "Topic text must contain :",
  }))
).pipe(
  S.brand("ContainsScopeSeparator"),
  $I.annoteSchema("ContainsScopeSeparator", {
    description: "A string that contains the topic scope separator `:`."
  })
)

const isContainsScopeSeparator = S.is(ContainsScopeSeparator)

const TopicSegment = S.NonEmptyString.check(
  S.makeFilter(P.not(isContainsScopeSeparator), $I.annote("TopicSegmentNoSeparatorCheck", {
    title: "Topic Segment No Separator",
    description: "A topic segment that does not contain `:`.",
    message: "Topic segments must not contain :",
  }))
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
  Match.when(isContainsScopeSeparator, F.constant(TopicKind.Enum.scoped)),
  Match.orElse(F.constant(TopicKind.Enum.plain))
)

export const TopicName = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(P.not(Str.endsWith(":")), $I.annote("TopicNameNoTrailingSeparatorCheck", {
        title: "Topic Name No Trailing Separator",
        description: "A topic name that does not end with `:`.",
        message: "Topic names must not end with :",
      })),
      S.makeFilter((value: string) =>
        pipe(
          value,
          classifyTopicKind,
          TopicKind.match({
            plain: isTopicSegment,
            scoped: () => pipe(value, splitNonEmpty(":"), A.every(isTopicSegment))
          })
        ), $I.annote("TopicNameSegmentsCheck", {
        title: "Topic Name Segments",
        description: "A topic name whose segments are valid topic segments.",
        message: "Topic names must contain only valid segments",
      }))
    ],
    $I.annote("TopicNameChecks", {
      title: "Topic Name",
      description: "Checks for a plain or scoped topic name.",
    })
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
- Use `LiteralKit` static APIs (`.Enum`, `.is`, `.match`, `.toTaggedUnion`)
  and the `S.Literals` members it inherits (`.literals`, `.pick(...)`) instead
  of duplicate literal arrays, enum-like objects, and ad-hoc literal guards.
- Use class-local statics for repeated `decode`, `encode`, `arbitrary`, and
  `equivalence` helpers when they reduce repeated plumbing without introducing
  import cycles.
- Reference proofs:
  `packages/foundation/modeling/schema/test/LiteralKit.test.ts` and
  `packages/foundation/modeling/schema/test/MappedLiteralKit.test.ts`.

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
import * as SchemaTransformation from "effect/SchemaTransformation";
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
import * as Order from "effect/Order";
import * as A from "effect/Array"

declare const items: ReadonlyArray<{ readonly name: string }>;

const byName = Order.mapInput(Order.String, (item: { readonly name: string }) => item.name)
const sorted = A.sort(items, byName)
```

### EF-39: Avoid ad-hoc `String(...)` coercion for domain comparisons

- When unknown/scalar data must normalize to domain strings, model the conversion with schema transformations.
- Compare resulting values with `S.toEquivalence(S.String)` (or domain schema equivalence), not raw string equality.

Example:

```ts
import * as SchemaTransformation from "effect/SchemaTransformation";
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

### EF-40: Optional fields use exact keys

- Optional schema fields use `S.optionalKey`, `S.withDecodingDefaultKey` and
  `S.OptionFromOptionalKey`. Never `S.optional`, `S.withDecodingDefault` or
  `S.OptionFromOptional`, wherever the field object lives (inline, a hoisted
  constant, `.pipe(S.optional)`, `Struct.map(S.optional)`, a type position, a
  named import or re-export).
- Why: `S.optional(X)` is `S.optionalKey(S.UndefinedOr(X))`. Under
  `exactOptionalPropertyTypes` it puts `| undefined` back into the field type,
  admits a third state (key present, value `undefined`) that domain code must
  then handle, and its JSON Schema advertises a `null` the decoder rejects. The
  other two are built on it.
- A field whose decoder really receives `undefined` from third-party code (a
  library's `exportJSON()`, an SDK response) is spelled explicitly as
  `S.optionalKey(S.UndefinedOr(X))` (written `X.pipe(S.UndefinedOr, S.optionalKey)`),
  with the producer recorded where the field is declared. Construction sites that hold a possibly-undefined value
  use `O.getSomesStruct({ k: O.fromUndefinedOr(v) })` (EF-2).
- Enforced by the Biome GritQL rule `prefer-exact-optional-key`
  (`@beep/lint-rules`); migrate mechanically with
  `bun run beep lint schema-parity-codemod --rule exact-optional-keys --write`.

Example:

```ts
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

export const Draft = S.Struct({
  title: S.String,
  subtitle: S.optionalKey(S.String),
  revision: S.Int.pipe(S.withDecodingDefaultKey(Effect.succeed(1))),
  tags: S.OptionFromOptionalKey(S.Array(S.String))
})
```

## Copy-Paste Templates

### Template: Tagged error with Identity composer

```ts
import * as S from "effect/Schema"
import * as Identity from "@beep/identity";

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

class DomainError extends S.TaggedError<DomainError, { readonly brand: unique symbol }>($I`DomainError`)(
  "DomainError",
  {
    message: S.String
  },
  $I.annote("DomainError", { description: "Domain failure" })
) {}
```

Use the package `$I` composer when a distinct namespaced schema identifier is
wanted. If no distinct identifier is needed, omit it:
`S.TaggedError<DomainError, { readonly brand: unique symbol }>()("DomainError", fields)`.
Never pass a bare identifier equal to the tag; `redundantSchemaTagIdentifier`
rejects it.

Cause-carrying errors declare `cause: S.Defect({ includeStack: true })`
explicitly in their fields.

### Template: Safe nullable boundary conversion

```ts
import { pipe } from "effect/Function";
import * as O from "effect/Option"

const fromNullableName = (name: string | null | undefined) =>
  pipe(
    O.fromNullishOr(name),
    O.filter((value) => value.length > 0)
  )
```

### Template: Decode unknown at API edge

```ts
import * as Identity from "@beep/identity";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    query: S.String
  }).pipe($I.annoteSchema("Payload", {
    description: "Search request payload."
  }))
) {}

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
import * as Identity from "@beep/identity";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class UserProfile extends S.Opaque<UserProfile, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    displayName: S.String
  }).pipe($I.annoteSchema("UserProfile", {
    description: "User profile model used in domain workflows."
  }))
) {}
```

### Template: Match, LiteralKit([/* ... */]).match or effect/Schema TaggedUnion over switch

```ts
import * as Identity from "@beep/identity";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import * as Match from "effect/Match";
import * as A from "effect/Array"
import { LiteralKit } from "@beep/schema";

const { $ExampleId } = Identity.make("example");
const $I = $ExampleId.create("matching");

const Phase = LiteralKit(
  [
    "draft",
    "running",
    "done"
  ]
)

type Phase = typeof Phase.Type;
const TaggedPhase = Phase.mapMembers(([draft, running, done]) => Tuple.make(
  S.Struct({ phase: S.tag(Phase.Enum.draft)}),
  S.Struct({ phase: S.tag(Phase.Enum.running)}),
  S.Struct({ phase: S.tag(Phase.Enum.done)})
)).pipe(S.toTaggedUnion("phase"))
type TaggedPhase = typeof TaggedPhase.Type;
const phaseLabel = Phase.match({
  draft: () => "draft",
  running: () => "running",
  done: () => "done"
})

const matchPhase: (taggedPhase: TaggedPhase) => Phase = TaggedPhase.match({
  draft: ({phase}) => phase,
  running: ({ phase }) => phase,
  done: ({ phase }) => phase,
})

const summarize = (items: ReadonlyArray<string>) =>
  A.match(items, {
    onEmpty: () => "none",
    onNonEmpty: (values) => `count:${A.length(values)}`
  })

export class SomeErrorOne extends S.TaggedError<SomeErrorOne, { readonly brand: unique symbol }>($I`SomeErrorOne`)("SomeErrorOne", { message: S.String}) {}
export class SomeErrorTwo extends S.TaggedError<SomeErrorTwo, { readonly brand: unique symbol }>($I`SomeErrorTwo`)("SomeErrorTwo", { message: S.String}) {}

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
import * as Effect from "effect/Effect";
export const runTask = Effect.fn("Task.run")(function* (taskId: string) {
  yield* Effect.logInfo("run task", taskId)
  return taskId
})
```

### Template: Option schema from nullish/optional

```ts
import * as Identity from "@beep/identity";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class Input extends S.Opaque<Input, { readonly brand: unique symbol }>()(
  S.Struct({
    maybeName: S.OptionFromNullishOr(S.String),
    maybeEmail: S.OptionFromOptionalKey(S.String)
  }).pipe($I.annoteSchema("Input", {
    description: "Input whose absent fields decode to Option."
  }))
) {}
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
import * as Identity from "@beep/identity";
import * as S from "effect/Schema"

// Illustrative package composer; no registered workspace package is assumed.
const { $PackageNameId } = Identity.make("package-name");

const $I = $PackageNameId.create("relative/path/to/file/from/package/src")

export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    query: S.String
  }).pipe($I.annoteSchema("Payload", {
    description: "Search request payload."
  }))
) {}

const PayloadJson = S.fromJsonString(Payload)

export const decodePayloadJson = S.decodeUnknownEffect(PayloadJson)
export const encodePayloadJson = S.encodeUnknownEffect(PayloadJson)
```

### Template: Runtime boundary execution

```ts
import * as Effect from "effect/Effect";
export const buildReport = Effect.fn("Report.build")(function* () {
  return "ok"
})

// runtime boundary only
// Effect.runPromise(buildReport())
```

### Template: Scoped resource helper

```ts
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";

const Resource = S.Struct({ id: S.String });
type Resource = typeof Resource.Type;
declare const acquireResource: Effect.Effect<Resource>;
declare const releaseResource: (resource: Resource) => Effect.Effect<void>;
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
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

declare const task: Effect.Effect<string, string>;
export const resilientTask = task.pipe(
  Effect.retry(Schedule.recurs(3)),
  Effect.timeoutOption(Duration.seconds(5))
)
```

### Template: Config + redacted secret

```ts
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
export const loadConfig = Effect.fn("Config.load")(function* () {
  const port = yield* Config.Port("PORT")
  const apiKey = yield* Config.Redacted("API_KEY")
  return { port, apiKey }
})
```

### Template: Isolated layer provide

```ts
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Context from "effect/Context";
class AppService extends Context.Service<AppService, { readonly value: string }>()("example/AppService") {}
const program = AppService.use((service) => Effect.succeed(service.value));
const AppLayer = Layer.effect(AppService, Effect.sync(() => ({ value: "isolated instance" })));
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
17. New plain-data object schemas are branded `S.Opaque` classes; every `S.Class` / `S.TaggedClass` / `S.Error` / `S.TaggedError` / `S.Opaque` carries `{ readonly brand: unique symbol }`.
18. Required verification commands are green.
19. `Effect.run*` appears only in runtime boundaries (entrypoint/test harness).
20. Promise-based APIs are lifted with `Effect.tryPromise`.
21. Acquired resources use `Effect.acquireUseRelease` or `Effect.scoped`.
22. Retries are declared with `Effect.retry` + `Schedule`.
23. Timeouts use `Effect.timeoutOption` / `Effect.timeoutOrElse`.
24. Forking intent is explicit (`forkChild` default; `forkDetach` justified).
25. Large fan-out operations specify concurrency deliberately.
26. Config values come from `Config` / `ConfigProvider`, not direct `process.env` in domain logic.
27. Secrets are `Redacted` (`Config.Redacted` / `Redacted.make`) and not logged raw.
28. Recovery uses `catchTag` / `catchFilter` for targeted cases.
29. Expected failures use `Effect.fail`; defects are reserved for invariants.
30. Isolation-sensitive layer provisioning uses `{ local: true }` or `Layer.fresh`.
31. New domain data models are schema-first; plain `type` / `interface` is used only when schema is not a practical fit.
32. Finite variants, lifecycle states, status/result cases, and case-specific payloads are modeled as discriminated unions; literal-string discriminants and named internal literal domains use `LiteralKit` when `.Enum`, `.is`, `match`, or `.toTaggedUnion` are needed; anonymous inline unions never referenced by name use `S.Literals`.
33. Schema defaults use `S.withConstructorDefault` / `S.withDecodingDefaultKey`, not ad-hoc fallback objects in handlers/services.
34. Named or reused domain constraints are modeled as schemas first; built-in schema constructors/checks are preferred before `S.makeFilter`.
35. Guard helpers for domain strings/paths/tags come from branded schemas with `S.is(...)`, not ad-hoc `regex.test(...)` predicates.
36. Reusable schema checks and filter groups carry `identifier`, `title`, and `description`.
37. Intermediate schemas are exported only when reusable or materially clarifying; otherwise they stay module-local.
38. Schema-modeled comparisons use `S.toEquivalence(...)` where practical.
39. Deterministic format conversions use `S.decodeTo(..., SchemaTransformation.transform(...))`.
40. Trivial helper wrapper lambdas are collapsed to direct helper refs where safe, and passthrough `pipe(...)` callbacks are expressed with `flow(...)`.
41. Runtime source avoids `node:fs` / `node:path` / `node:child_process`; use Effect `FileSystem` / `Path` / process services.
42. Runtime source avoids native `fetch`; HTTP boundaries use `effect/http` + platform layers (`BunHttpClient.layer`, etc.).
43. Runtime sorting uses `A.sort` with explicit `Order`, not native `Array.prototype.sort`.
44. Boolean branching prefers `Bool.match` over ad-hoc `if/else` when branching on booleans.
45. HTTP request/response composition uses Effect HTTP modules (`HttpClientRequest`, `HttpClientResponse`, `Headers`, `UrlParams`, `HttpMethod`, `HttpBody`).
46. Optional schema fields use exact keys: `S.optionalKey` / `S.withDecodingDefaultKey` / `S.OptionFromOptionalKey`, never `S.optional` / `S.withDecodingDefault` / `S.OptionFromOptional` (EF-40).
