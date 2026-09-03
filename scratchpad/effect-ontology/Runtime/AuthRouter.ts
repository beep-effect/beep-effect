/**
 * Router: Authentication API
 *
 * **Details**
 *
 * HTTP endpoints for WebSocket ticket-based authentication.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Cause, DateTime, Effect, HashSet, Inspectable, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { AuthenticationError } from "../Domain/Error/Auth.ts";
import { TicketRequest, TicketResponse } from "../Domain/Schema/Auth.ts";
import { ConfigService } from "../Service/Config.ts";
import { TicketService } from "../Service/Ticket.ts";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse API keys from comma-separated redacted string
 */
const parseApiKeys = (redacted: Redacted.Redacted<string>): HashSet.HashSet<string> => {
  const raw = Redacted.value(redacted);
  return HashSet.fromIterable(A.filter(A.map(Str.split(",")(raw), Str.trim), Str.isNonEmpty));
};

// =============================================================================
// Auth Router
// =============================================================================

/**
 * POST /v1/auth/ticket
 *
 * Request a single-use WebSocket authentication ticket.
 * Requires valid X-API-Key header.
 *
 * Request body: { ontologyId: string }
 * Response: { ticket: string, expiresAt: number, ttlSeconds: number }
 */
const createTicketHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const config = yield* ConfigService;
  const ticketService = yield* TicketService;

  // Parse API keys from config
  const apiKeys = O.match(config.api.keys, {
    onNone: () => HashSet.empty<string>(),
    onSome: parseApiKeys,
  });

  // Get API key from header
  const apiKeyHeader = request.headers["x-api-key"];
  const apiKey = A.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

  // Validate API key
  const validatedKey = yield* ticketService.validateApiKey(apiKey, apiKeys).pipe(
    Effect.catchTag("AuthenticationError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logWarning("Ticket request failed: invalid API key", {
          reason: error.reason,
          remoteAddress: request.headers["x-forwarded-for"] ?? "unknown",
        });
        return yield* error;
      })
    )
  );

  // Parse request body
  const body = yield* request.json.pipe(
    Effect.flatMap(TicketRequest.decodeUnknownEffect),
    Effect.mapError((cause) =>
      AuthenticationError.make({
        message: `Invalid request body: ${Inspectable.toStringUnknown(cause, 0)}`,
        reason: "invalid",
      })
    )
  );

  // Create ticket
  const result = yield* ticketService.createTicket(body.ontologyId, validatedKey);

  yield* Effect.logInfo("Created WebSocket ticket", {
    ontologyId: body.ontologyId,
    expiresAt: DateTime.toDateUtc(DateTime.makeUnsafe(result.expiresAt)).toISOString(),
  });

  const response = yield* TicketResponse.decodeUnknownEffect(result).pipe(
    Effect.mapError((cause) =>
      AuthenticationError.make({
        message: `Invalid ticket response: ${Inspectable.toStringUnknown(cause, 0)}`,
        reason: "invalid",
      })
    )
  );
  return yield* HttpServerResponse.json(response, { status: 200 });
});

/**
 * GET /v1/auth/status
 *
 * Get authentication service status (for monitoring).
 */
const statusHandler = Effect.gen(function* () {
  const ticketService = yield* TicketService;
  const config = yield* ConfigService;

  const activeTickets = yield* ticketService.getActiveCount;

  return yield* HttpServerResponse.json({
    service: "ticket-auth",
    status: "healthy",
    activeTickets,
    authRequired: config.api.requireAuth,
  });
});

// =============================================================================
// Error Handlers
// =============================================================================

const handleAuthError = Effect.fn("handleAuthError")(function* (error: AuthenticationError) {
  const status = error.reason === "missing" ? 401 : 403;
  return yield* HttpServerResponse.json(
    {
      error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      message: error.message,
      reason: error.reason,
    },
    { status }
  );
});

// =============================================================================
// Router Export
// =============================================================================

/**
 * HTTP surface for issuing WebSocket tickets and reporting ticket-auth health.
 *
 * **Details**
 *
 * Tickets are issued at `POST /v1/auth/ticket`.
 *
 * **Example** (Register the auth routes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { AuthRouter } from "@effect-ontology/Runtime/AuthRouter"
 *
 * const served = Layer.provide(AuthRouter, HttpRouter.layer)
 * console.log(served !== AuthRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const AuthRouter = HttpRouter.addAll([
  HttpRouter.route(
    "POST",
    "/v1/auth/ticket",
    createTicketHandler.pipe(
      Effect.catchTag("AuthenticationError", handleAuthError),
      Effect.catchCauseIf(P.not(Cause.hasInterrupts), (cause) =>
        Effect.logError("Ticket request failed unexpectedly", { cause: Cause.pretty(cause) }).pipe(
          Effect.as(
            HttpServerResponse.jsonUnsafe(
              { error: "INTERNAL_SERVER_ERROR", message: "Ticket creation failed" },
              { status: 500 }
            )
          )
        )
      )
    )
  ),
  HttpRouter.route("GET", "/v1/auth/status", statusHandler),
]);
