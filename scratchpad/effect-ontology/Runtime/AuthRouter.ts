/**
 * Router: Authentication API
 *
 * HTTP endpoints for WebSocket ticket-based authentication.
 *
 * @since 2.0.0
 * @module Runtime/AuthRouter
 */

import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { Effect, HashSet, Option, Redacted, Schema } from "effect"
import * as A from "effect/Array"
import * as Str from "effect/String"
import { AuthenticationError } from "../Domain/Error/Auth.ts"
import { TicketRequest, TicketResponse } from "../Domain/Schema/Auth.ts"
import { ConfigService } from "../Service/Config.ts"
import { TicketService } from "../Service/Ticket.ts"

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse API keys from comma-separated redacted string
 */
const parseApiKeys = (redacted: Redacted.Redacted<string>): HashSet.HashSet<string> => {
  const raw = Redacted.value(redacted)
  return HashSet.fromIterable(
    A.filter(A.map(Str.split(",")(raw), Str.trim), Str.isNonEmpty)
  )
}

/**
 * Format parse error for HTTP response
 */
const formatParseError = (error: Schema.SchemaError): string => error.toString()

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
const createTicketHandler = Effect.gen(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const config = yield* ConfigService
  const ticketService = yield* TicketService

  // Parse API keys from config
  const apiKeys = Option.match(config.api.keys, {
    onNone: () => HashSet.empty<string>(),
    onSome: parseApiKeys
  })

  // Get API key from header
  const apiKeyHeader = request.headers["x-api-key"]
  const apiKey = A.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader

  // Validate API key
  const validatedKey = yield* ticketService.validateApiKey(apiKey, apiKeys).pipe(
    Effect.catchTag("AuthenticationError", (error) =>
      Effect.gen(function*() {
        yield* Effect.logWarning("Ticket request failed: invalid API key", {
          reason: error.reason,
          remoteAddress: request.headers["x-forwarded-for"] ?? "unknown"
        })
        return yield* Effect.fail(error)
      }))
  )

  // Parse request body
  const body = yield* request.json.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(TicketRequest)),
    Effect.mapError((error) => {
      const message = "message" in error ? String(error.message) : formatParseError(error as Schema.SchemaError)
      return AuthenticationError.make({
        message: `Invalid request body: ${message}`,
        reason: "invalid"
      })
    })
  )

  // Create ticket
  const result = yield* ticketService.createTicket(body.ontologyId, validatedKey)

  yield* Effect.logInfo("Created WebSocket ticket", {
    ontologyId: body.ontologyId,
    expiresAt: new Date(result.expiresAt).toISOString()
  })

  const response = TicketResponse.fromUnknown(result)
  return yield* HttpServerResponse.json(response, { status: 200 })
})

/**
 * GET /v1/auth/status
 *
 * Get authentication service status (for monitoring).
 */
const statusHandler = Effect.gen(function*() {
  const ticketService = yield* TicketService
  const config = yield* ConfigService

  const activeTickets = yield* ticketService.getActiveCount()

  return yield* HttpServerResponse.json({
    service: "ticket-auth",
    status: "healthy",
    activeTickets,
    authRequired: config.api.requireAuth
  })
})

// =============================================================================
// Error Handlers
// =============================================================================

const handleAuthError = (error: AuthenticationError) =>
  Effect.gen(function*() {
    const status = error.reason === "missing" ? 401 : 403
    return yield* HttpServerResponse.json({
      error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      message: error.message,
      reason: error.reason
    }, { status })
  })

// =============================================================================
// Router Export
// =============================================================================

export const AuthRouter = HttpRouter.addAll([
HttpRouter.route("POST", 
    "/v1/auth/ticket",
    createTicketHandler.pipe(
      Effect.catchTag("AuthenticationError", handleAuthError)
    )
  ),
HttpRouter.route("GET", "/v1/auth/status", statusHandler)
])
