# Testing Patterns - Effect Library

## 🎯 OVERVIEW

Comprehensive testing strategies for the Effect library using @effect/vitest, with emphasis on proper Effect patterns, TestClock usage, and type-safe testing approaches.

## 🚨 CRITICAL TESTING REQUIREMENTS

### Testing Framework Selection

#### ✅ Use @effect/vitest for Effect-based modules

```typescript
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"

// MANDATORY: Use it.effect for Effect-based tests
it.effect("should work with Effects", 
  Effect.fnUntraced(function*() {
    const result = yield* someEffect
    assert.strictEqual(result, expectedValue)
  }))
```

#### ✅ Use regular vitest for pure TypeScript functions

```typescript
import { describe, expect, it } from "vitest"

// For pure functions that don't return Effects
it("should work with pure functions", () => {
  const result = pureFunction(input)
  expect(result).toBe(expectedValue)
})
```

### ❌ FORBIDDEN PATTERNS

#### Never use Effect.runSync in tests

```typescript
// ❌ WRONG - Don't use Effect.runSync with regular it
import { describe, expect, it } from "vitest"

it("wrong pattern", () => {
  const result = Effect.runSync(Effect.gen(function*() {
    return yield* someEffect
  }))
  expect(result).toBe(value) // Plain-value assertion is legal; the runner above is the problem
})

// ✅ CORRECT - Use it.effect instead
import { assert, describe, it } from "@effect/vitest"

it.effect("correct pattern", 
  Effect.fnUntraced(function*() {
    const result = yield* someEffect
    assert.strictEqual(result, value) // expect(result).toBe(value) is also legal for plain values
  }))
```

### Choose assertions by value, not by tester

`expect` and plain-value `assert` are legal inside `it.effect`. For Option,
Result, and Exit values, use the public `@effect/vitest/utils` helpers instead
of tag predicates or equality checks on the container. Keep both the expected
variant and its payload in the assertion; see the complete examples below.

```typescript
import { expect, it } from "@effect/vitest"
import { assertSome } from "@effect/vitest/utils"
import { Effect } from "effect"
import * as O from "effect/Option"

it.effect("asserts an Option payload and a plain value", Effect.fnUntraced(function*() {
  const result = yield* Effect.succeed(O.some(42))
  assertSome(result, 42)
  expect(result.value + 1).toBe(43)
}))
```

## 🕐 TIME-DEPENDENT TESTING WITH TESTCLOCK

### ⚠️ CRITICAL: Always use TestClock for time-dependent operations

Any code that involves timing must use TestClock to avoid flaky tests:

```typescript
import { assert, describe, it } from "@effect/vitest"
import { assertExitFailure } from "@effect/vitest/utils"
import { Effect } from "effect"
import * as Cause from "effect/Cause"
import * as TestClock from "effect/testing/TestClock"

describe("time-dependent operations", () => {
  it.effect("should handle delays with TestClock", 
    Effect.fnUntraced(function*() {
      // Start operation that takes 5 seconds
      const fiber = yield* Effect.fork(
        Effect.gen(function*() {
          yield* Effect.sleep("5 seconds")
          return "completed"
        })
      )

      // Use TestClock.adjust with string duration (preferred pattern)
      yield* TestClock.adjust("5 seconds")

      const result = yield* Effect.join(fiber)
      assert.strictEqual(result, "completed")
    }))

  it.effect("should test timeout behavior", 
    Effect.fnUntraced(function*() {
      const timeoutEffect = Effect.timeout(
        Effect.sleep("10 seconds"),
        "5 seconds"
      )

      const fiber = yield* Effect.fork(timeoutEffect)

      // Advance time to trigger timeout
      yield* TestClock.adjust("5 seconds")

      const result = yield* Effect.exit(Effect.join(fiber))
      assertExitFailure(result, Cause.fail(new Cause.TimeoutError()))
    }))

  it.effect("should set absolute time with setTime", 
    Effect.fnUntraced(function*() {
      // Set clock to specific timestamp
      yield* TestClock.setTime(1000)

      const fiber = yield* Effect.fork(
        Effect.gen(function*() {
          yield* Effect.sleep("2 seconds")
          return yield* Effect.clockWith((clock) => clock.currentTimeMillis)
        })
      )

      yield* TestClock.adjust("2 seconds")
      const result = yield* Effect.join(fiber)
      assert.strictEqual(result, 3000) // 1000 + 2000ms
    }))
})
```

### Operations requiring TestClock

- `Effect.sleep()` and `Effect.delay()`
- `Effect.timeout()` and `Effect.race()` with timeouts
- Scheduled operations and retry logic
- Queue operations with time-based completion
- Any concurrent operations dependent on timing

## 🧪 COMPREHENSIVE TESTING PATTERNS

### Basic Effect Testing Pattern

```typescript
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import * as MyModule from "../src/MyModule.js"

describe("MyModule", () => {
  describe("constructors", () => {
    it.effect("create should initialize with default values", 
      Effect.fnUntraced(function*() {
        const instance = yield* MyModule.create()

        assert.isTrue(MyModule.isInstance(instance))
        assert.strictEqual(MyModule.getValue(instance), 0)
      }))

    it.effect("create should accept custom configuration", 
      Effect.fnUntraced(function*() {
        const config = { initialValue: 42 }
        const instance = yield* MyModule.create(config)

        assert.strictEqual(MyModule.getValue(instance), 42)
      }))
  })

  describe("combinators", () => {
    it.effect("map should transform values",
      Effect.fnUntraced(function*() {
        const instance = yield* MyModule.create({ initialValue: 10 })
        const transformed = yield* MyModule.map(instance, (x) => x * 2)

        assert.strictEqual(MyModule.getValue(transformed), 20)
      }))
  })
})
```

### Error Handling Testing Pattern

```typescript
import { assert, describe, it } from "@effect/vitest"
import { assertExitFailure } from "@effect/vitest/utils"
import { Effect } from "effect"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as MyModule from "../src/MyModule.js"

describe("error handling", () => {
  it.effect("should fail with validation error for negative values", 
    Effect.fnUntraced(function*() {
      const result = yield* Effect.exit(
        MyModule.create({ initialValue: -1 })
      )

      // Extract the error, not its Cause; success or a defect-only cause throws.
      const error = O.getOrThrow(Exit.findErrorOption(result))
      assertExitFailure(result, Cause.fail(error))
      assert.isTrue(MyModule.isValidationError(error))
    }))

  it.effect("should handle network errors gracefully", 
    Effect.fnUntraced(function*() {
      const expectedError = new MyModule.NetworkError({
        message: "Connection timeout"
      })
      const mockNetworkFailure = Effect.fail(expectedError)

      const result = yield* Effect.exit(
        MyModule.fetchWithRetry("https://api.example.com")
          .pipe(Effect.provide(Layer.succeed(NetworkService, {
            fetch: () => mockNetworkFailure
          })))
      )

      assertExitFailure(result, Cause.fail(expectedError))
    }))
})
```

### Resource Management Testing Pattern

```typescript
import { assert, describe, it } from "@effect/vitest"
import { assertExitFailure } from "@effect/vitest/utils"
import { Effect } from "effect"
import * as Cause from "effect/Cause"
import * as Ref from "effect/Ref"
import * as ResourceModule from "../src/ResourceModule.js"

describe("resource management", () => {
  it.effect("should properly acquire and release resources", 
    Effect.fnUntraced(function*() {
      const acquired = yield* Ref.make(false)
      const released = yield* Ref.make(false)

      const mockResource = {
        acquire: Effect.sync(() => Ref.set(acquired, true)),
        use: (resource: unknown) => Effect.succeed("used"),
        release: Effect.sync(() => Ref.set(released, true))
      }

      const result = yield* ResourceModule.withResource(
        mockResource.acquire,
        mockResource.use,
        mockResource.release
      )

      assert.strictEqual(result, "used")
      assert.isTrue(yield* Ref.get(acquired))
      assert.isTrue(yield* Ref.get(released))
    }))

  it.effect("should release resources even on failure", 
    Effect.fnUntraced(function*() {
      const released = yield* Ref.make(false)

      const result = yield* Effect.exit(
        ResourceModule.withResource(
          Effect.succeed("resource"),
          () => Effect.fail("operation failed"),
          () => Ref.set(released, true)
        )
      )

      assertExitFailure(result, Cause.fail("operation failed"))
      assert.isTrue(yield* Ref.get(released))
    }))
})
```

### Concurrent Operations Testing Pattern

```typescript
import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, Fiber, TestClock } from "effect"
import * as ConcurrentModule from "../src/ConcurrentModule.js"

describe("concurrent operations", () => {
  it.effect("should handle multiple concurrent operations", 
    Effect.fnUntraced(function*() {
      const operations = [
        ConcurrentModule.operation("A"),
        ConcurrentModule.operation("B"),
        ConcurrentModule.operation("C")
      ]

      const results = yield* Effect.all(operations, { concurrency: "unbounded" })

      assert.strictEqual(results.length, 3)
      assert.includeMembers(results, ["A", "B", "C"])
    }))

  it.effect("should respect concurrency limits", 
    Effect.fnUntraced(function*() {
      const startTimes = yield* Ref.make<string[]>([])

      const timedOperation = (id: string) =>
        Effect.gen(function*() {
          yield* Ref.update(startTimes, (arr) => [...arr, id])
          yield* Effect.sleep(Duration.seconds(1))
          return id
        })

      const operations = ["A", "B", "C", "D"].map(timedOperation)

      const fiber = yield* Effect.fork(
        Effect.all(operations, { concurrency: 2 })
      )

      // Advance time and check concurrent execution
      yield* TestClock.advance(Duration.millis(500))
      const midResults = yield* Ref.get(startTimes)
      assert.strictEqual(midResults.length, 2) // Only 2 should start

      yield* TestClock.advance(Duration.seconds(1))
      const finalResults = yield* Effect.join(fiber)
      assert.strictEqual(finalResults.length, 4)
    }))
})
```

### Layer and Service Testing Pattern

Use `Context.Service` for defining services in the Effect codebase:

```typescript
import { assert, describe, it } from "@effect/vitest"
import { assertExitFailure } from "@effect/vitest/utils"
import { Effect } from "effect"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as ServiceModule from "../src/ServiceModule.js"

// Define services using Context.Service pattern
class DatabaseService extends Context.Service<DatabaseService, {
  readonly query: (sql: string) => Effect.Effect<unknown[]>
}>()("DatabaseService") {
  // Live implementation for production
  static Live = Layer.succeed(DatabaseService)({
    query: (sql) => Effect.succeed([])
  })
}

// Test service with mock implementation
class TestDatabaseService extends Context.Service<TestDatabaseService, {
  readonly query: (sql: string) => Effect.Effect<unknown[]>
}>()("TestDatabaseService") {
  static Mock = (mockData: unknown[]) =>
    Layer.succeed(TestDatabaseService)({
      query: (_sql) => Effect.succeed(mockData)
    })

  static Failing = (error: string) =>
    Layer.succeed(TestDatabaseService)({
      query: () => Effect.fail(error)
    })
}

describe("service integration", () => {
  it.effect("should work with mock services", 
    Effect.fnUntraced(function*() {
      const mockData = [{ id: 1, name: "test" }]

      const result = yield* ServiceModule.findUser("1")
        .pipe(Effect.provide(TestDatabaseService.Mock(mockData)))

      assert.deepStrictEqual(result, mockData[0])
    }))

  it.effect("should handle service failures", 
    Effect.fnUntraced(function*() {
      const result = yield* Effect.exit(
        ServiceModule.findUser("1")
          .pipe(Effect.provide(TestDatabaseService.Failing("Database connection failed")))
      )

      assertExitFailure(result, Cause.fail("Database connection failed"))
    }))

  it.effect("should use direct Layer.succeed for simple mocks", 
    Effect.fnUntraced(function*() {
      // For simple one-off mocks, use Layer.succeed directly
      const result = yield* ServiceModule.getValue()
        .pipe(
          Effect.provide(
            Layer.succeed(DatabaseService)({
              query: () => Effect.succeed([{ value: 42 }])
            })
          )
        )

      assert.strictEqual(result, 42)
    }))
})
```

## 🎯 ASSERTION PATTERNS

### Plain-value Assertions

These `assert` methods remain legal, as do equivalent `expect` matchers, for
plain values in either plain `it` or `it.effect`. Use the specialized helpers
in the next section for Option, Result, and Exit containers.

```typescript
// Equality assertions
assert.strictEqual(actual, expected) // Reference/primitive equality
assert.notStrictEqual(actual, expected) // Reference/primitive inequality
assert.deepStrictEqual(actualObject, expectedObject) // Deep structural equality
assert.deepEqual(actual, expected) // Vitest/Chai structural equality; not Effect's Equal.equals

// Boolean assertions
assert.isTrue(condition)
assert.isFalse(condition)
assert.ok(condition, "optional message") // Boolean with custom message

// Null/undefined assertions
assert.isNull(value)
assert.isNotNull(value)
assert.isUndefined(value)
assert.isDefined(value)

// Numeric comparisons
assert.isAtLeast(actual, expected) // actual >= expected
assert.isAtMost(actual, expected) // actual <= expected

// String/regex assertions
assert.match(string, regex) // String matches regex pattern

// Array assertions
assert.includeMembers(actualArray, expectedItems)

// For custom error types
assert.isTrue(MyModule.isCustomError(error))

```

### Specialized Option, Result, and Exit Assertions

Import helpers from `@effect/vitest/utils`. At rc.113, `assertSome`,
`assertSuccess`, `assertFailure`, `assertExitSuccess`, and `assertExitFailure`
require an expected payload (or Cause for Exit failure), check it with deep
strict equality, and narrow the container. `assertNone` needs only the Option.
They fail on the wrong variant or payload; no conditional assertion branch is
needed. `assertExitFailure(exit, Cause.fail(error))` checks a typed error;
`Cause.die(defect)` checks a defect. A bare error is not a Cause.

Use `Effect.exit` to inspect an Effect's outcome. The Result examples below
exercise Result values directly; there is no need to wrap a pure Result in an
Effect or convert an Effect to Result just to assert its outcome.

```typescript
import { describe, expect, it } from "@effect/vitest"
import { assertExitFailure, assertExitSuccess, assertFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils"
import { Effect } from "effect"
import * as Cause from "effect/Cause"
import * as O from "effect/Option"
import * as Result from "effect/Result"

describe("specialized assertions", () => {
  it("asserts Some and its payload", () => {
    const result: O.Option<{ readonly id: number }> = O.some({ id: 1 })
    assertSome(result, { id: 1 })
    expect(result.value.id).toBe(1)
  })

  it("asserts None", () => {
    const result: O.Option<number> = O.none()
    assertNone(result)
  })

  it.effect("should assert Exit success", 
    Effect.fnUntraced(function*() {
      const result = yield* Effect.exit(Effect.succeed(42))

      // Type-safe assertion that narrows Exit type
      assertExitSuccess(result, 42)
      expect(result.value + 1).toBe(43)
    }))

  it.effect("should assert Exit failure", 
    Effect.fnUntraced(function*() {
      const result = yield* Effect.exit(Effect.fail("error"))

      // Asserts failure and validates the complete Cause
      assertExitFailure(result, Cause.fail("error"))
    }))

  it("should assert Result success", () => {
    const result: Result.Result<string, string> = Result.succeed("value")
    assertSuccess(result, "value")
    expect(result.success.length).toBe(5)
  })

  it("should assert Result failure", () => {
    const result: Result.Result<string, string> = Result.fail("error")
    assertFailure(result, "error")
    expect(result.failure.length).toBe(5)
  })
})
```

### Testing Complex Data Structures

```typescript
it.effect("should handle complex data transformations", 
  Effect.fnUntraced(function*() {
    const input = {
      users: [
        { id: "1", name: "Alice", age: 30 },
        { id: "2", name: "Bob", age: 25 }
      ]
    }

    const result = yield* MyModule.processUsers(input)

    // Test structure
    assert.isTrue(Array.isArray(result.processedUsers))
    assert.strictEqual(result.processedUsers.length, 2)

    // Test individual items
    const alice = result.processedUsers.find((u) => u.id === "1")
    assert.isDefined(alice)
    assert.strictEqual(alice?.name, "Alice")
    assert.strictEqual(alice?.processed, true)
  }))
```

## 🔧 TEST ORGANIZATION PATTERNS

### Group Related Tests

```typescript
describe("ModuleName", () => {
  describe("constructors", () => {
    // Tests for creation functions
  })

  describe("combinators", () => {
    // Tests for transformation functions
  })

  describe("predicates", () => {
    // Tests for boolean-returning functions
  })

  describe("error handling", () => {
    // Tests for error conditions
  })

  describe("integration", () => {
    // Tests for service integration
  })
})
```

### Progressive Test Complexity

```typescript
describe("feature progression", () => {
  it.effect("basic functionality", Effect.fnUntraced(function* () {
     /* simple test */
  }))
  
    it.effect("with configuration", Effect.fnUntraced(function* () {
     /* configuration test */
  }))
  
    it.effect("with error handling", Effect.fnUntraced(function* () {
      /* error test */
  }))
  
  it.effect("with concurrency", Effect.fnUntraced(function* () {
     /* concurrent test */
  }))
  
  it.effect("full integration", Effect.fnUntraced(function* () {
     /* comprehensive test */
  }))
})
```

This comprehensive testing approach ensures reliable, maintainable test suites that properly validate Effect-based code while avoiding common pitfalls and anti-patterns.
