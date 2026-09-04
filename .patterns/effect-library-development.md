# Effect Library Development Patterns

## 🎯 OVERVIEW

Fundamental patterns for developing high-quality, type-safe code within the Effect library ecosystem. These patterns ensure consistency, reliability, and maintainability across the codebase.

## 🚨 CRITICAL FORBIDDEN PATTERNS

### ❌ NEVER: try-catch in Effect.gen

**REASON**: Effect generators handle errors through the Effect type system, not JavaScript exceptions.

```typescript
// ❌ WRONG - This will cause runtime errors
Effect.gen(function*() {
  try {
    const result = yield* someEffect
    return result
  } catch (error) {
    // This will never be reached and breaks Effect semantics
    console.error(error)
  }
})

// ✅ CORRECT - Use Effect's built-in error handling
Effect.gen(function*() {
  const result = yield* Effect.result(someEffect)
  if (result._tag === "Failure") {
    // Handle error case properly
    console.error("Effect failed:", result.cause)
    return yield* Effect.fail("Handled error")
  }
  return result.value
})
```

### ❌ NEVER: Type Assertions

**REASON**: Type assertions hide real type errors and break TypeScript's safety guarantees.

```typescript
// ❌ FORBIDDEN - These break type safety
const value = something as any
const value = something as never
const value = something as unknown

// ✅ CORRECT - Fix the underlying type issues
// Use proper generic type parameters
function processValue<T>(value: T): Effect.Effect<T, never, never> {
  return Effect.succeed(value)
}

// Use proper Effect constructors
const safeValue = Effect.try(() => new URL(urlString))
```

## ✅ MANDATORY PATTERNS

### 🔄 return yield* Pattern for Errors

**CRITICAL**: Always use `return yield*` when yielding terminal effects.

```typescript
// ✅ CORRECT - Makes termination explicit
Effect.gen(function*() {
  if (invalidCondition) {
    return yield* Effect.fail("Validation failed")
  }

  if (shouldInterrupt) {
    return yield* Effect.interrupt
  }

  // Continue with normal flow
  const result = yield* someOtherEffect
  return result
})

// ❌ WRONG - Missing return keyword leads to unreachable code
Effect.gen(function*() {
  if (invalidCondition) {
    yield* Effect.fail("Validation failed") // Missing return!
    // Unreachable code after error!
  }
})
```

## 🏗️ CORE DEVELOPMENT PATTERNS

### Effect.gen Composition Pattern

Use `Effect.fn` for sequential operations with proper error propagation:

```typescript
import { Console, Effect } from "effect"

const processData = Effect.fn("processData")(function* (input: string) {
    // Validate input
    if (input.length === 0) {
      return yield* Effect.fail("Input cannot be empty")
    }

    // Transform data
    const processed = yield* Effect.try({
      try: () => JSON.parse(input),
      catch: (error) => `Invalid JSON: ${error}`
    })

    // Log progress
    yield* Console.log(`Processed: ${JSON.stringify(processed)}`)

    return processed
  })
```

### Effect.gen vs Effect.fn vs Effect.fnUntraced

Choose the right function constructor based on your use case:

| Feature         | `Effect.gen`               | `Effect.fn`                    | `Effect.fnUntraced`            |
|-----------------|----------------------------|--------------------------------|--------------------------------|
| **Purpose**     | One-off effect composition | Reusable effectful functions   | Internal/performance-critical  |
| **Returns**     | `Effect<A, E, R>`          | `(...args) => Effect<A, E, R>` | `(...args) => Effect<A, E, R>` |
| **Tracing**     | Uses parent span           | Creates new span + stack trace | No tracing overhead            |
| **Performance** | Standard                   | Overhead for tracing           | Minimal overhead               |
| **Use case**    | Inline composition         | Public API methods             | Library internals              |

#### Effect.gen - Inline Composition

Use for one-off effect composition that doesn't need to be reused as a function:

```typescript
import { Effect } from "effect"

// One-off effect, no function wrapper needed
const program = Effect.gen(function*() {
  const user = yield* fetchUser(id)
  const posts = yield* fetchPosts(user.id)
  return { user, posts }
})
```

#### Effect.fn - Traced Reusable Functions (Public API)

Use for reusable effectful functions that benefit from tracing and stack traces:

```typescript
import { Effect } from "effect"

// Creates a traced function with span + stack capture
const fetchUserPosts = Effect.fn("fetchUserPosts")(function*(userId: string) {
  yield* Effect.annotateCurrentSpan("userId", userId)
  const user = yield* fetchUser(userId)
  const posts = yield* fetchPosts(user.id)
  return { user, posts }
})

// Calling creates a span named "fetchUserPosts" with stack traces
await Effect.runPromise(fetchUserPosts("123"))
```

`Effect.fn` also supports piping transformations after the function body:

```typescript
const fetchWithTimeout = Effect.fn("fetchWithTimeout")(
  function*(url: string) {
    return yield* Effect.tryPromise(() => fetch(url))
  },
  Effect.timeout("5 seconds"),
  Effect.retry({ times: 3 })
)
```

#### Effect.fnUntraced - Untraced Functions (Library Internals)

Use for internal implementations where tracing overhead is unacceptable:

```typescript
import { Effect, Scope } from "effect"

// No tracing overhead - used in Stream, Channel, Sink internals
const internalTransform = Effect.fnUntraced(function*(pull, scope) {
  const reader = options.evaluate().getReader()
  yield* Scope.addFinalizer(scope, Effect.sync(() => reader.releaseLock()))
  // ... internal implementation
})
```

#### When to Use What

**Use `Effect.gen`** when:

- Writing inline effect composition
- One-off operations that don't need to be reused
- Inside other functions already being traced

**Use `Effect.fn`** when:

- Creating reusable effectful functions
- Building public API methods
- You want automatic tracing/spans for debugging
- Error stack traces matter for users

**Use `Effect.fnUntraced`** when:

- Building internal library implementations
- Performance is critical (hot paths)
- Function is called many times per operation
- Tracing overhead is unacceptable

### Error Handling with S.TaggedErrorClass

Create structured, typed errors using `TaggedErrorClass` from `@beep/schema`:

```typescript
import {Effect} from "effect";
import { $SomePackageId } from "@beep/identity/packages";
import * as Str from "effect/String";
import * as S from "effect/Schema";

const $I = $SomePackageId.create("relative/path/to/file");

// Define custom error types
class ValidationError extends S.TaggedErrorClass<ValidationError>($I`ValidationError`)(
  "ValidationError",
  {
    field: S.String,
    message: S.String
  },
  $I.annote("ValidationError", {
    description: "a meaningful description of the error"
  })
) {
}

class NetworkError extends S.TaggedErrorClass($I`NetworkError`)(
  "NetworkError",
  {
    status: S.Int,
        url: S.String
    },
  $I.annote("NetworkError", {
    description: "a meaningful description of the error"
  })
) {
}

// Use in operations
const validateAndFetch = 
  Effect.fn("validateAndFetch")(function* (url: string) {
    if (!Str.startsWith("https://")(url)) {
      return yield* Effect.fail(
        new ValidationError({
          field: "url",
          message: "URL must use HTTPS"
        })
      )
    }

    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: () => new NetworkError({status: 0, url})
    })

    if (!response.ok) {
      return yield* Effect.fail(
        new NetworkError({
          status: response.status,
          url
        })
      )
    }

    return response
  })
```

### Resource Management Pattern

Use `Effect.acquireUseRelease` for automatic resource cleanup:

```typescript
import { Console, Effect } from "effect"

// Resource acquisition pattern
const withDatabase = <A, E>(
  operation: (db: Database) => Effect.Effect<A, E, never>
): Effect.Effect<A, E | DatabaseError, never> =>
  Effect.acquireUseRelease(
    // Acquire
    Effect.tryPromise({
      try: () => createDatabaseConnection(),
      catch: (error) => new DatabaseError({ cause: error })
    }),
    // Use
    operation,
    // Release
    (db) => Effect.promise(() => db.close())
  )

// Usage
const queryUser = (id: string) =>
  withDatabase(
    Effect.fn(function* (db) {
      const user = yield* Effect.tryPromise({
        try: () => db.query("SELECT * FROM users WHERE id = ?", [id]),
        catch: (error) => new QueryError({ query: "users", cause: error })
      })

      yield* Console.log(`Found user: ${user.name}`)
      return user
    })
  )
```

### Layer Composition Pattern

Build applications using layered architecture:

```typescript
import {Context, Effect, Layer} from "effect";
import {$SomePackageId} from "@beep/identity/packages";

const $I = $SomePackageId.create("relative/path/to/file");

// Define service interfaces
class DatabaseService extends Context.Service<DatabaseService, {
  readonly query: (sql: string) => Effect.Effect<unknown[], DatabaseError, never>
}>()($I`DatabaseService`) {
}

class UserService extends Context.Service<UserService, {
  readonly getUser: (id: string) => Effect.Effect<User, UserError, never>
}>()($I`UserService`) {
}

// Implement services as layers
const DatabaseServiceLive = Layer.succeed(
  DatabaseService,
  DatabaseService.of({
    query: (sql) => Effect.tryPromise({
      try: () => database.execute(sql),
      catch: (error) => new DatabaseError({cause: error})
    })
  })
);

const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* DatabaseService;

    return UserService.of({
      getUser: Effect.fn(function* (id) {
        const rows = yield* db.query(`SELECT * FROM users WHERE id = '${id}'`);
        if (rows.length === 0) {
          return yield* Effect.fail(new UserError({message: "User not found"}));
        }
        return rows[0] as User;
      })
    });
  })
);

// Compose layers
const AppLayer = UserServiceLive.pipe(Layer.provide(DatabaseServiceLive));
```

## 🔧 DEVELOPMENT WORKFLOW PATTERNS

### Immediate Linting Pattern

**MANDATORY**: Always lint TypeScript files immediately after editing:

```bash
# After editing any TypeScript file
biome check . --write packages/effect/src/ModifiedFile.ts-morph

# This ensures:
# - Consistent code formatting
# - Early detection of style issues
# - Compliance with project standards
```

### Validation Checkpoint Pattern

Run comprehensive validation after implementation:

```bash
# 1. Lint all modified files
biome check . --write packages/effect/src/*.ts-morph

# 2. Validate JSDoc examples compile
bun run docgen

# 3. Check types
bun run check

# 4. Run tests
bun run test packages/effect/test/ModifiedTest.ts-morph

# 5. Build project
bun run build
```

### Progressive Implementation Pattern

Break complex features into validated increments:

```typescript
import * as S from "effect/Schema";
import {$SomePackageId} from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SomePackageId.create("relative/path/to/file");

export class FeatureConfig extends S.Class<FeatureConfig>($I`FeatureConfig`)(
  {
    option1: S.String,
    option2: S.Number
  },
  $I.annote(
    "FeatureConfig",
    {
      description: "Configuration for a feature"
    }
  )
) {}

// Step 1: Basic structure with effect/Schema

// Step 2: Core implementation
const createFeature = Effect.fn("createFeature")(function* (
  config: FeatureConfig // S.Class is opaque and can be used as a type
) {
  // Basic implementation
  yield* Console.log("Feature created");
  return {config};
});

// Step 3: Add error handling
const createFeatureWithValidation = Effect.fn("createFeatureWithValidation")(function* (
  config: FeatureConfig
) {
  if (config.option2 < 0) {
    return yield* Effect.fail("Option2 must be positive");
  }

  const feature = yield* createFeature(config);
  return feature;
});

// Step 4: Add comprehensive functionality
// ... continue building incrementally
```

## 📚 INTEGRATION PATTERNS

### Module Export Pattern

Structure module exports for clarity and discoverability:

````typescript
// ModuleName.ts-morph
/**
 * @since 1.0.0
 */

// Internal implementations
const internal = {
  // Private helper functions
}

// Public API exports

/**
 * Creates a new instance with the given configuration.
 *
 * @example
 * ```typescript
 * import { ModuleName } from "effect"
 *
 * const instance = ModuleName.create({ value: 42 })
 * ```
 *
 * @since 1.0.0
 * @category Utility
 */
export const create: <A>(config: Config<A>) => Effect.Effect<Instance<A>, never, never> = (config) =>
  Effect.succeed({ config })

/**
 * Transforms an instance using the provided function.
 *
 * @example
 * ```typescript
 * import { ModuleName, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 * 
 * 
 * 
 * })
 * ```
 *
 * @since 1.0.0
 * @category Utility
 */
export const map: <A, B>(instance: Instance<A>, f: (a: A) => B) => Effect.Effect<Instance<B>, never, never> = (
  instance,
  f
) => Effect.succeed({ config: f(instance.config) })
````

### Testing Integration Pattern

Structure tests to validate all aspects of functionality:

```typescript
import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, TestClock } from "effect"
import * as ModuleName from "../src/ModuleName.js"

describe("ModuleName", () => {
  describe("constructors", () => {
    it.effect("create should initialize with config", 
      Effect.fn(function*() {
        const config = { value: 42 }
        const instance = yield* ModuleName.create(config)

        assert.deepStrictEqual(instance.config, config)
      }))
  })

  describe("combinators", () => {
    it.effect("map should transform instance", 
      Effect.fn(function*() {
        const instance = yield* ModuleName.create({ value: 10 })
        const transformed = yield* ModuleName.map(instance, (x) => x * 2)

        assert.strictEqual(transformed.config.value, 20)
      }))
  })

  describe("time-dependent operations", () => {
    it.effect("should handle delays properly", 
      Effect.fn(function*() {
        const fiber = yield* Effect.fork(
          ModuleName.delayedOperation(Duration.seconds(5))
        )

        // Use TestClock to advance time
        yield* TestClock.advance(Duration.seconds(5))

        const result = yield* Effect.join(fiber)
        assert.strictEqual(result, "completed")
      }))
  })
})
```

This comprehensive set of patterns ensures consistent, high-quality development across the Effect library while maintaining type safety and functional programming principles.
