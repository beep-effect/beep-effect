# Error Handling Patterns - Effect Library

## 🎯 OVERVIEW

Comprehensive error handling patterns used throughout the Effect library, emphasizing structured errors, type safety, and proper Effect composition.

## 🚨 CRITICAL FORBIDDEN PATTERNS

### ❌ NEVER: try-catch in Effect.gen

```typescript
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate"
// ❌ WRONG - This breaks Effect semantics
Effect.gen(function*() {
  try {
    const result = yield* someEffect
    return result
  } catch (error: unknown) {
    // This will never be reached!
    return yield* Effect.fail("error")
  }
})

// ✅ CORRECT - Use Effect's error handling
Effect.gen(function*() {
  const result = yield* Effect.result(someEffect)
  if (
    P.isTagged(result, "Failure") // prefer this
    // same as `result._tag === "Failure"`
  ) {
    // Handle error appropriately
    return yield* Effect.fail("handled error")
  }
  return result.value
})
```

### ✅ MANDATORY: return yield* Pattern

```typescript
// ✅ CORRECT - Always use return yield* for terminal effects
Effect.gen(function*() {
  if (invalidCondition) {
    return yield* Effect.fail("validation failed")
  }

  if (shouldInterrupt) {
    return yield* Effect.interrupt
  }

  // Continue with normal flow
  const result = yield* someOtherEffect
  return result
})
```

## 🏗️ STRUCTURED ERROR TYPES

### S.TaggedErrorClass Pattern

The core pattern for creating structured, typed errors with `_tag` for discrimination:

```typescript
import * as S from "effect/Schema";
import {LiteralKit} from "@beep/schema";
import {$SomePackageId} from "@beep/identity/packages";

const $I = $SomePackageId.create("relative/path/to/file"); // define canonical IdentityComposer helper for annotations & path composition

// Basic tagged error - has _tag for catchTag discrimination
class ValidationError extends S.TaggedErrorClass<ValidationError>($I`ValidationError`)(
  "ValidationError",
  {
    field: S.String,
    message: S.String
  },
  $I.annote(  // Annotate with IdentityComposer to tersly add `identifier` & `title` annotations
    "ValidationError",
    {
      description: "A validation error."
    }
  )
) {
}

// Network error with cause
class NetworkError extends S.TaggedErrorClass<NetworkError>($I`NetworkError`)(
  "NetworkError",
  {
    status: S.Number,
    url: S.String,
    cause: S.optionalKey(S.Defect)
  },
  $I.annote(
    "NetworkError",
    {
      description: "A network error with a status code and URL."
    }
  )
) {
  // Custom message formatting
  override get message(): string {
    return `Network request failed: ${this.status} ${this.url}`;
  }
}

const SystemErrorReason = LiteralKit([
  "reason1",
  "reason2"
]);

// Platform error with context
class SystemError extends S.TaggedErrorClass<SystemError>($I`SystemError`)(
  "SystemError",
  {
    reason: SystemErrorReason,
    module: S.String,
    method: S.String,
    pathOrDescriptor: S.optionalKey(S.Union([
      S.String,
      S.Number
    ])),
    cause: S.optionalKey(S.Defect)
  },
  $I.annote(
    "SystemError",
    {
      description: "A platform error with a reason, module, method, optional path or descriptor, and optional cause."
    }
  )
) {
  override get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${this.pathOrDescriptor !== undefined
                                                           ? ` (${this.pathOrDescriptor})`
                                                           : ""}${this.cause
                                                                  ? `: ${this.cause}`
                                                                  : ""}`;
  }
}
```

### Error Reason Classification

Standardized error reasons for consistency:

```typescript
import { $SchemaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $SchemaId.create("internal/error-reasons");

export const SystemErrorReason = LiteralKit([
  "AlreadyExists",
  "BadResource",
  "Busy",
  "InvalidData",
  "NotFound",
  "PermissionDenied",
  "TimedOut",
  "UnexpectedEof",
  "Unknown",
  "WouldBlock",
  "WriteZero",
]).annotate(
  $I.annote("SystemErrorReason", {
    description: "A Reason for a platform system error",
  })
);

export type SystemErrorReason = typeof SystemErrorReason.Type;

export const HttpClientErrorReason = LiteralKit([
  "Transport", // Network/transport layer failure
  "Encode", // Request body encoding failure
  "InvalidUrl", // Malformed URL
  "StatusCode", // Non-successful HTTP status
  "Decode", // Response body decoding failure
  "EmptyBody", // Expected body but got none
]).annotate(
  $I.annote("HttpClientErrorReason", {
    description: "A Reason for a platform HTTP client error",
  })
);

export type HttpClientErrorReason = typeof HttpClientErrorReason.Type;

export const EncodingErrorReason = LiteralKit([
  "Decode", // Failed to decode from format
  "Encode", // Failed to encode to format
]).annotate(
  $I.annote("EncodingErrorReason", {
    description: "Encoding errors (from Body.ts-morph, Schema)",
  })
);

export type EncodingErrorReason = typeof EncodingErrorReason.Type;

export const HttpErrorReason = LiteralKit([
  "BadRequest",
  "Unauthorized",
  "Forbidden",
  "NotFound",
  "InternalServerError",
  "BadGateway",
  "ServiceUnavailable",
]).annotate(
  $I.annote("HttpErrorReason", {
    description: "HTTP API status errors",
  })
);

export type HttpErrorReason = typeof HttpErrorReason.Type;

export const ValidationErrorReason = LiteralKit([
  "InvalidFormat",
  "OutOfRange",
  "Required",
  "TooLong",
  "TooShort",
]).annotate(
  $I.annote("ValidationErrorReason", {
    description: "Validation errors",
  })
);

export type ValidationErrorReason = typeof ValidationErrorReason.Type;
```

### Error Composition with Union Types

The codebase uses flat error structures with union types for composition, not abstract base classes:

```typescript
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import {$SomePackageId} from "@beep/identity/packages";

}
import * as S from "effect/Schema";

const $I = $SomePackageId.create("relative/path/to/file");

// Define individual error types
export class RequestError extends S.TaggedErrorClass<RequestError>($I`RequestError`)(
  "RequestError",
  {
    reason: HttpClientErrorReason.pick([
      "Transport",
      "Encode",
      "InvalidUrl"
    ]),
    url: S.String,
    cause: S.optionalKey(S.Defect)
  },
  $I.annote(
    "RequestError",
    {
      description: "A meaningful description"
    }
  )
) {
}

export class ResponseError extends S.TaggedErrorClass<ResponseError>($I`ResponseError`)(
  "ResponseError",
  {
    reason: HttpClientErrorReason.pick([
      "StatusCode",
      "Decode",
      "EmptyBody"
    ]),
    status: S.Number,
    cause: S.optionalKey(S.Defect)
  },
  $I.annote(
    "ResponseError",
    {
      description: "A meaningful description"
    }
  )
) {
}

// Compose errors using effect/Schema `Union`
export const HttpClientError = S.Union([
  RequestError,
  ResponseError
])
.annotate($I.annote(
  "HttpClientError",
  {
    description: "A meaningful description"
  }
));

export type HttpClientError = typeof HttpClientError.Type;

// Usage in function signatures
const fetchData: (url: string) => Effect.Effect<Data, HttpClientError> = Effect.fn(function* (url) {
  // Implementation...
});

// Discriminate using catchTag
const handleErrors = fetchData(url)
.pipe(
  Effect.catchTags({
    RequestError: (error) => {
      // Handle request errors
    },
    ResponseError: (error) => {
      // Handle response errors
    }
  }),
  
);
```

### Flat Structure Rationale

The codebase prefers flat error structures over inheritance because:

1. **Better type inference** - Union types work seamlessly with Effect's error channel
2. **Simpler catchTag** - Direct tag matching without instanceof checks
3. **Serialization-friendly** - No prototype chain complications
4. **Composition over inheritance** - Combine errors by union, not by extending

## 🔄 ERROR CREATION PATTERNS

### Effect.try Pattern

For operations that might throw:

```typescript
// Basic try pattern
const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (error) =>
      new ParseError({
        input,
        cause: error,
        message: `Failed to parse JSON: ${error}`
      })
  })

// With validation
const parsePositiveNumber = (input: string) =>
  Effect.try({
    try: () => {
      const num = Number(input)
      if (isNaN(num) || num <= 0) {
        throw new Error("Not a positive number")
      }
      return num
    },
    catch: (error) =>
      new ValidationError({
        field: "input",
        message: String(error)
      })
  })
```

### Effect.tryPromise Pattern

For Promise-based operations:

```typescript
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
// Network request with structured errors
const fetchUser = flow(
  (id: string) => Effect.tryPromise({
    try: () => fetch(`/api/users/${id}`),
    catch: (error) => new NetworkError({
      status: 0,
      url: `/api/users/${id}`,
      cause: error
    })
  }),
  Effect.flatMap((response) => response.ok
                               ? Effect.tryPromise({
      try: () => response.json(),
      catch: (error) => new ParseError({
        input: "response body",
        cause: error
      })
    })
                               : Effect.fail(new NetworkError({
      status: response.status,
      url: response.url
    })))
);

// File operations
const readFile = (path: string) => Effect.tryPromise({
  try: () => import("fs/promises").then((fs) => fs.readFile(
    path,
    "utf8"
  )),
  catch: (error: NodeJS.ErrnoException) => new SystemError({
    reason: mapErrnoToReason(error.code),
    module: "FileSystem",
    method: "readFile",
    pathOrDescriptor: path,
    cause: error
  })
});
```

## 🔍 ERROR HANDLING COMBINATORS

### Effect.catchAll Pattern

Handle all errors uniformly:

```typescript
const robustOperation = (input: string) =>
  riskyOperation(input).pipe(
    Effect.catch((error) => {
      // Log error for debugging
      Console.error(`Operation failed: ${error}`),
        // Provide fallback or re-throw
        Effect.succeed("fallback value")
    })
  )
```

### Effect.catchTag Pattern

Handle specific error types:

```typescript
const handleSpecificErrors = (input: string) =>
  complexOperation(input).pipe(
    Effect.catchTag("ValidationError", (error) => {
      // Handle validation errors specifically
      Console.log(`Validation failed for field: ${error.field}`)
      return Effect.succeed("default value")
    }),
    Effect.catchTag("NetworkError", (error) => {
      // Handle network errors with retry
      if (error.status >= 500) {
        return complexOperation(input).pipe(
          Effect.retry(Schedule.exponential("100 millis", 2.0))
        )
      }
      return Effect.fail(error)
    })
  )
```

### Effect.catchSome Pattern

Selectively handle certain errors:

```typescript
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
const handleRecoverableErrors = (input: string) =>
  operation(input).pipe(
    Effect.catchSome((error) => {
      if (P.isTagged(error, "NetworkError") && error.status < 500) {
        // Only handle client errors, not server errors
        return O.some(Effect.succeed("recovered"))
      }
      return O.none()
    })
  )
```

## 🧪 ERROR TESTING PATTERNS

### Using Effect.exit for Testing

```typescript
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as P from "effect/Predicate";
describe("error handling", () => {
  it.effect("should fail with specific error", 
    Effect.fnUntraced(function*() {
      const result = yield* Effect.exit(
        operation("invalid input")
      )

      if (P.isTagged(result, "Failure")) {
        assert.isTrue(ValidationError.isValidationError(result.cause))
        const error = result.cause as ValidationError
        assert.strictEqual(error.field, "input")
      } else {
        assert.fail("Expected operation to fail")
      }
    }))

  it.effect("should handle errors with catchTag",
    Effect.fnUntraced(function*() {
      let errorHandled = false

      const result = yield* operation("invalid").pipe(
        Effect.catchTag("ValidationError", (error) => {
          errorHandled = true
          return Effect.succeed("handled")
        })
      )

      assert.strictEqual(result, "handled")
      assert.isTrue(errorHandled)
    }))
})
```

### Testing Error Transformations

```typescript
it.effect("should transform errors correctly", 
  Effect.fnUntraced(function*() {
    const result = yield* Effect.exit(
      Effect.fail("string error").pipe(
        Effect.mapError((msg) => new CustomError({ message: msg }))
      )
    )

    assert.isTrue(Exit.isFailure(result))
    if (Exit.isFailure(result)) {
      assert.isTrue(CustomError.isCustomError(result.cause))
    }
  }))
```

## 🔧 ERROR UTILITY PATTERNS

### Error Transformation Utilities

```typescript
import * as Match from "effect/Match";
// Convert platform errors to domain errors
const mapFileSystemError = Match.type<SystemError>()
.pipe(
  Match.withReturnType<DomainError>(),
  Match.when(
    {reason: "NotFound"},
    (error) => new ResourceNotFoundError({resource: error.pathOrDescriptor})
  ),
  Match.when(
    {reason: "PermissionDenied"},
    (error) => new AccessDeniedError({resource: error.pathOrDescriptor})
  ),
  Match.orElse((error) => new UnknownError({cause: error}))
);

// Error aggregation for multiple operations
const aggregateErrors = <E>(errors: ReadonlyArray<E>): E | AggregateError<E> => {
  if (errors.length === 1) {
    return errors[0]!;
  }
  return new AggregateError({errors});
};
```

### Error Logging Patterns

```typescript
const withErrorLogging = <A, E, R>(
  name: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.tapError((error) => Console.error(`${name} failed:`, error)),
    Effect.tapErrorCause((cause) => Console.error(`${name} cause:`, Cause.pretty(cause)))
  )
```

## 🎯 ERROR RECOVERY PATTERNS

### Retry with Exponential Backoff

```typescript
const withRetry = <A, E, R>(
  operation: Effect.Effect<A, E, R>,
  isRetryable: (error: E) => boolean = () => true
): Effect.Effect<A, E, R> =>
  operation.pipe(
    Effect.retry(
      Schedule.exponential("100 millis").pipe(
        Schedule.whileInput(isRetryable),
        Schedule.compose(Schedule.recurs(3))
      )
    )
  )
```

### Circuit Breaker Pattern

```typescript
const withCircuitBreaker = <A, E, R>(
  operation: Effect.Effect<A, E, R>,
  failureThreshold: number = 5,
  recoveryTime: Duration.Duration = Duration.seconds(30)
): Effect.Effect<A, E | CircuitBreakerError, R> =>
  // Implementation would use Ref for state management
  // and track failures/successes over time
  operation // Simplified for pattern illustration
```

### Fallback Chain Pattern

```typescript
const withFallbacks = <A, E, R>(
  primary: Effect.Effect<A, E, R>,
  fallbacks: ReadonlyArray<Effect.Effect<A, E, R>>
): Effect.Effect<A, E, R> =>
  fallbacks.reduce(
    (acc, fallback) => acc.pipe(Effect.orElse(() => fallback)),
    primary
  )
```

## 📝 SUCCESS CRITERIA

### Well-Handled Errors Checklist

- [ ] Errors use appropriate pattern: S.TaggedErrorClass (discrimination)
- [ ] Error types carry relevant context information
- [ ] Custom error messages are informative via `get message()` getter
- [ ] Error reasons are standardized and consistent
- [ ] No try-catch blocks in Effect.gen generators
- [ ] Always use return yield* for error termination
- [ ] Specific error handling with catchTag for tagged errors
- [ ] Proper error testing with Effect.exit
- [ ] Error recovery strategies implemented where appropriate
- [ ] Error logging provides debugging context
- [ ] Union types used for error composition, not inheritance

This structured approach to error handling ensures type safety, debugging clarity, and robust error recovery throughout Effect applications.
