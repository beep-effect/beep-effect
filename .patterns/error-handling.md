# Error Handling Patterns - Effect Library

## 🎯 OVERVIEW

Comprehensive error handling patterns used throughout the Effect library, emphasizing structured errors, type safety, and proper Effect composition.

## 🚨 CRITICAL FORBIDDEN PATTERNS

### ❌ NEVER: try-catch in Effect.gen

```typescript
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate"

declare const someEffect: Effect.Effect<string, string>;

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
  return result.success
})
```

### ✅ MANDATORY: return yield* Pattern

```typescript
import * as Effect from "effect/Effect";

declare const invalidCondition: boolean;
declare const shouldInterrupt: boolean;
declare const someOtherEffect: Effect.Effect<string>;

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

### S.TaggedError Pattern

The core pattern for creating structured, typed errors with `_tag` for discrimination:

```typescript
import * as S from "effect/Schema";
import {LiteralKit} from "@beep/schema";
import {$SchemaId} from "@beep/identity";

const $I = $SchemaId.create("relative/path/to/file"); // define canonical IdentityComposer helper for annotations & path composition

// Basic tagged error - has _tag for catchTag discrimination
class ValidationError extends S.TaggedError<ValidationError>($I`ValidationError`)(
  "ValidationError",
  {
    field: S.String,
    message: S.String
  },
  $I.annoteError<ValidationError>(  // Annotate with IdentityComposer to tersely add `identifier` & `title` annotations
    "ValidationError",
    {
      description: "A validation error."
    }
  )
) {}

// Network error with cause
class NetworkError extends S.TaggedError<NetworkError>($I`NetworkError`)(
  "NetworkError",
  {
    status: S.Finite,
    url: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })) // encodes the cause stack; plain S.Defect() drops it
  },
  $I.annoteError<NetworkError>(
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
class SystemError extends S.TaggedError<SystemError>($I`SystemError`)(
  "SystemError",
  {
    reason: SystemErrorReason,
    module: S.String,
    method: S.String,
    pathOrDescriptor: S.optionalKey(S.Union([
      S.String,
      S.Finite
    ])),
    cause: S.optionalKey(S.Defect({ includeStack: true }))
  },
  $I.annoteError<SystemError>(
    "SystemError",
    {
      description: "A platform error with a reason, module, method, optional path or descriptor, and optional cause."
    }
  )
) {
  override get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${this.pathOrDescriptor !== undefined
                                                           ? ` (${this.pathOrDescriptor})`
                                                           : ""}${this.cause !== undefined
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
]).pipe(
  $I.annoteSchema("SystemErrorReason", {
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
]).pipe(
  $I.annoteSchema("HttpClientErrorReason", {
    description: "A Reason for a platform HTTP client error",
  })
);

export type HttpClientErrorReason = typeof HttpClientErrorReason.Type;

export const EncodingErrorReason = LiteralKit([
  "Decode", // Failed to decode from format
  "Encode", // Failed to encode to format
]).pipe(
  $I.annoteSchema("EncodingErrorReason", {
    description: "Encoding errors (from Body.ts, Schema)",
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
]).pipe(
  $I.annoteSchema("HttpErrorReason", {
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
]).pipe(
  $I.annoteSchema("ValidationErrorReason", {
    description: "Validation errors",
  })
);

export type ValidationErrorReason = typeof ValidationErrorReason.Type;
```

### Error Composition with Union Types

The codebase uses flat error structures with union types for composition, not abstract base classes:

```typescript
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import {$SchemaId} from "@beep/identity";
import * as S from "effect/Schema";

const HttpClientErrorReason = LiteralKit(["Transport", "Encode", "InvalidUrl", "StatusCode", "Decode", "EmptyBody"]);
type Data = { readonly url: string };
const url = "https://example.com";

const $I = $SchemaId.create("relative/path/to/file");

// Define individual error types
export class RequestError extends S.TaggedError<RequestError>($I`RequestError`)(
  "RequestError",
  {
    reason: HttpClientErrorReason.pick([
      "Transport",
      "Encode",
      "InvalidUrl"
    ]),
    url: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true }))
  },
  $I.annoteError<RequestError>(
    "RequestError",
    {
      description: "A meaningful description"
    }
  )
) {}

export class ResponseError extends S.TaggedError<ResponseError>($I`ResponseError`)(
  "ResponseError",
  {
    reason: HttpClientErrorReason.pick([
      "StatusCode",
      "Decode",
      "EmptyBody"
    ]),
    status: S.Number,
    cause: S.optionalKey(S.Defect({ includeStack: true }))
  },
  $I.annoteError<ResponseError>(
    "ResponseError",
    {
      description: "A meaningful description"
    }
  )
) {}

// Compose errors using effect/Schema `Union`
export const HttpClientError = S.Union([
  RequestError,
  ResponseError
]).pipe(
  $I.annoteSchema("HttpClientError", {
    description: "A meaningful description"
  })
);

export type HttpClientError = typeof HttpClientError.Type;

// Usage in function signatures
const fetchData: (url: string) => Effect.Effect<Data, HttpClientError> = Effect.fn(function* (url) {
  // Implementation...
  return { url };
});

// Discriminate using catchTag
const handleErrors = fetchData(url)
.pipe(
  Effect.catchTags({
    RequestError: (error) => {
      // Handle request errors
      return Effect.succeed({ url });
    },
    ResponseError: (error) => {
      // Handle response errors
      return Effect.succeed({ url });
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
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

class ParseError extends S.TaggedError<ParseError, { readonly brand: unique symbol }>()("ParseError", { input: S.String, cause: S.Defect({ includeStack: true }), message: S.optionalKey(S.String) }) {}
class ValidationError extends S.TaggedError<ValidationError, { readonly brand: unique symbol }>()("ValidationError", { field: S.String, message: S.String }) {}

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
import * as S from "effect/Schema";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";

import * as Effect from "effect/Effect";
import { flow } from "effect/Function";

declare const mapErrnoToReason: (code: string | undefined) => PlatformError.SystemErrorTag;

class ParseError extends S.TaggedError<ParseError, { readonly brand: unique symbol }>()("ParseError", { input: S.String, cause: S.Defect({ includeStack: true }), message: S.optionalKey(S.String) }) {}
class NetworkError extends S.TaggedError<NetworkError, { readonly brand: unique symbol }>()("NetworkError", { status: S.Number, url: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) }) {}

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
  Effect.flatMap((response): Effect.Effect<unknown, ParseError | NetworkError> => response.ok
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
  catch: (error) => PlatformError.systemError({
    _tag: mapErrnoToReason(P.hasProperty(error, "code") && P.isString(error.code) ? error.code : undefined),
    module: "FileSystem",
    method: "readFile",
    pathOrDescriptor: path,
    cause: error
  })
});
```

## 🔍 ERROR HANDLING COMBINATORS

### Effect.catch Pattern

Handle all errors uniformly:

```typescript
import * as Effect from "effect/Effect";
import * as Console from "effect/Console";

declare const riskyOperation: (input: string) => Effect.Effect<string, Error>;

const robustOperation = (input: string) =>
  riskyOperation(input).pipe(
    Effect.catch((error) =>
      // Log error for debugging, then provide a fallback
      Console.error(`Operation failed: ${error.message}`).pipe(Effect.as("fallback value"))
    )
  )
```

### Effect.catchTag Pattern

Handle specific error types:

```typescript
import * as Effect from "effect/Effect";
import * as Console from "effect/Console";
import * as Schedule from "effect/Schedule";

declare const complexOperation: (input: string) => Effect.Effect<string, { readonly _tag: "ValidationError"; readonly field: string } | { readonly _tag: "NetworkError"; readonly status: number }>;

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

### Effect.catchIf Pattern

Selectively handle certain errors:

```typescript
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";

declare const operation: (input: string) => Effect.Effect<string, { readonly _tag: "ValidationError"; readonly field: string } | { readonly _tag: "NetworkError"; readonly status: number }>;

const handleRecoverableErrors = (input: string) =>
  operation(input).pipe(
    Effect.catchIf(
      // Only handle client errors, not server errors
      (error): boolean => P.isTagged(error, "NetworkError") && error.status < 500,
      () => Effect.succeed("recovered")
    )
  )
```

## 🧪 ERROR TESTING PATTERNS

### Using Effect.flip for Testing

```typescript
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";

declare const operation: (input: string) => Effect.Effect<string, { readonly _tag: "ValidationError"; readonly field: string } | { readonly _tag: "NetworkError"; readonly status: number }>;

describe("error handling", () => {
  it.effect("should fail with specific error", 
    Effect.fnUntraced(function*() {
      const error = yield* Effect.flip(
        operation("invalid input")
      )

      assert.isTrue(P.isTagged(error, "ValidationError"))
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
import * as Effect from "effect/Effect";
import { assert, it } from "@effect/vitest";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

class CustomError extends S.TaggedError<CustomError, { readonly brand: unique symbol }>()("CustomError", { message: S.String }) {}

it.effect("should transform errors correctly", 
  Effect.fnUntraced(function*() {
    const error = yield* Effect.flip(
      Effect.fail("string error").pipe(
        Effect.mapError((msg) => new CustomError({ message: msg }))
      )
    )

    assert.isTrue(P.isTagged(error, "CustomError"))
  }))
```

## 🔧 ERROR UTILITY PATTERNS

### Error Transformation Utilities

```typescript
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Match from "effect/Match";

import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
class ResourceNotFoundError extends S.TaggedError<ResourceNotFoundError, { readonly brand: unique symbol }>()("ResourceNotFoundError", { resource: S.String }) {}
class AccessDeniedError extends S.TaggedError<AccessDeniedError, { readonly brand: unique symbol }>()("AccessDeniedError", { resource: S.String }) {}
class UnknownError extends S.TaggedError<UnknownError, { readonly brand: unique symbol }>()("UnknownError", { cause: S.Defect({ includeStack: true }) }) {}
type DomainError = ResourceNotFoundError | AccessDeniedError | UnknownError;

// Convert platform errors to domain errors
const mapFileSystemError = (error: PlatformError.PlatformError): DomainError => {
  const reason = error.reason;
  if (!(reason instanceof PlatformError.SystemError)) {
    return new UnknownError({ cause: error });
  }
  const path = reason.pathOrDescriptor;
  const resource = P.isString(path)
    ? path
    : P.isNumber(path) ? Str.concat("descriptor:", `${path}`) : "unknown resource";
  return Match.value(reason).pipe(
    Match.withReturnType<DomainError>(),
    Match.when({ _tag: "NotFound" }, () => new ResourceNotFoundError({ resource })),
    Match.when({ _tag: "PermissionDenied" }, () => new AccessDeniedError({ resource })),
    Match.orElse(() => new UnknownError({ cause: error }))
  );
};

// Error aggregation for multiple operations
const aggregateErrors = <E>(errors: ReadonlyArray<E>): E | AggregateError =>
  A.matchLeft(errors, {
    onEmpty: () => new AggregateError(errors),
    onNonEmpty: (head, tail) => A.match(tail, {
      onEmpty: () => head,
      onNonEmpty: () => new AggregateError(errors),
    }),
  });
```

### Error Logging Patterns

```typescript
import * as Effect from "effect/Effect";
import * as Console from "effect/Console";
import * as Cause from "effect/Cause";

const withErrorLogging = <A, E, R>(
  name: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.tapError((error) => Console.error(`${name} failed:`, error)),
    Effect.tapCause((cause) => Console.error(`${name} cause:`, Cause.pretty(cause)))
  )
```

## 🎯 ERROR RECOVERY PATTERNS

### Retry with Exponential Backoff

```typescript
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

const withRetry = <A, E, R>(
  operation: Effect.Effect<A, E, R>,
  isRetryable: (error: E) => boolean = () => true
): Effect.Effect<A, E, R> =>
  operation.pipe(
    Effect.retry({
      schedule: Schedule.exponential("100 millis"),
      times: 3,
      while: isRetryable
    })
  )
```

### Circuit Breaker Pattern

```typescript
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";

class CircuitBreakerError extends S.TaggedError<CircuitBreakerError, { readonly brand: unique symbol }>()("CircuitBreakerError", { message: S.String }) {}

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
import * as Effect from "effect/Effect";

const withFallbacks = <A, E, R>(
  primary: Effect.Effect<A, E, R>,
  fallbacks: ReadonlyArray<Effect.Effect<A, E, R>>
): Effect.Effect<A, E, R> =>
  fallbacks.reduce(
    (acc, fallback) => acc.pipe(Effect.catch(() => fallback)),
    primary
  )
```

## 📝 SUCCESS CRITERIA

### Well-Handled Errors Checklist

- [ ] Errors use appropriate pattern: S.TaggedError (discrimination)
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
