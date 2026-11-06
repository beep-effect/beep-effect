# Always / Never — Observability + Runtime Boundaries (Examples 10-17)

Loaded on demand from `effect-first-development/SKILL.md`. Repository laws win on conflict.

## Table of Contents

- [10) Observability and metrics](#10-observability-and-metrics)
- [10b) Boundary logging with Cause](#10b-boundary-logging-with-cause)
- [10c) Process entrypoint teardown](#10c-process-entrypoint-teardown)
- [11) Duration values](#11-duration-values)
- [12) Nullish schemas to Option](#12-nullish-schemas-to-option)
- [13) Dual helper APIs](#13-dual-helper-apis)
- [14) JSON parse / stringify with Schema](#14-json-parse--stringify-with-schema)
- [15) Runtime boundary for running effects](#15-runtime-boundary-for-running-effects)
- [16) Promise boundaries with `Effect.tryPromise`](#16-promise-boundaries-with-effecttrypromise)
- [16b) `Result` boundaries with `Effect.fromResult`](#16b-result-boundaries-with-effectfromresult)
- [17) Scoped resource safety](#17-scoped-resource-safety)

### 10) Observability and metrics

These names are illustrative. Declare the metrics in the owning package's
`*.instruments.ts` catalog with UCUM units `ms` for duration and `1` for
outcomes, plus the `example.operation.id` trace attribute and bounded
`beep.outcome` metric attribute. This fence shows instrumentation; it does
not create those catalog declarations or authorize a rename of existing metrics.

```ts
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric"

const latency = Metric.histogram("beep.operation.duration", {
  boundaries: Metric.boundariesFromIterable([10, 50, 100, 250, 500, 1000])
})
const failedOutcomes = Metric.counter("beep.operation.outcomes", {
  attributes: { "beep.outcome": "failed" }
})

const runOperation = Effect.fn("Operation.run")(function* (id: string) {
  yield* Effect.annotateCurrentSpan("example.operation.id", id)
  return "ok"
},
  Effect.withLogSpan("operation.run"),
  Effect.annotateLogs({ service: "beep-effect" }),
  Effect.trackDuration(latency, Duration.toMillis),
  Effect.trackErrors(failedOutcomes, () => 1)
)
```

### 10b) Boundary logging with Cause

```ts
import * as S from "effect/Schema";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
class DomainError extends S.TaggedError<DomainError, { readonly brand: unique symbol }>()("DomainError", { message: S.String }) {}
const respond = <A>(effect: Effect.Effect<A, DomainError>) =>
  effect.pipe(
    Effect.catchCause((cause) => {
      const error = Cause.squash(cause)
      return Effect.logError({
        message: "request failed",
        cause: Cause.pretty(cause)
      }).pipe(
        Effect.andThen(Effect.fail(error))
      )
    })
  )
```

### 10c) Process entrypoint teardown

```ts
import * as Effect from "effect/Effect";
import { BunRuntime } from "@effect/platform-bun"
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Runtime from "effect/Runtime";
const program = Effect.void;
// NEVER: recover the root failure just to set process.exitCode.
// const main = program.pipe(Effect.catchCause((cause) => Effect.sync(() => {
//   process.exitCode = 1
//   console.error(Cause.pretty(cause))
// })))
// BunRuntime.runMain(main)

// ALWAYS: let runMain observe the failing root effect.
BunRuntime.runMain(program)

// If custom terminal rendering is required, customize teardown and delegate
// exit-code semantics back to the Effect runtime.
BunRuntime.runMain(program, {
  disableErrorReporting: true,
  teardown: (exit, onExit) => {
    if (Exit.isFailure(exit)) {
      console.error(Cause.pretty(exit.cause))
    }
    Runtime.defaultTeardown(exit, onExit)
  }
})
```

### 11) Duration values

```ts
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
const requestTimeout = Duration.seconds(30)
const retryWindow = Duration.minutes(5)

const program = Effect.sleep(retryWindow).pipe(
  Effect.timeout(requestTimeout)
)
```

### 12) Nullish schemas to Option

```ts
import { $SchemaId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $SchemaId.create("relative/path/to/file/from/package/src")

export class ProfileInput extends S.Opaque<ProfileInput, { readonly brand: unique symbol }>()(
  S.Struct({
    nickname: S.OptionFromNullishOr(S.String),
    email: S.OptionFromOptionalKey(S.String),
    avatarUrl: S.OptionFromNullOr(S.String)
  }).pipe($I.annoteSchema("ProfileInput", {
    description: "Profile input whose absent fields decode to Option."
  }))
) {}
```

For runtime `Option` object fields, prefer `O.getSomesStruct({...})` (`@beep/utils`) for heterogeneous struct spreads with known keys — runtime-identical to `R.getSomes` but type-preserving per key — and reserve `R.getSomes({...})` for homogeneous dynamic-key dictionaries; use `O.all({...})` when the whole object should exist only if every field is `Some`. When a single `Option` becomes an object, prefer `O.map(...)` plus `O.getOrElse(() => ({}))` over `O.match(...)` with `onNone: () => ({})`. (Amended 2026-07-05 — see `standards/architecture/DECISIONS.md`.)

### 13) Dual helper APIs

```ts
import { dual, pipe } from "effect/Function"
export const prefixTag: {
  (tag: string): (self: string) => string
  (self: string, tag: string): string
} = dual(2, (self: string, tag: string) => `[${tag}] ${self}`)

const dataFirst = prefixTag("hello", "info")
const dataLast = pipe("hello", prefixTag("info"))
```

### 14) JSON parse / stringify with Schema

```ts
import { $SchemaId } from "@beep/identity/packages"
import * as Effect from "effect/Effect";
import * as S from "effect/Schema"

const $I = $SchemaId.create("relative/path/to/file/from/package/src")

class UserJsonCodecError extends S.TaggedError<UserJsonCodecError, { readonly brand: unique symbol }>($I`UserJsonCodecError`)(
  "UserJsonCodecError",
  { message: S.String },
  $I.annote("UserJsonCodecError", {
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

const decodeUserJson = S.decodeUnknownEffect(UserJson)
const encodeUserJson = S.encodeUnknownEffect(UserJson)

const decodeUnknownJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown))
const encodeUnknownJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown))

const decodeUserJsonAtBoundary = (input: unknown) =>
  decodeUserJson(input).pipe(
    Effect.mapError((error) => new UserJsonCodecError({ message: error.message }))
  )
```

### 15) Runtime boundary for running effects

```ts
import * as Effect from "effect/Effect";
// Library export: return Effect, do not run it here.
export const generateReport = Effect.fn("Report.generate")(function* () {
  return "report"
})

// App/test boundary only:
// Effect.runPromise(generateReport())
```

### 16) Promise boundaries with `Effect.tryPromise`

Use this at a promise-only SDK boundary. HTTP requests use Effect's
`HttpClient`; do not wrap native `fetch` as the repository HTTP adapter.

```ts
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
class LegacyReadError extends S.TaggedError<LegacyReadError, { readonly brand: unique symbol }>()("LegacyReadError", { key: S.String, message: S.String }) {}
// Promise-only SDK and error translator supplied by the owning adapter.
declare const readLegacyText: (key: string) => Promise<string>;
declare const translateLegacyFailure: (key: string, cause: unknown) => LegacyReadError;
const readText = (key: string) =>
  Effect.tryPromise({
    try: () => readLegacyText(key),
    catch: (cause) => translateLegacyFailure(key, cause)
  })
```

### 16b) `Result` boundaries with `Effect.fromResult`

A `Result` is not an `Effect` — generator yields are constrained to
`Effect<any, any, any>`, so `yield* someResult` is rejected. The error arrives as an
opaque `TS2769` "No overload matches this call" wall; bypass it and the fiber dies with
`Fiber.runLoop: Not a valid effect`. When a table converter's declared return type
is `Result`, including schema-encoding `to<Entity>Insert` converters, every
generator call site bridges. Direct-value insert converters are already values and
must not be passed to `Effect.fromResult`. Law: `EF-22b`.

```ts
import * as Result from "effect/Result";
import * as Effect from "effect/Effect";
type CandorDisposition = { readonly value: string };
declare const toCandorDispositionInsert: (disposition: CandorDisposition) => Result.Result<{ readonly value: string }, string>;
declare const write: (row: { readonly value: string }) => Effect.Effect<void, string>;
const insertDisposition = Effect.fnUntraced(function* (disposition: CandorDisposition) {
  const row = yield* Effect.fromResult(toCandorDispositionInsert(disposition))
  return yield* write(row)
})
```

### 17) Scoped resource safety

```ts
import * as Effect from "effect/Effect";
type Connection = { readonly query: (sql: string) => Effect.Effect<string> };
declare const openConnection: Effect.Effect<Connection, string>;
declare const closeConnection: (conn: Connection) => Effect.Effect<void>;
const withConnection = <A, E, R>(
  use: (conn: Connection) => Effect.Effect<A, E, R>
) =>
  Effect.acquireUseRelease(
    openConnection,
    use,
    closeConnection
  )
```
