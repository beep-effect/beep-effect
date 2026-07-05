# Always / Never — Resilience + Recovery (Examples 18-23)

Loaded on demand from `effect-first-development/SKILL.md`. Repository laws win on conflict.

## Table of Contents

- [18) Retry + timeout modeling](#18-retry--timeout-modeling)
- [19) Structured concurrency + bounded parallelism](#19-structured-concurrency--bounded-parallelism)
- [20) Config + secret redaction](#20-config--secret-redaction)
- [21) Precise recovery by tag](#21-precise-recovery-by-tag)
- [22) Expected failures vs defects](#22-expected-failures-vs-defects)
- [23) Layer isolation when sharing is unsafe](#23-layer-isolation-when-sharing-is-unsafe)

### 18) Retry + timeout modeling

```ts
import { Duration, Effect, Schedule } from "effect"

const resilient = task.pipe(
  Effect.retry(Schedule.recurs(3)),
  Effect.timeoutOption(Duration.seconds(5))
)
```

### 19) Structured concurrency + bounded parallelism

```ts
import { Effect, Fiber } from "effect"

const runWorkers = Effect.fn("Workers.run")(function* (jobs: ReadonlyArray<Job>) {
  const fiber = yield* Effect.forkChild(backgroundHeartbeat)
  const results = yield* Effect.forEach(jobs, runJob, { concurrency: 8 })
  yield* Fiber.interrupt(fiber)
  return results
})
```

### 20) Config + secret redaction

```ts
import { Config, Effect } from "effect"

const loadSettings = Effect.fn("Settings.load")(function* () {
  const port = yield* Config.int("PORT")
  const apiKey = yield* Config.redacted("API_KEY")

  yield* Effect.logInfo(`port=${port}`)
  yield* Effect.logDebug(`apiKey=${String(apiKey)}`)

  return { port, apiKey }
})
```

### 21) Precise recovery by tag

```ts
import { Effect } from "effect"
import * as O from "effect/Option"

const findUserOptional = (id: string) =>
  findUser(id).pipe(
    Effect.map(O.some),
    Effect.catchTag("UserNotFoundError", () => Effect.succeed(O.none()))
  )
```

### 22) Expected failures vs defects

```ts
import { Effect } from "effect"

const process = Effect.fn("Process.run")(function* (input: Input) {
  if (input.value.length === 0) {
    return yield* Effect.fail(new ValidationError({ message: "value must be non-empty" }))
  }

  if (input.value === "__impossible__") {
    return yield* Effect.die("unreachable state")
  }

  return input.value
})
```

### 23) Layer isolation when sharing is unsafe

```ts
import { Effect, Layer } from "effect"

const isolatedProgram = program.pipe(
  Effect.provide(Layer.fresh(AppLayer), { local: true })
)
```
