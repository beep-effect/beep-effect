/**
 * Runtime: HTTP Middleware
 *
 * **Details**
 *
 * Middleware for the HTTP server, including shutdown tracking, authentication,
 * and request logging.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, Effect, HashSet, Inspectable, Random, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { ConflictActor } from "../Domain/Schema/Timeline.ts";
import { ConfigService } from "../Service/Config.ts";
import { sha256 } from "../Utils/Hash.ts";
import { ShutdownService } from "./Shutdown.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/HttpMiddleware");

/**
 * Request-local actor used for auditable conflict transitions.
 *
 * **Example** (Inspect the request service)
 *
 * ```ts
 * import { CurrentConflictActor } from "@effect-ontology/Runtime/HttpMiddleware"
 *
 * console.log(CurrentConflictActor)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CurrentConflictActor extends Context.Service<CurrentConflictActor, ConflictActor>()(
  $I`CurrentConflictActor`
) {}

const AnonymousConflictActor = ConflictActor.make({
  principal: "anonymous",
  credentialFingerprint: O.none(),
});

/**
 * Paths that are exempt from authentication (health checks)
 */
const PUBLIC_PATHS = ["/", "/health", "/health/live", "/health/ready", "/health/deep"];

/**
 * Check if a path is public (exempt from auth)
 */
const isEventStreamPath = (path: string): boolean => {
  const pathname = O.getOrElse(A.head(Str.split(path, "?")), () => path);
  return Str.includes("/events/stream")(pathname);
};

const isPublicPath = (path: string): boolean =>
  A.contains(PUBLIC_PATHS, path) || Str.startsWith("/health/")(path) || isEventStreamPath(path);

/**
 * Parse API keys from comma-separated string
 */
const parseApiKeys = (redacted: Redacted.Redacted<string>): HashSet.HashSet<string> => {
  const raw = Redacted.value(redacted);
  return HashSet.fromIterable(A.filter(A.map(Str.split(raw, ","), Str.trim), Str.isNonEmpty));
};

/**
 * Middleware to enforce API key authentication
 *
 * **Details**
 *
 * When API.REQUIRE_AUTH is true:
 * - All /v1/* endpoints require valid X-API-Key header
 * - Health endpoints remain public
 * - Invalid/missing key returns 401
 *
 * **Example** (Inspect make auth middleware)
 *
 * ```ts
 * import { makeAuthMiddleware } from "@effect-ontology/Runtime/HttpMiddleware"
 *
 * console.log(makeAuthMiddleware)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeAuthMiddleware = Effect.gen(function* () {
  const config = yield* ConfigService;

  // Skip auth if not required
  if (!config.api.requireAuth) {
    return HttpMiddleware.make((app) => app.pipe(Effect.provideService(CurrentConflictActor, AnonymousConflictActor)));
  }

  // Parse API keys
  const apiKeys = O.match(config.api.keys, {
    onNone: () => HashSet.empty<string>(),
    onSome: parseApiKeys,
  });

  // If auth is required but no keys configured, log warning
  if (HashSet.isEmpty(apiKeys)) {
    yield* Effect.logWarning("API.REQUIRE_AUTH is true but no API.KEYS configured - all requests will be rejected");
  }

  return HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const path = request.url;

      // Skip auth for public paths
      if (isPublicPath(path)) {
        return yield* app.pipe(Effect.provideService(CurrentConflictActor, AnonymousConflictActor));
      }

      // Get API key from header
      const apiKeyHeader = request.headers["x-api-key"];
      const apiKey = A.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

      // Validate API key
      if (P.not(P.isTruthy)(apiKey) || !HashSet.has(apiKeys, apiKey)) {
        yield* Effect.logWarning("Unauthorized request", {
          path,
          hasKey: !P.not(P.isTruthy)(apiKey),
          remoteAddress: request.headers["x-forwarded-for"] ?? "unknown",
        });

        return yield* HttpServerResponse.json(
          {
            error: "UNAUTHORIZED",
            message: "Missing or invalid API key. Provide X-API-Key header.",
          },
          { status: 401 }
        );
      }

      // API key valid, proceed with request
      const credentialFingerprint = yield* sha256(apiKey);
      return yield* app.pipe(
        Effect.provideService(
          CurrentConflictActor,
          ConflictActor.make({
            principal: "api-key",
            credentialFingerprint: O.some(credentialFingerprint),
          })
        )
      );
    })
  );
});

/**
 * Middleware to track active requests for graceful shutdown
 *
 * **Example** (Inspect make shutdown middleware)
 *
 * ```ts
 * import { makeShutdownMiddleware } from "@effect-ontology/Runtime/HttpMiddleware"
 *
 * console.log(makeShutdownMiddleware)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeShutdownMiddleware = Effect.gen(function* () {
  const shutdown = yield* ShutdownService;

  return HttpMiddleware.make((app) => shutdown.trackRequest(app));
});

/**
 * Middleware to log HTTP requests with timing
 *
 * **Details**
 *
 * Logs:
 * - Request method, path, and timing
 * - Response status code
 * - Configurable log level (debug for health checks, info for API)
 *
 * **Example** (Inspect make logging middleware)
 *
 * ```ts
 * import { makeLoggingMiddleware } from "@effect-ontology/Runtime/HttpMiddleware"
 *
 * console.log(makeLoggingMiddleware)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLoggingMiddleware = Effect.sync(() =>
  HttpMiddleware.make((app) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const start = yield* Clock.currentTimeMillis;
      const requestId = Math.abs(yield* Random.nextInt)
        .toString(16)
        .slice(0, 8);

      const path = request.url;
      const method = request.method;

      // Use debug level for health checks to reduce noise
      const isHealthCheck = Str.startsWith("/health")(path);
      const logLevel = isHealthCheck ? Effect.logDebug : Effect.logInfo;

      yield* logLevel("HTTP request started", {
        requestId,
        method,
        path,
      });

      // Execute the handler and capture the response
      return yield* app.pipe(
        Effect.tap(
          Effect.fnUntraced(function* (res) {
            const elapsed = (yield* Clock.currentTimeMillis) - start;

            yield* logLevel("HTTP request completed", {
              requestId,
              method,
              path,
              status: res.status,
              durationMs: elapsed,
            });
          })
        ),
        Effect.tapError(
          Effect.fnUntraced(function* (error) {
            const elapsed = (yield* Clock.currentTimeMillis) - start;

            yield* Effect.logWarning("HTTP request failed", {
              requestId,
              method,
              path,
              error: Inspectable.toStringUnknown(error),
              durationMs: elapsed,
            });
          })
        )
      );
    })
  )
);
